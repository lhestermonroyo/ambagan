import type { AmountTextSize } from "@/features/expense/utils/amountTextSize";
import type { SettlementView } from "@/types/user";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import { useColorScheme } from "nativewind";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { Box } from "./ui/box";
import { HStack } from "./ui/hstack";
import { VStack } from "./ui/vstack";

type BoneWidth = number | `${number}%`;

type Children = {
  children: React.ReactNode;
};

function useSkeletonColor() {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? "#2C2C2C" : "#E8E8E8";
}

function useSkeletonPulse() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, {
        duration: 850,
        easing: Easing.inOut(Easing.ease)
      }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);
  return useAnimatedStyle(() => ({
    opacity: opacity.value
  }));
}

function SkeletonFrame({
  children,
  className,
  label = "Loading content"
}: Children & {
  className?: string;
  label?: string;
}) {
  const animation = useSkeletonPulse();
  return (
    <Animated.View
      className={className}
      style={animation}
      pointerEvents="none"
      accessible
      accessibilityLabel={label}
      accessibilityState={{
        busy: true
      }}
    >
      {children}
    </Animated.View>
  );
}

function Bone({
  w,
  h,
  radius = 6,
  color
}: {
  w: BoneWidth;
  h: number;
  radius?: number;
  color: string;
}) {
  return (
    <View
      accessible={false}
      style={{
        width: w,
        maxWidth: "100%",
        height: h,
        flexShrink: 0,
        borderRadius: radius,
        backgroundColor: color
      }}
    />
  );
}

// Reserve the text's line height, including the space around its glyphs, so
// rows do not change height when their real content arrives.

const lineSizes = {
  xs: [16, 10],
  sm: [20, 12],
  md: [24, 14],
  lg: [28, 16],
  xl: [28, 18],
  "2xl": [32, 22],
  "3xl": [36, 26],
  "4xl": [40, 32]
} as const;

function Line({
  w,
  size = "md",
  color
}: {
  w: BoneWidth;
  size?: keyof typeof lineSizes;
  color: string;
}) {
  const [height, glyphHeight] = lineSizes[size];
  return (
    <View
      style={{
        width: w,
        maxWidth: "100%",
        height,
        justifyContent: "center",
        flexShrink: 1
      }}
    >
      <Bone w="100%" h={glyphHeight} color={color} />
    </View>
  );
}

function Surface({
  children,
  className
}: Children & {
  className?: string;
}) {
  return (
    <VStack
      className={cn("rounded-xl bg-secondary-100 overflow-hidden", className)}
    >
      {children}
    </VStack>
  );
}

function SkeletonDivider() {
  return <Box className="mx-4 h-px bg-secondary-200" />;
}

function Rows({
  count,
  children
}: {
  count: number;
  children: (index: number) => React.ReactNode;
}) {
  return Array.from(
    {
      length: count
    },
    (_, index) => (
      <React.Fragment key={index}>
        {index > 0 && <SkeletonDivider />}
        {children(index)}
      </React.Fragment>
    )
  );
}

function ChevronBone({ color }: { color: string }) {
  return (
    <Box className="w-6 h-6 items-center justify-center">
      <Bone w={8} h={14} radius={4} color={color} />
    </Box>
  );
}

function AvatarStack({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <HStack>
      {[0, 1].map((index) => (
        <View
          key={index}
          style={{
            marginLeft: index ? -10 : 0
          }}
        >
          <Bone w={size} h={size} radius={999} color={color} />
        </View>
      ))}
    </HStack>
  );
}

function SelectionRow({
  color,
  avatar = 48,
  split = false,
  compact = false
}: {
  color: string;
  avatar?: number;
  split?: boolean;
  compact?: boolean;
}) {
  return (
    <HStack
      className={cn(
        "p-4 gap-x-3 items-center",
        compact && "px-4 py-3 min-h-[76px]"
      )}
    >
      {split ? (
        <AvatarStack color={color} />
      ) : (
        <Bone w={avatar} h={avatar} radius={999} color={color} />
      )}
      <VStack className="flex-1 min-w-0">
        <Line w="40%" size="sm" color={color} />
        <Line w="65%" color={color} />
      </VStack>
      {split && <Line w={64} size="lg" color={color} />}
      <ChevronBone color={color} />
    </HStack>
  );
}

export function PayerFieldSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame>
      <Surface>
        <SelectionRow color={color} />
      </Surface>
    </SkeletonFrame>
  );
}

