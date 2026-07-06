import FormButton from "@/components/FormButton";
import Icon from "@/components/Icon";
import PressableListItem from "@/components/PressableListItem";
import { Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import LinkExpirationSheet from "@/features/group/components/LinkExpirationSheet";
import useAppToast from "@/hooks/use-app-toast";
import { useNetwork } from "@/hooks/useNetwork";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import {
  getErrorHex,
  getPrimaryHex,
  getSecondaryHex
} from "@/utils/getColorHex";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { AlertCircle, Download, Share2 } from "lucide-react-native";
import QRCodeGen from "qrcode";
import { Ref, useMemo, useRef, useState } from "react";
import { Dimensions, Platform, Share, useColorScheme } from "react-native";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";

const APP_SCHEME = "ambagan";

// ── Downloadable QR card ──────────────────────────────────────────────
// The saved image is a fixed light-mode card (white bg, dark text) so it
// scans and prints cleanly regardless of the in-app theme.
const CARD_W = 720;
const CARD_PAD = 56;
const QR_TARGET = 460;
// The saved PNG is snapshotted from an off-screen copy laid out at this
// multiple of CARD_W, for a crisp, print-ready image. (react-native-svg
// snapshots a view at its real layout bounds, not toDataURL's size opts.)
const EXPORT_SCALE = 2;
const CARD_COLORS = {
  bg: "#FFFFFF",
  qr: "#000000",
  eyebrow: "#7C3AED", // primary-500
  title: "#111827",
  subtext: "#6B7280",
  meta: "#9CA3AF"
};

function buildInviteUrl(token: string): string {
  return `${APP_SCHEME}://join/${token}`;
}

/** Greedy word-wrap for the group name, capped at `maxLines` with an
 *  ellipsis on overflow (SVG <Text> has no auto-wrap). */
function wrapName(name: string, maxChars = 20, maxLines = 2): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [name];
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const test = cur ? `${cur} ${words[i]}` : words[i];
    if (test.length <= maxChars) {
      cur = test;
      continue;
    }
    if (cur) lines.push(cur);
    if (lines.length === maxLines) {
      cur = "";
      break;
    }
    cur =
      words[i].length > maxChars
        ? `${words[i].slice(0, maxChars - 1)}…`
        : words[i];
  }
  if (cur && lines.length < maxLines) {
    lines.push(cur);
    i = words.length;
  }
  if (i < words.length) {
    // Ran out of lines before consuming every word — ellipsize the last.
    const last = (lines[lines.length - 1] ?? "").replace(/…?\s*$/, "");
    lines[lines.length - 1] = `${last
      .slice(0, maxChars - 1)
      .replace(/\s+$/, "")}…`;
  }
  return lines;
}

/** One SVG path (a rect per dark module) for a QR matrix. */
function buildQrPath(
  data: readonly number[] | Uint8Array,
  size: number,
  cell: number,
  offsetX: number,
  offsetY: number
): string {
  let d = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (data[r * size + c]) {
        const x = offsetX + c * cell;
        const y = offsetY + r * cell;
        d += `M${x} ${y}h${cell}v${cell}h${-cell}z`;
      }
    }
  }
  return d;
}

type InviteCardLayout = {
  qrPath: string;
  height: number;
  nameLines: string[];
  eyebrowY: number;
  titleTop: number;
  titleLineH: number;
  subtextY: number;
  metaY: number;
  metaText: string;
};

/** The shareable invite card. Rendered on-screen as the preview AND
 *  snapshotted (via the same ref) for "Download QR", so the saved image
 *  is exactly what the user sees. viewBox is fixed at CARD_W so it scales
 *  to any display `width`. */