export function GroupCardSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame>
      <Surface>
        <SelectionRow color={color} />
        <SkeletonDivider />
        <SelectionRow color={color} compact />
        <SkeletonDivider />
        <SelectionRow color={color} split compact />
        <SkeletonDivider />
        <HStack className="p-4 items-center justify-between">
          <Line w="65%" color={color} />
          <ChevronBone color={color} />
        </HStack>
      </Surface>
    </SkeletonFrame>
  );
}

function AmountFieldBones({ color }: { color: string }) {
  return (
    <VStack className="items-center gap-y-2 py-4">
      <Bone w={88} h={32} radius={999} color={color} />
      <HStack className="w-full h-20 items-center gap-x-2">
        <Box className="w-10 items-center">
          <Bone w={20} h={28} color={color} />
        </Box>
        <Box className="flex-1 items-center">
          <Bone w="70%" h={48} color={color} />
        </Box>
        <Box className="w-10" />
      </HStack>
      <Box className="h-5" />
    </VStack>
  );
}

function DescriptionFieldBones({ color }: { color: string }) {
  return (
    <Surface className="px-4 py-3">
      <Box className="mb-2">
        <Line w={88} size="xs" color={color} />
      </Box>
      <Line w="70%" color={color} />
    </Surface>
  );
}

function OptionChipsBones({ color }: { color: string }) {
  return (
    <HStack className="items-center gap-x-2">
      {[80, 72, 60].map((width) => (
        <Bone key={width} w={width} h={36} radius={999} color={color} />
      ))}
      <Box className="flex-1" />
      <Bone w={36} h={36} radius={999} color={color} />
    </HStack>
  );
}

export function ExpenseFormStepSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="p-4 gap-y-6">
      <AmountFieldBones color={color} />
      <DescriptionFieldBones color={color} />
      <Surface>
        <SelectionRow color={color} />
        <SkeletonDivider />
        <SelectionRow color={color} split />
      </Surface>
      <OptionChipsBones color={color} />
    </SkeletonFrame>
  );
}

function BookFieldBones({
  color,
  showStatus = true
}: {
  color: string;
  showStatus?: boolean;
}) {
  return (
    <Surface>
      <SelectionRow color={color} />
      {showStatus && (
        <>
          <SkeletonDivider />
          <SelectionRow color={color} avatar={32} />
        </>
      )}
    </Surface>
  );
}

export function BookFieldSkeleton({
  showStatus = true
}: {
  showStatus?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame>
      <BookFieldBones color={color} showStatus={showStatus} />
    </SkeletonFrame>
  );
}

export function PersonalExpenseFormSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="gap-y-6">
      <AmountFieldBones color={color} />
      <DescriptionFieldBones color={color} />
      <BookFieldBones color={color} />
      <OptionChipsBones color={color} />
    </SkeletonFrame>
  );
}

export function HeaderActionSkeleton({ count = 1 }: { count?: number }) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="flex-row gap-x-6">
      {Array.from(
        {
          length: count
        },
        (_, index) => (
          <Bone key={index} w={24} h={24} radius={999} color={color} />
        )
      )}
    </SkeletonFrame>
  );
}

export function AmountSkeleton({
  size = "text-xl",
  tone = "default",
  width = 112
}: {
  size?: AmountTextSize;
  tone?: "default" | "onColor";
  width?: number;
}) {
  const color = useSkeletonColor();
  const lineSize =
    size === "text-base" ? "md" : (size.slice(5) as keyof typeof lineSizes);
  return (
    <SkeletonFrame label="Loading amount">
      <Line
        w={width}
        size={lineSize}
        color={tone === "onColor" ? "rgba(255,255,255,0.3)" : color}
      />
    </SkeletonFrame>
  );
}

export function MemberEditorSkeleton() {
  const color = useSkeletonColor();
  return (
    <VStack className="gap-y-4 pb-4">
      <SkeletonFrame className="gap-y-4" label="Loading members">
        <Box className="px-4 pt-4">
          <Line w={128} size="sm" color={color} />
        </Box>
        <HStack className="px-4 gap-x-4">
          {[0, 1, 2].map((index) => (
            <VStack key={index} className="items-center gap-y-2 p-2">
              <Bone w={48} h={48} radius={999} color={color} />
              <Line w={56} color={color} />
            </VStack>
          ))}
        </HStack>
        <Box className="px-4">
          <Line w="90%" size="sm" color={color} />
        </Box>
        <Box className="px-4">
          <Bone w="100%" h={44} radius={999} color={color} />
        </Box>
        <HStack className="px-4 gap-x-2">
          <Bone w={88} h={36} radius={999} color={color} />
          <Bone w={96} h={36} radius={999} color={color} />
        </HStack>
      </SkeletonFrame>
      <FriendListSkeleton selection count={3} />
    </VStack>
  );
}

export function FriendListSkeleton({
  count = 5,
  selection = false,
  showBalance = true
}: {
  count?: number;
  selection?: boolean;
  showBalance?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading people">
      <Rows count={count}>
        {() => (
          <HStack className="p-4 items-center gap-x-3">
            {selection && <Bone w={24} h={24} radius={4} color={color} />}
            <Bone w={48} h={48} radius={999} color={color} />
            <VStack className="flex-1 min-w-0">
              <Line w="70%" size="lg" color={color} />
              <Line w="90%" size="sm" color={color} />
            </VStack>
            <HStack className="items-center gap-x-3 shrink-0">
              {!selection && showBalance && (
                <Line w={56} size="lg" color={color} />
              )}
              <Bone
                w={selection ? 24 : 18}
                h={selection ? 24 : 18}
                radius={999}
                color={color}
              />
              {!selection && <ChevronBone color={color} />}
            </HStack>
          </HStack>
        )}
      </Rows>
    </SkeletonFrame>
  );
}

export function FriendCardListSkeleton({ count = 3 }: { count?: number }) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame
      className="flex-row gap-x-2 px-4 overflow-hidden"
      label="Loading friend balances"
    >
      {Array.from(
        {
          length: count
        },
        (_, index) => (
          <Surface key={index} className="w-48 shrink-0 rounded-lg p-4 gap-y-2">
            <Bone w={32} h={32} radius={999} color={color} />
            <VStack>
              <Line w={120} size="lg" color={color} />
              <Line w={80} size="lg" color={color} />
            </VStack>
          </Surface>
        )
      )}
    </SkeletonFrame>
  );
}

export function GroupListSkeleton({ count = 5 }: { count?: number }) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading groups">
      <Rows count={count}>
        {() => (
          <HStack className="p-4 items-center gap-x-3">
            <Bone w={48} h={48} radius={999} color={color} />
            <VStack className="flex-1 min-w-0">
              <Line w="75%" size="lg" color={color} />
              <Line w="90%" size="sm" color={color} />
            </VStack>
            <AvatarStack color={color} />
            <ChevronBone color={color} />
          </HStack>
        )}
      </Rows>
    </SkeletonFrame>
  );
}

export function ActionButtonsSkeleton({ count = 4 }: { count?: number }) {
  const color = "rgba(255,255,255,0.3)";
  return (
    <SkeletonFrame className="flex-row gap-x-2">
      {Array.from(
        {
          length: count
        },
        (_, index) => (
          <VStack
            key={index}
            className="flex-1 min-w-0 items-center gap-y-2 px-1"
          >
            <Bone w={56} h={56} radius={999} color={color} />
            <Line w="80%" size="sm" color={color} />
          </VStack>
        )
      )}
    </SkeletonFrame>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading notifications">
      <Rows count={count}>
        {() => (
          <HStack className="p-4 gap-x-3">
            <Bone w={48} h={48} radius={999} color={color} />
            <VStack className="flex-1 min-w-0 gap-y-1">
              <VStack>
                <Line w="100%" color={color} />
                <Line w="70%" color={color} />
              </VStack>
              <HStack className="items-center gap-x-2">
                <Line w={72} size="sm" color={color} />
                <Bone w={64} h={20} radius={999} color={color} />
              </HStack>
            </VStack>
            <HStack className="items-center">
              <Bone w={16} h={16} radius={999} color={color} />
              <ChevronBone color={color} />
            </HStack>
          </HStack>
        )}
      </Rows>
    </SkeletonFrame>
  );
}

function ProgressBones({ color }: { color: string }) {
  return (
    <VStack className="gap-y-2">
      <Line w="65%" size="sm" color={color} />
      <Bone w="100%" h={4} radius={999} color={color} />
    </VStack>
  );
}