function InviteCardSvg({
  card,
  creatorName,
  width,
  svgRef
}: {
  card: InviteCardLayout;
  creatorName?: string;
  width: number;
  svgRef?: Ref<Svg>;
}) {
  const height = (width * card.height) / CARD_W;
  return (
    <Svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${CARD_W} ${card.height}`}
    >
      <Rect
        x={0}
        y={0}
        width={CARD_W}
        height={card.height}
        fill={CARD_COLORS.bg}
      />
      <Path d={card.qrPath} fill={CARD_COLORS.qr} />
      <SvgText
        x={CARD_W / 2}
        y={card.eyebrowY}
        fill={CARD_COLORS.eyebrow}
        fontSize={30}
        fontWeight="600"
        textAnchor="middle"
      >
        You are joining
      </SvgText>
      {card.nameLines.map((line, idx) => (
        <SvgText
          key={idx}
          x={CARD_W / 2}
          y={card.titleTop + idx * card.titleLineH}
          fill={CARD_COLORS.title}
          fontSize={48}
          fontWeight="700"
          textAnchor="middle"
        >
          {line}
        </SvgText>
      ))}
      {creatorName ? (
        <SvgText
          x={CARD_W / 2}
          y={card.subtextY}
          fill={CARD_COLORS.subtext}
          fontSize={28}
          textAnchor="middle"
        >
          {`${creatorName} • Group Admin`}
        </SvgText>
      ) : null}
      <SvgText
        x={CARD_W / 2}
        y={card.metaY}
        fill={CARD_COLORS.meta}
        fontSize={24}
        textAnchor="middle"
      >
        {card.metaText}
      </SvgText>
    </Svg>
  );
}

export default function GroupInviteSheet({
  isOpen,
  onClose,
  groupId,
  groupName,
  creatorName,
  inviteToken,
  inviteExpiresAt
}: {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  creatorName?: string;
  inviteToken: string;
  inviteExpiresAt?: string | null;
}) {
  const toast = useAppToast();
  const colorScheme = useColorScheme() ?? "light";
  const inviteUrl = buildInviteUrl(inviteToken);
  // Ref points at the hidden full-resolution card (below), not the small
  // on-screen preview — see handleDownloadQR.
  const exportRef = useRef<Svg>(null);
  const [expirationSheetOpen, setExpirationSheetOpen] = useState(false);

  const { isOnline } = useNetwork();
  const { isDegraded } = useNetworkHealth();
  const showNetworkBanner = !isOnline || isDegraded;

  // On-screen preview width (also drives export resolution via the shared
  // ref). Clamped so it fits small screens inside the sheet's padding.
  const previewW = Math.min(300, Dimensions.get("window").width - 96);

  const isExpired =
    !!inviteExpiresAt && new Date(inviteExpiresAt) <= new Date();

  const currentExpiryLabel = isExpired
    ? "Expired"
    : inviteExpiresAt
      ? format(new Date(inviteExpiresAt), "MMM d, yyyy")
      : "Never";

  // Compose the shareable card (QR + centered text). The same layout is
  // rendered as the preview and snapshotted for download — WYSIWYG.
  const card = useMemo((): InviteCardLayout => {
    let qrPath = "";
    let qrX = CARD_PAD;
    let qrBottom = CARD_PAD + QR_TARGET;
    try {
      const qr = QRCodeGen.create(inviteUrl, { errorCorrectionLevel: "M" });
      const { size, data } = qr.modules;
      const cell = Math.max(1, Math.floor(QR_TARGET / size));
      const pixels = cell * size;
      qrX = (CARD_W - pixels) / 2;
      qrBottom = CARD_PAD + pixels;
      qrPath = buildQrPath(data, size, cell, qrX, CARD_PAD);
    } catch {
      // Leave qrPath empty — download handler guards on it.
    }

    const nameLines = wrapName(groupName);
    const eyebrowY = qrBottom + 74;
    const titleTop = eyebrowY + 60;
    const titleLineH = 56;
    const titleBottom = titleTop + (nameLines.length - 1) * titleLineH;
    const subtextY = creatorName ? titleBottom + 48 : titleBottom;
    const metaY = subtextY + (creatorName ? 62 : 56);
    const height = metaY + CARD_PAD;

    let metaText: string;
    if (isExpired) {
      metaText = "This invite link has expired";
    } else if (inviteExpiresAt) {
      metaText = `Expires ${format(
        new Date(inviteExpiresAt),
        "MMM d, yyyy 'at' h:mm a"
      )}`;
    } else {
      metaText = "This invite link never expires";
    }

    return {
      qrPath,
      height,
      nameLines,
      eyebrowY,
      titleTop,
      titleLineH,
      subtextY,
      metaY,
      metaText
    };
  }, [inviteUrl, groupName, creatorName, inviteExpiresAt, isExpired]);

  const handleDownloadQR = () => {
    if (!exportRef.current || !card.qrPath) return;
    // Snapshot the hidden, off-screen card that is actually laid out at
    // CARD_W * EXPORT_SCALE. react-native-svg draws a view at its real
    // layout bounds (ignoring these width/height opts for content), so
    // the preview's small bounds would otherwise yield a tiny image.
    const exportW = CARD_W * EXPORT_SCALE;
    const exportH = Math.round(card.height * EXPORT_SCALE);
    exportRef.current.toDataURL(
      async (data: string) => {
        try {
          const filePath = `${FileSystem.cacheDirectory}ambagan-invite-qr.png`;
          await FileSystem.writeAsStringAsync(filePath, data, {
            encoding: FileSystem.EncodingType.Base64
          });
          await Sharing.shareAsync(filePath, {
            UTI: "public.image",
            mimeType: "image/png",
            dialogTitle: "Save QR Code"
          });
          toast({
            title: "QR code saved",
            description: "The invite QR code has been saved to your device.",
            type: "success"
          });
        } catch {
          toast({
            title: "Error",
            description: "Could not save QR code.",
            type: "error"
          });
        }
      },
      { width: exportW, height: exportH }
    );
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Join my group "${groupName}" on Ambagan PH!\n\n${inviteUrl}`,
        title: `Join ${groupName} on Ambagan PH`
      });

      if (result.action !== Share.sharedAction) return;

      // iOS reports the chosen activity; surface a "copied" confirmation when
      // the user tapped Copy. Android doesn't expose it, so fall back to a
      // generic "shared" message.
      const copied =
        result.activityType === "com.apple.UIKit.activity.CopyToPasteboard";
      toast({
        title: copied ? "Link copied" : "Invite link shared",
        description: copied
          ? "The invite link has been copied to your clipboard."
          : "Your group invite link has been shared.",
        type: "success"
      });
    } catch {
      // user dismissed share sheet — ignore
    }
  };

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[100]}>
        <ActionsheetContent className="p-0">
          {showNetworkBanner && (
            <Box className={Platform.OS === "android" ? "h-4" : "h-[2.2rem]"} />
          )}
          <VStack
            className={cn(
              "w-full flex-1",
              Platform.OS === "android" ? "pt-[3rem]" : "pt-[4.5rem]"
            )}
          >
            <HStack className="items-center justify-between w-full pt-4 px-4 pb-2">
              <Pressable onPress={onClose}>
                <HStack className="items-center">
                  <Icon as="arrow-back-ios" className="text-secondary-950" />
                  <Text bold className="text-xl">
                    Share Group
                  </Text>
                </HStack>
              </Pressable>
            </HStack>

            <ScrollView className="flex-1 px-4">
              <VStack className="gap-y-6 pb-6">
                <VStack className="gap-y-2">
                  <Text className="text-secondary-950">
                    Invite members by sharing the link to your group -{" "}
                    <Text bold>{groupName}</Text>. Anyone with the link can
                    join, so reset it if it's shared too widely.
                  </Text>
                </VStack>

                <Box className="items-center py-2">
                  <Box className="rounded-2xl overflow-hidden border border-secondary-500">
                    <InviteCardSvg
                      card={card}
                      creatorName={creatorName}
                      width={previewW}
                    />
                  </Box>

                  {isExpired && (
                    <HStack className="mt-4 gap-x-2 items-center">
                      <AlertCircle
                        size={16}
                        color={getErrorHex("text-error-500", colorScheme)}
                      />
                      <Text className="text-error-500 text-sm">
                        This link has expired — reset it to invite members.
                      </Text>
                    </HStack>
                  )}
                </Box>

                <HStack className="gap-x-2">
                  <FormButton
                    className="flex-1"
                    text="Share Invite Link"
                    onPress={handleShare}
                    disabled={isExpired}
                    icon={
                      <Share2
                        size={18}
                        color={getSecondaryHex("text-secondary-0", colorScheme)}
                      />
                    }
                  />
                  <FormButton
                    className="flex-1"
                    variant="outline"
                    text="Download QR"
                    onPress={handleDownloadQR}
                    disabled={isExpired}
                    icon={
                      <Download
                        size={18}
                        color={getPrimaryHex("text-primary-500", colorScheme)}
                      />
                    }
                  />
                </HStack>

                <Divider className="border-secondary-200" />

                <VStack className="gap-y-4">
                  <VStack>
                    <Text bold className="text-xl">
                      Reset invite link
                    </Text>
                    <Text className="text-sm text-secondary-950">
                      Generate a new link and QR. The current one stops working
                      immediately.
                    </Text>
                  </VStack>

                  <PressableListItem
                    className="p-4 border border-background-200 rounded-lg"
                    onPress={() => setExpirationSheetOpen(true)}
                  >
                    <HStack className="items-center justify-between">
                      <VStack className="flex-1">
                        <Text className="text-xl">Link Expiration</Text>
                        <Text className="text-sm text-secondary-950">
                          Currently set to: {currentExpiryLabel}
                        </Text>
                      </VStack>
                      <HStack className="items-center gap-x-2">
                        <Text bold className="text-primary-500">
                          Change
                        </Text>
                        <Icon as="chevron-right" className="text-primary-500" />
                      </HStack>
                    </HStack>
                  </PressableListItem>
                </VStack>
              </VStack>
            </ScrollView>

            {/* Off-screen full-resolution copy of the card, snapshotted by
                "Download QR". It must be genuinely laid out at export size
                because react-native-svg draws a view at its real bounds. */}
            <Box
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -100000,
                top: 0,
                opacity: 0
              }}
            >
              <InviteCardSvg
                card={card}
                creatorName={creatorName}
                width={CARD_W * EXPORT_SCALE}
                svgRef={exportRef}
              />
            </Box>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      <LinkExpirationSheet
        isOpen={expirationSheetOpen}
        onClose={() => setExpirationSheetOpen(false)}
        groupId={groupId}
      />
    </>
  );
}