function SettlementRowBones({
  color,
  view,
  showProgress = false
}: {
  color: string;
  view: SettlementView;
  showProgress?: boolean;
}) {
  return (
    <HStack className="p-4 gap-x-3 items-start">
      <Bone w={30} h={30} radius={999} color={color} />
      <VStack className="flex-1 min-w-0 gap-y-2">
        <HStack className="items-center justify-between gap-x-2">
          <Line w="55%" size="sm" color={color} />
          <Line w={56} size="sm" color={color} />
        </HStack>
        <HStack className="items-center gap-x-2">
          {view === "full" ? (
            <VStack className="flex-1 min-w-0">
              <Line w="85%" size="lg" color={color} />
              <Line w={32} size="sm" color={color} />
              <Line w="70%" size="lg" color={color} />
            </VStack>
          ) : view === "arrow" ? (
            <HStack className="flex-1 min-w-0 items-center gap-x-2">
              <Line w="35%" size="lg" color={color} />
              <Bone w={18} h={10} color={color} />
              <Line w="35%" size="lg" color={color} />
            </HStack>
          ) : (
            <Box className="flex-1 min-w-0">
              <Line w="90%" size="lg" color={color} />
            </Box>
          )}
          <VStack className="items-end gap-y-1 shrink-0">
            <Line w={72} size="lg" color={color} />
            {view === "full" && (
              <Bone w={84} h={24} radius={999} color={color} />
            )}
          </VStack>
          {view !== "full" && <Bone w={20} h={20} radius={999} color={color} />}
          <ChevronBone color={color} />
        </HStack>
        {showProgress && <ProgressBones color={color} />}
      </VStack>
    </HStack>
  );
}

export function SettlementListSkeleton({
  count = 4,
  view = "full",
  showProgress = false
}: {
  count?: number;
  view?: SettlementView;
  showProgress?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading settlements">
      <Rows count={count}>
        {() => (
          <SettlementRowBones
            color={color}
            view={view}
            showProgress={showProgress}
          />
        )}
      </Rows>
    </SkeletonFrame>
  );
}

function TransferCardBones({
  color,
  showProgress
}: {
  color: string;
  showProgress: boolean;
}) {
  return (
    <Surface className="rounded-2xl">
      <VStack className="p-6 gap-y-4 items-center">
        <HStack className="self-center items-start gap-x-2">
          <VStack className="w-20 items-center gap-y-2">
            <Bone w={64} h={64} radius={999} color={color} />
            <Line w={64} size="sm" color={color} />
          </VStack>
          <Box className="mt-4 h-8 w-8 items-center justify-center">
            <Bone w={24} h={12} color={color} />
          </Box>
          <VStack className="w-20 items-center gap-y-2">
            <Bone w={64} h={64} radius={999} color={color} />
            <Line w={64} size="sm" color={color} />
          </VStack>
        </HStack>
        <VStack className="w-full items-center gap-y-1">
          <Line w={160} size="sm" color={color} />
          {showProgress && <Line w={120} size="sm" color={color} />}
          <Line w="70%" size="4xl" color={color} />
          <Line w="60%" color={color} />
        </VStack>
        {showProgress && (
          <Box className="w-full">
            <ProgressBones color={color} />
          </Box>
        )}
      </VStack>
      <SkeletonDivider />
      <HStack className="p-4 items-center justify-between">
        <Line w="70%" color={color} />
        <ChevronBone color={color} />
      </HStack>
    </Surface>
  );
}

export type SettlementSkeletonVariant = "history" | "form" | "full";

export function SettlementDetailsSkeleton({
  variant = "history",
  showPaymentModes = true,
  showProgress = true,
  partial = false
}: {
  variant?: SettlementSkeletonVariant;
  showPaymentModes?: boolean;
  showProgress?: boolean;
  partial?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="gap-y-6" label="Loading payment details">
      <TransferCardBones color={color} showProgress={showProgress} />
      {variant === "form" ? (
        <>
          {showPaymentModes && (
            <HStack className="gap-x-2">
              {[0, 1].map((index) => (
                <Box key={index} className="flex-1">
                  <Bone w="100%" h={36} radius={999} color={color} />
                </Box>
              ))}
            </HStack>
          )}
          {partial && (
            <VStack className="gap-y-2">
              <Line w={120} color={color} />
              <Bone w="100%" h={56} radius={8} color={color} />
            </VStack>
          )}
          <VStack className="gap-y-2">
            <Line w={112} color={color} />
            <Bone w="100%" h={100} radius={8} color={color} />
          </VStack>
          <VStack className="gap-y-1">
            <Bone w="100%" h={128} radius={24} color={color} />
            <Line w="90%" size="sm" color={color} />
          </VStack>
        </>
      ) : variant === "full" ? (
        <>
          <Surface>
            <DetailRowBones color={color} />
            <SkeletonDivider />
            <DetailRowBones color={color} />
            <SkeletonDivider />
            <DetailRowBones color={color} />
          </Surface>
          <Surface>
            <DetailRowBones color={color} avatar />
            <SkeletonDivider />
            <DetailRowBones color={color} />
          </Surface>
        </>
      ) : (
        <>
          <VStack className="gap-y-2">
            <Line w={180} size="lg" color={color} />
            <Line w="90%" size="sm" color={color} />
          </VStack>
          {[0, 1].map((index) => (
            <Surface key={index} className="p-4">
              <HStack className="items-center gap-x-3">
                <VStack className="flex-1">
                  <Line w={96} size="lg" color={color} />
                  <Line w={112} size="sm" color={color} />
                </VStack>
                <Bone w={96} h={24} radius={999} color={color} />
                <ChevronBone color={color} />
              </HStack>
            </Surface>
          ))}
        </>
      )}
    </SkeletonFrame>
  );
}

function ExpenseRowBones({
  color,
  personal = false
}: {
  color: string;
  personal?: boolean;
}) {
  return (
    <HStack className="p-4 items-start gap-x-3">
      <Bone w={30} h={30} radius={999} color={color} />
      <HStack className="flex-1 min-w-0 items-center gap-x-2">
        <VStack className="flex-1 min-w-0">
          <Line w="85%" size="lg" color={color} />
          {personal ? (
            <Line w={88} size="sm" color={color} />
          ) : (
            <HStack className="items-center gap-x-1">
              <Line w={40} size="sm" color={color} />
              <AvatarStack color={color} size={24} />
              <Line w="30%" size="sm" color={color} />
            </HStack>
          )}
        </VStack>
        <VStack className="items-end gap-y-1 shrink-0">
          <Line w={72} size="lg" color={color} />
          {personal && <Bone w={64} h={20} radius={999} color={color} />}
        </VStack>
        <ChevronBone color={color} />
      </HStack>
    </HStack>
  );
}

export function ExpenseListSkeleton({
  count = 5,
  personal = false
}: {
  count?: number;
  personal?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading expenses">
      <Rows count={count}>
        {() => <ExpenseRowBones color={color} personal={personal} />}
      </Rows>
    </SkeletonFrame>
  );
}

export function RecurringListSkeleton({ count = 3 }: { count?: number }) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="px-4 gap-y-2" label="Loading recurring expenses">
      {Array.from(
        {
          length: count
        },
        (_, index) => (
          <VStack
            key={index}
            className="bg-background-50 rounded-lg p-4 gap-y-4"
          >
            <VStack className="gap-y-2">
              <HStack className="items-center gap-x-3">
                <Bone w={30} h={30} radius={999} color={color} />
                <Box className="flex-1">
                  <Line w="75%" size="lg" color={color} />
                </Box>
                <Bone w={64} h={24} radius={999} color={color} />
              </HStack>
              <Line w={128} size="2xl" color={color} />
            </VStack>
            <VStack className="gap-y-1">
              {["85%", "65%"].map((width) => (
                <HStack key={width} className="items-center gap-x-2">
                  <Bone w={16} h={16} radius={999} color={color} />
                  <Line w={width as BoneWidth} size="sm" color={color} />
                </HStack>
              ))}
            </VStack>
          </VStack>
        )
      )}
    </SkeletonFrame>
  );
}

function DetailRowBones({
  color,
  avatar = false,
  category = false,
  button = false
}: {
  color: string;
  avatar?: boolean;
  category?: boolean;
  button?: boolean;
}) {
  return (
    <HStack className="p-4 items-center justify-between gap-x-3">
      <Line w="35%" color={color} />
      <HStack className="items-center justify-end gap-x-3 flex-1 min-w-0">
        {(avatar || category) && (
          <Bone
            w={avatar ? 32 : 30}
            h={avatar ? 32 : 30}
            radius={999}
            color={color}
          />
        )}
        {button ? (
          <Bone w={104} h={40} radius={999} color={color} />
        ) : (
          <Line w={96} color={color} />
        )}
      </HStack>
    </HStack>
  );
}

function PersonRowBones({
  color,
  rank = false
}: {
  color: string;
  rank?: boolean;
}) {
  return (
    <HStack className="p-4 items-center gap-x-3">
      <Bone w={48} h={48} radius={999} color={color} />
      <VStack className="flex-1 min-w-0">
        <Line w="70%" size="lg" color={color} />
        <Line w="45%" size="sm" color={color} />
      </VStack>
      {rank ? (
        <Bone w={40} h={28} radius={999} color={color} />
      ) : (
        <Line w={72} size="lg" color={color} />
      )}
    </HStack>
  );
}

export function ExpenseDetailsSkeleton({
  recurring = false,
  personal = false
}: {
  recurring?: boolean;
  personal?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame
      className="py-4 gap-y-6"
      label={
        recurring
          ? "Loading recurring expense details"
          : "Loading expense details"
      }
    >
      <VStack className="px-4 gap-y-1">
        <HStack className="items-center justify-between">
          <Line w="60%" size="sm" color={color} />
          {recurring && <Bone w={64} h={20} radius={999} color={color} />}
        </HStack>
        <Line w={168} size="3xl" color={color} />
      </VStack>
      <Surface className="mx-4">
        <DetailRowBones color={color} category />
        <SkeletonDivider />
        <DetailRowBones color={color} />
        <SkeletonDivider />
        <DetailRowBones color={color} avatar={!recurring} />
        <SkeletonDivider />
        <DetailRowBones color={color} />
        <SkeletonDivider />
        <DetailRowBones color={color} button={!recurring} />
        {recurring && (
          <>
            <SkeletonDivider />
            <DetailRowBones color={color} />
            <SkeletonDivider />
            <DetailRowBones color={color} />
            {!personal && (
              <>
                <SkeletonDivider />
                <DetailRowBones color={color} />
                <SkeletonDivider />
                <DetailRowBones color={color} avatar />
              </>
            )}
          </>
        )}
      </Surface>
      {!personal &&
        [1, 3].map((count) => (
          <VStack key={count} className="gap-y-2">
            <Box className="px-4">
              <Line w={count === 1 ? 80 : 128} size="xl" color={color} />
            </Box>
            <Rows count={count}>{() => <PersonRowBones color={color} />}</Rows>
          </VStack>
        ))}
    </SkeletonFrame>
  );
}

function FilterBones({
  color,
  actions = false
}: {
  color: string;
  actions?: boolean;
}) {
  return (
    <HStack className="px-4 items-center justify-between h-10">
      <Bone w={88} h={36} radius={999} color={color} />
      {actions && (
        <HStack className="gap-x-6">
          {[0, 1, 2].map((index) => (
            <Bone key={index} w={24} h={24} radius={999} color={color} />
          ))}
        </HStack>
      )}
    </HStack>
  );
}

export function FilterBarSkeleton({
  actions = false,
  search = false
}: {
  actions?: boolean;
  search?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading filters">
      {search ? (
        <Box className="px-4">
          <Bone w="100%" h={40} radius={8} color={color} />
        </Box>
      ) : (
        <FilterBones color={color} actions={actions} />
      )}
    </SkeletonFrame>
  );
}

function BalanceCardBones({ color }: { color: string }) {
  return (
    <Surface className="p-4 gap-y-4">
      <VStack>
        <Line w={112} size="sm" color={color} />
        <Line w={168} size="3xl" color={color} />
      </VStack>
      <SkeletonDivider />
      <HStack className="gap-x-8">
        {[0, 1].map((index) => (
          <VStack key={index} className="flex-1 gap-y-2">
            <Line w="75%" size="sm" color={color} />
            <Line w="90%" size="2xl" color={color} />
          </VStack>
        ))}
      </HStack>
    </Surface>
  );
}

export function NetBalanceCardSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading net balance">
      <BalanceCardBones color={color} />
    </SkeletonFrame>
  );
}

function ContainerHeaderBones({ color }: { color: string }) {
  return (
    <HStack className="px-4 items-center gap-x-4">
      <Bone w={64} h={64} radius={999} color={color} />
      <VStack className="flex-1 min-w-0">
        <Line w="80%" size="2xl" color={color} />
        <Line w="95%" color={color} />
      </VStack>
    </HStack>
  );
}

function ContainerTabBones({
  color,
  personal = false,
  widths,
  fill = false,
  inset = true
}: {
  color: string;
  personal?: boolean;
  widths?: number[];
  fill?: boolean;
  inset?: boolean;
}) {
  return (
    <HStack className={cn("gap-x-2 overflow-hidden", inset && "px-4")}>
      {(widths ?? (personal ? [96, 72, 64] : [112, 96, 72, 88, 64])).map(
        (width, index) =>
          fill ? (
            <Box key={index} className="flex-1">
              <Bone w="100%" h={36} radius={999} color={color} />
            </Box>
          ) : (
            <Bone key={index} w={width} h={36} radius={999} color={color} />
          )
      )}
    </HStack>
  );
}

export function ContainerHeaderSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading group header">
      <ContainerHeaderBones color={color} />
    </SkeletonFrame>
  );
}

export function ContainerTabsSkeleton({
  widths,
  fill = false,
  inset = true
}: {
  widths?: number[];
  fill?: boolean;
  inset?: boolean;
} = {}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame label="Loading tabs">
      <ContainerTabBones
        color={color}
        widths={widths}
        fill={fill}
        inset={inset}
      />
    </SkeletonFrame>
  );
}

export function ContainerDetailsSkeleton({
  personal = false,
  tab = personal ? "Expenses" : "Settlements",
  settlementView = "full",
  showHeader = true
}: {
  personal?: boolean;
  tab?: string;
  settlementView?: SettlementView;
  showHeader?: boolean;
}) {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame
      className={cn("gap-y-6", showHeader && "py-4")}
      label={personal ? "Loading individual details" : "Loading group details"}
    >
      {showHeader && (
        <>
          <ContainerHeaderBones color={color} />
          <ContainerTabBones color={color} personal={personal} />
        </>
      )}
      {tab === "Stats" ? (
        <VStack className="gap-y-6">
          <FilterBones color={color} />
          <Box className="px-4">
            <GaugeCardBones color={color} />
          </Box>
        </VStack>
      ) : tab === "Info" ? (
        <Surface className="mx-4">
          <Rows count={5}>{() => <DetailRowBones color={color} />}</Rows>
        </Surface>
      ) : tab === "Members" ? (
        <Rows count={4}>{() => <PersonRowBones color={color} />}</Rows>
      ) : (
        <>
          {(personal || tab === "Settlements") && (
            <Box className="px-4">
              <BalanceCardBones color={color} />
            </Box>
          )}
          {tab === "Expenses" && (
            <Surface className="mx-4">
              <SelectionRow color={color} avatar={24} />
            </Surface>
          )}
          <FilterBones color={color} actions />
          <Box className="px-4 py-2 bg-background-50">
            <Line w={96} size="sm" color={color} />
          </Box>
          <Rows count={3}>
            {() =>
              tab === "Settlements" ? (
                <SettlementRowBones color={color} view={settlementView} />
              ) : (
                <ExpenseRowBones color={color} personal={personal} />
              )
            }
          </Rows>
        </>
      )}
    </SkeletonFrame>
  );
}

function StatColumns({ color, count = 3 }: { color: string; count?: number }) {
  return (
    <HStack className="gap-x-6">
      {Array.from(
        {
          length: count
        },
        (_, index) => (
          <VStack key={index} className="flex-1 min-w-0 gap-y-1">
            <Line w="75%" size="sm" color={color} />
            <Line w="90%" size="lg" color={color} />
          </VStack>
        )
      )}
    </HStack>
  );
}

function GaugeCardBones({
  color,
  rounded = false
}: {
  color: string;
  rounded?: boolean;
}) {
  return (
    <Surface className={cn("p-4 gap-y-4", rounded && "rounded-2xl")}>
      <HStack className="justify-between items-center">
        <Line w={88} size="sm" color={color} />
        <Line w={56} size="sm" color={color} />
      </HStack>
      <VStack className="gap-y-3">
        <View
          style={{
            width: "100%",
            aspectRatio: 280 / 138,
            overflow: "hidden"
          }}
        >
          <View
            style={{
              width: "100%",
              aspectRatio: 1,
              borderRadius: 999,
              borderWidth: 24,
              borderColor: color
            }}
          />
          <VStack className="absolute bottom-0 left-0 right-0 items-center">
            <Line w="45%" size="3xl" color={color} />
            <Line w={80} size="sm" color={color} />
          </VStack>
        </View>
        {["70%", "50%", "60%"].map((width) => (
          <HStack key={width} className="items-center gap-x-3">
            <Bone w={10} h={10} radius={999} color={color} />
            <Box className="flex-1">
              <Line w={width as BoneWidth} color={color} />
            </Box>
            <Line w={56} color={color} />
          </HStack>
        ))}
      </VStack>
      <SkeletonDivider />
      <StatColumns color={color} />
    </Surface>
  );
}

function BarRowsBones({ color, count = 3 }: { color: string; count?: number }) {
  return (
    <VStack className="gap-y-4">
      {Array.from(
        {
          length: count
        },
        (_, index) => (
          <VStack key={index} className="gap-y-2">
            <HStack className="justify-between items-center">
              <Line w="45%" color={color} />
              <Line w={64} color={color} />
            </HStack>
            <Bone w="100%" h={6} radius={999} color={color} />
          </VStack>
        )
      )}
    </VStack>
  );
}

function RankedListBones({ color }: { color: string }) {
  return (
    <Surface className="p-4 gap-y-4">
      <VStack>
        <Line w={144} size="sm" color={color} />
        <Line w="90%" size="sm" color={color} />
      </VStack>
      <VStack className="gap-y-3">
        {[0, 1, 2].map((index) => (
          <HStack key={index} className="items-center gap-x-3">
            <Line w={16} size="sm" color={color} />
            <VStack className="flex-1">
              <Line w="85%" color={color} />
              <Line w="65%" size="sm" color={color} />
            </VStack>
            <Line w={72} size="lg" color={color} />
          </HStack>
        ))}
      </VStack>
    </Surface>
  );
}

export function BookStatsSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="gap-y-6 pb-6" label="Loading spending statistics">
      <FilterBones color={color} />
      <VStack className="px-4 gap-y-4">
        <GaugeCardBones color={color} />
        <RankedListBones color={color} />
      </VStack>
    </SkeletonFrame>
  );
}

export function FriendStatsSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="gap-y-6 pb-6" label="Loading friend statistics">
      <FilterBones color={color} />
      <VStack className="px-4 gap-y-4">
        <Surface className="p-4 gap-y-4">
          <Line w={112} size="sm" color={color} />
          <Line w={168} size="3xl" color={color} />
          <SkeletonDivider />
          <StatColumns color={color} count={2} />
        </Surface>
        <Surface className="p-4 gap-y-4">
          <VStack>
            <Line w={96} size="sm" color={color} />
            <Line w="90%" size="sm" color={color} />
          </VStack>
          <StatColumns color={color} count={2} />
          <SkeletonDivider />
          <HStack className="justify-between">
            <Line w={112} size="sm" color={color} />
            <Line w={32} size="lg" color={color} />
          </HStack>
        </Surface>
        <Surface className="p-4 gap-y-4">
          <VStack>
            <Line w={80} size="sm" color={color} />
            <Line w="90%" size="sm" color={color} />
          </VStack>
          <BarRowsBones color={color} />
        </Surface>
        <RankedListBones color={color} />
        <VStack className="gap-y-4">
          <VStack className="gap-y-2">
            <Line w={160} color={color} />
            <Line w="100%" size="sm" color={color} />
            <Line w="80%" size="sm" color={color} />
          </VStack>
          <Bone w="100%" h={48} radius={999} color={color} />
        </VStack>
      </VStack>
    </SkeletonFrame>
  );
}

export function AnalyticsSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="gap-y-6" label="Loading analytics">
      <GaugeCardBones color={color} rounded />
      <VStack className="gap-y-2">
        <Line w={180} size="2xl" color={color} />
        <Surface className="rounded-2xl px-4 py-6 gap-y-6">
          {[0, 1, 2].map((index) => (
            <VStack key={index} className="gap-y-1">
              <HStack className="items-end justify-between">
                <VStack className="flex-1">
                  <Line w="65%" size="lg" color={color} />
                  <Line w="35%" size="sm" color={color} />
                </VStack>
                <Line w={80} size="lg" color={color} />
              </HStack>
              <Bone w="100%" h={8} radius={999} color={color} />
            </VStack>
          ))}
        </Surface>
      </VStack>
      <VStack className="gap-y-2">
        <Line w={96} size="2xl" color={color} />
        <Surface className="rounded-2xl p-4">
          <HStack className="h-24 items-end gap-x-1">
            {[24, 48, 36, 64, 40, 72, 52, 32, 48, 40, 56, 24].map(
              (height, index) => (
                <VStack key={index} className="flex-1 items-center gap-y-1">
                  <Bone w="100%" h={height} radius={4} color={color} />
                  <Line w="70%" size="sm" color={color} />
                </VStack>
              )
            )}
          </HStack>
        </Surface>
      </VStack>
      <VStack className="gap-y-2">
        <Line w={180} size="2xl" color={color} />
        <Surface className="rounded-2xl">
          <Rows count={3}>{() => <PersonRowBones color={color} rank />}</Rows>
        </Surface>
      </VStack>
    </SkeletonFrame>
  );
}

export function SubscriptionPlanSkeleton() {
  const color = useSkeletonColor();
  return (
    <SkeletonFrame className="gap-y-2" label="Loading subscription plans">
      <Line w={180} size="2xl" color={color} />
      {[0, 1, 2].map((index) => (
        <Surface
          key={index}
          className="rounded-2xl border border-secondary-100 p-4"
        >
          <HStack className="items-center justify-between gap-x-3">
            <VStack className="flex-1 min-w-0 gap-y-0.5">
              <HStack className="items-center gap-x-2">
                <Line w={80} size="lg" color={color} />
                {index === 2 && (
                  <Bone w={56} h={20} radius={999} color={color} />
                )}
              </HStack>
              <Line w="95%" size="sm" color={color} />
            </VStack>
            <HStack className="items-center gap-x-4">
              <Line w={72} size="xl" color={color} />
              <Bone w={20} h={20} radius={999} color={color} />
            </HStack>
          </HStack>
        </Surface>
      ))}
    </SkeletonFrame>
  );
}
