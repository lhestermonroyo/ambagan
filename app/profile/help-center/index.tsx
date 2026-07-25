import EmptyList from "@/components/EmptyList";
import SearchDrawer from "@/components/SearchDrawer";
import {
  Accordion,
  AccordionContent,
  AccordionContentText,
  AccordionHeader,
  AccordionIcon,
  AccordionItem,
  AccordionTitleText,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import InnerLayout from "@/layouts/InnerLayout";
import { EmptyType } from "@/types/general";
import { getPrimaryHex } from "@/utils/getColorHex";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Check,
  ChevronDownIcon,
  ChevronUpIcon,
  Search,
  X
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, ScrollView as RNScrollView } from "react-native";

// Section that the offline-message toasts deep-link into (?section=offline);
// its first FAQ opens and the screen scrolls to it. Keep in sync with the route
// used in useEnsureOnline.
const OFFLINE_SECTION_TITLE = "Offline Mode";

type FAQItem = {
  question: string;
  // Plain-text answer. Always set — it's what search matches against and the
  // default rendering. `content` may override how it's displayed.
  answer: string;
  // Optional rich rendering shown instead of the plain answer text (e.g. the
  // offline feature checklist). `answer` is still used for search.
  content?: ReactNode;
};
type FAQSection = { title: string; items: FAQItem[] };

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is Ambagan?",
        answer:
          "Ambagan is a group expense splitting app that helps you track shared costs, split bills fairly, and settle debts with friends, family, or colleagues."
      },
      {
        question: "How do I create an account?",
        answer:
          "Download the app, tap Sign Up, and fill in your name, email, and password. You can also add a phone number and profile photo during onboarding."
      },
      {
        question: "Is Ambagan free to use?",
        answer:
          "Yes. The core features are free — add up to 5 expenses per day, track balances, split bills, and settle up with friends at no cost. A Pro subscription is available (starting at ₱99 for 2 weeks) for unlimited daily expenses, draft expenses, recurring expenses, CSV export, spending analytics, multi-currency support, and more."
      },
      {
        question: "What does the Net Balance on the home screen mean?",
        answer:
          "The Net Balance on the home screen overview card is your total across all groups — how much you are owed (To Collect) minus how much you owe (To Pay). A positive number means you are owed more than you owe overall; a negative number means the opposite."
      },
      {
        question: "How do I search this Help Center?",
        answer:
          "Tap the magnifying glass in the top-right corner of the Help Center to open a search field, then type a keyword like 'draft', 'QR', or 'currency'. Ambagan filters the questions and answers as you type so you can jump straight to the topic you need."
      }
    ]
  },
  {
    title: "Groups",
    items: [
      {
        question: "How do I create a group?",
        answer:
          "Go to the Groups tab, tap Add Group, then choose Create Group. Give your group a name, pick a category (Trip, Household, etc.), add members, and hit Create."
      },
      {
        question: "Can I add members after a group is created?",
        answer:
          "Yes — the group admin can. Open the group, go to the Members section in the Group Details tab, and tap Edit Members to add or remove people. Only the admin sees the Edit Members option; other members can leave on their own but can't change the roster."
      },
      {
        question: "Why can't I remove a member from the group?",
        answer:
          "Members with pending or unpaid expenses are locked and cannot be removed until all their settlements are completed."
      },
      {
        question: "How do I archive or leave a group?",
        answer:
          "Open the group and tap the menu (⋮) in the top-right corner. Admins can archive the group; all members can choose to leave. Archived groups are hidden from your active list but all history is preserved."
      },
      {
        question: "How do I restore an archived group?",
        answer:
          "Go to the Groups tab and switch to the Archived filter. Swipe left on the group and tap the restore button, or open the group and tap the menu then select Unarchive. The group will move back to your active list."
      }
    ]
  },
  {
    title: "Inviting & Joining Groups",
    items: [
      {
        question: "How do I invite someone to my group?",
        answer:
          "Open the group and tap the share icon in the top-right corner (available to the group admin). Ambagan creates a unique invite link and a matching QR code for the group. Tap Share Invite Link to send it through any app, or Download QR to save the QR card as an image. Anyone with the link or QR can join, so only share it with people you want in the group."
      },
      {
        question: "How do I join a group I've been invited to?",
        answer:
          "There are three ways: tap the invite link someone shared with you (it opens Ambagan and adds you to the group), scan the group's QR code using Scan to Join, or upload a screenshot of the QR. Joining needs an internet connection. If you're not signed in yet, Ambagan remembers the invite and adds you to the group automatically right after you finish signing up."
      },
      {
        question: "How do I scan a QR code to join a group?",
        answer:
          "Go to the Groups tab, tap Add Group, then choose Scan to Join. Point your camera at the group's QR code and you'll be added automatically. You can turn on the flashlight for dim rooms, or tap Upload QR from Photos to join from a saved screenshot instead of using the camera. Ambagan will ask for camera permission the first time — allow it when prompted."
      },
      {
        question: "Can I download or print the group QR code?",
        answer:
          "Yes. On the Share Group screen, tap Download QR to save a clean, print-ready card showing the group name and who's inviting. It's saved as an image through your device's share sheet, so you can print it, post it in a chat, or add it to an event page for people to scan."
      },
      {
        question: "How do I reset a group's invite link?",
        answer:
          "Open the group, tap the share icon, then tap Link Expiration under 'Reset invite link'. Choose how long the new link stays valid — Never, 1 hour, 24 hours, or 7 days — and tap Reset Link. A brand-new link and QR are generated and the old one stops working immediately. Reset the link if it has been shared too widely. Only the group admin can reset it, and the group must be active (not archived)."
      },
      {
        question: "Why does it say the invite link has expired?",
        answer:
          "Invite links can be set to expire after a chosen time. Once expired, the link and QR stop working and the Share and Download buttons are disabled. The group admin can generate a fresh link anytime from the Share Group screen by resetting the invite link. If someone gave you a link that's invalid or expired, ask them to share a new one."
      }
    ]
  },
  {
    title: "Expenses",
    items: [
      {
        question: "How do I add an expense?",
        answer:
          "Tap Add Expense — from the action buttons on your home screen, or the + button inside a group. Enter the amount and a short description, and you're done: by default the bill is paid by you, split equally among everyone in the group, and dated today. You can adjust any of that before saving."
      },
      {
        question:
          "Is there still a separate Quick and Custom expense form?",
        answer:
          "No. Ambagan now has a single Add Expense screen that covers everything. It opens ready to save with smart defaults (paid by you, split equally, dated today), and you only open the Paid by or Edit Split rows when you want to change who paid or how the bill is divided. The old separate Quick Add and Custom expense forms have been merged into this one screen."
      },
      {
        question: "Can I choose who paid?",
        answer:
          "Yes. Add Expense defaults to you as the payer, but you can tap the Paid by row to open a member list and pick someone else — or split the payment across several people who each covered part of the bill."
      },
      {
        question: "How do I change the split, date, or attach a receipt?",
        answer:
          "It's all on the same screen. Tap Edit Split to divide the bill equally, by percentage, or by exact amounts (and to leave anyone out who isn't part of it). You can also change the date and attach a proof of payment image before you save."
      },
      {
        question: "What split types are available?",
        answer:
          "You can split expenses equally among all members, by a percentage you define per person, or with a fully custom amount for each participant. On the Add Expense screen, tap Edit Split to choose the split type."
      },
      {
        question: "Can I split an expense among only some members?",
        answer:
          "Yes. On the Add Expense screen, tap Edit Split, then tap the 'Split among' selector — it shows how many of the group's members are currently included (e.g. 'Split among 3 of 5'). Check the people who share this expense and uncheck anyone who doesn't, then tap Done. Use Select all / Unselect all to toggle everyone at once. Excluded members are left out, and the amount is divided only among those included. This works with equal, percentage, and custom splits; at least one member must be included."
      },
      {
        question: "Can I attach proof of payment to an expense?",
        answer:
          "Yes. On the Add Expense screen you can attach an image as proof of payment (e.g. a receipt or bank transfer screenshot) before saving."
      },
      {
        question: "Can I use different currencies?",
        answer:
          "Multi-currency is a Pro feature. With Pro, each expense can be set to a different currency — useful for travel groups — and you can set a default currency in Profile → Default Currency. Free expenses are in Philippine Peso (PHP)."
      },
      {
        question: "How are members shown in the expense detail?",
        answer:
          "When you open an expense, you are always listed first in both the Members Split and Payers' Contribution sections so your share and contribution are immediately visible without scrolling."
      },
      {
        question: "What is Save as Draft and how does it work?",
        answer:
          "Save as Draft is a Pro feature that lets you log an expense with just the amount and description, then finalize who paid and how to split it later. On the Add Expense screen, tap Save Draft instead of Add Expense. Draft expenses appear at the top of the group's Expenses tab with an amber Draft badge and are only visible to you until finalized. Tap a draft and press Finalize Expense to complete the split."
      },
      {
        question: "Can other group members see my draft expenses?",
        answer:
          "No. Draft expenses are private — only you (the creator) can see them until you finalize the split. Once finalized, the expense becomes visible to all group members and they receive an expense inclusion notification."
      },
      {
        question: "What are recurring expenses?",
        answer:
          "Recurring expenses are a Pro feature for bills that repeat — monthly rent, subscriptions, weekly groceries. On the Add Expense screen, set the amount, payers, and split as usual, then tap Repeat and choose a frequency (daily, weekly, or monthly), a start date, and an optional end (never, on a date, or after a number of times). Ambagan then posts the expense automatically on schedule — even if you don't open the app — and notifies everyone involved, just like a normal expense. If the start date is today or earlier, the first one posts immediately."
      },
      {
        question: "How do I pause, resume, or delete a recurring expense?",
        answer:
          "Open the group, tap the ⋯ menu in the top-right, and choose Recurring Expenses. There you'll see each series with its next run date. Toggle a series to pause or resume it, or delete it to stop future occurrences. Deleting a series never removes expenses it already created. If someone leaves the group and their share can no longer be split, that occurrence is posted as a draft for you to review instead."
      }
    ]
  },
  {
    title: "Scanning Receipts",
    items: [
      {
        question: "What is Scan Receipt?",
        answer:
          "Scan Receipt (Beta) lets you photograph a paper receipt and have Ambagan read the amount, description, and date for you, then drop them straight into the Add Expense screen — so you don't have to type them in. It's a faster way to log an expense when you have the receipt in hand."
      },
      {
        question: "How do I scan a receipt?",
        answer:
          "Tap Scan Receipt — from the action buttons on your home screen, or the + speed-dial inside a group. Take a photo of the receipt, or tap to pick one from your Photos. Ambagan reads it and fills in the amount, description, and date on the Add Expense screen; from there you set who paid and how to split, then save. You'll be asked for camera permission the first time — allow it when prompted."
      },
      {
        question: "Is scanning receipts free?",
        answer:
          "Yes. Scan Receipt is free for everyone while it's in beta, with no scan limit. The expense it creates still counts toward your 5-per-day limit on the free plan. Free scans read amounts in Philippine Peso (PHP); setting a different currency on a scanned expense is a Pro feature."
      },
      {
        question: "What if the scan gets a detail wrong?",
        answer:
          "Everything the scan fills in is fully editable, so always check the amount, description, and date on the Add Expense screen before saving. The receipt reader is smart but not perfect. If a receipt is blurry or can't be read, Ambagan simply opens a blank Add Expense form for you to fill in manually — it never blocks you."
      }
    ]
  },
  {
    title: "Settlements",
    items: [
      {
        question: "How do I settle a payment?",
        answer:
          "Go to the Settlements tab inside a group or open the friend's details from the Friends tab. Tap on a settlement entry and press Settle Up. The payer will be notified and can review and approve your request."
      },
      {
        question: "What happens after I request a settlement?",
        answer:
          "The payer receives a notification and can review your request. They can approve or reject it. Once approved, the amount is marked as settled."
      },
      {
        question: "Where can I see my settlement history?",
        answer:
          "Open any friend's detail page and switch to the History tab. You can also view settled payments in the Settlements tab of each group."
      },
      {
        question: "What is the Net Balance shown in the Settlements tab?",
        answer:
          "The Net Balance card at the top of the Settlements tab shows your current standing in the group — how much you're owed (To Collect) minus how much you owe (To Pay). A positive balance means you're owed more than you owe; a negative balance means the opposite."
      },
      {
        question: "What is the compact bar that appears when I scroll down?",
        answer:
          "When you scroll past the main balance card on the home screen, a group's Settlements tab, or a friend's detail page, a compact sticky bar appears at the top showing your Net Balance, To Collect, and To Pay amounts at a glance without having to scroll back up."
      }
    ]
  },
  {
    title: "Friends",
    items: [
      {
        question: "How do friends appear in Ambagan?",
        answer:
          "Anyone who is a member of a group you belong to automatically appears in your Friends tab. All group members are also silently saved to your Friends contact list so they are available when adding members to future groups — even if you didn't create the group."
      },
      {
        question: "What does the Friends tab show?",
        answer:
          "The Friends tab has two views. Balances shows everyone you share money with, along with the amount — use the All, To Collect, and To Pay filters to focus on who owes you or who you owe. Contacts is your full directory of people (favorites pinned at the top, then everyone else) for browsing or starting something new. Search at the top looks across both at once: matching people show their balance if they have one, or just their name if they don't."
      },
      {
        question: "How do I add someone as a favorite?",
        answer:
          "Tap the heart icon next to any person in the Friends tab — in either the Balances or Contacts view, or in search results. You can also tap the heart in the top-right corner of a friend's detail page. Your favorites are pinned to the top of the Contacts view for quick access."
      },
      {
        question: "What is the net balance shown on a friend's detail page?",
        answer:
          "The net balance at the top of a friend's detail page is the total amount you're owed by that person minus what you owe them, across all shared groups. It gives you a quick single-number summary of your overall standing with that friend."
      },
      {
        question: "How do I view payment history with a friend?",
        answer:
          "Tap on a friend's name in the Friends tab to open their detail page. You'll see your balance breakdown, shared groups, and full payment history with that person."
      }
    ]
  },
  {
    title: "Notifications",
    items: [
      {
        question: "What notifications will I receive?",
        answer:
          "You can receive alerts for settlement requests, approvals, rejections, completions, new expense inclusions, and group member changes. You can also enable a daily reminder that nudges you at 9 AM when you have unpaid settlements. Each type can be toggled individually in Profile → Push Notifications."
      },
      {
        question: "How are notifications organised?",
        answer:
          "Notifications are grouped by date — Today, Yesterday, and earlier dates — so it is easy to see what is recent and what is older at a glance."
      },
      {
        question: "How do I turn off notifications?",
        answer:
          "Go to Profile → Push Notifications. You can toggle individual notification types on or off depending on your preference."
      },
      {
        question: "What is the daily settlement reminder?",
        answer:
          "The daily settlement reminder is a local notification that fires every day at 9 AM if you have outstanding unpaid settlements. It is automatically cancelled once all your settlements are cleared. You can enable or disable it in Profile → Push Notifications → Reminders."
      },
      {
        question:
          "A notification shows a different status than when I received it — why?",
        answer:
          "Each notification is a record of what happened at the time — for example, 'requested a settlement.' The status badge on a settlement notification always reflects the settlement's current state, so if that request has since been approved, the notification shows a Settled badge. In short: the message is the history, and the badge is the live status."
      },
      {
        question: "What happens when I tap a settlement notification?",
        answer:
          "Tapping a settlement notification takes you straight to that exact settlement — it opens the settlement's details and highlights it in the list — so you can review or act on it right away without searching through your history. This works whether you tap it in the in-app Notifications list or a push notification on your lock screen."
      },
      {
        question: "Can I view my notifications without an internet connection?",
        answer:
          "Yes. Your most recent notifications are saved on your device, so you can open the Notifications screen and read them while offline. Loading older notifications and opening the settlement a notification links to still need a connection."
      }
    ]
  },
  {
    title: "Pro Plan",
    items: [
      {
        question: "What is the Pro plan?",
        answer:
          "Pro is a subscription that removes the daily expense limit and unlocks premium features: unlimited expenses per day, draft expenses (log now, split later), CSV export, spending analytics, multi-currency expenses, and a custom default currency. Plans start at ₱99 for 2 weeks, ₱149/month, or ₱799/year. Push notifications are free for everyone."
      },
      {
        question: "How do I upgrade to Pro?",
        answer:
          "Go to Profile → Subscription and choose a plan — 2 Weeks (₱99), Monthly (₱149), or Yearly (₱799). Tap Subscribe and complete the purchase through the App Store. All Pro features are unlocked immediately after subscribing."
      },
      {
        question: "How many expenses can I add per day on the free plan?",
        answer:
          "Free users can add up to 5 expenses per day, counted across all your groups combined. The counter resets at midnight. Upgrade to Pro (from ₱99) for unlimited daily expenses."
      },
      {
        question: "How do I export settlements to CSV?",
        answer:
          "CSV export is a Pro feature. After upgrading, open a group and go to the Stats tab. Select a date range, then tap Export CSV. The file includes all settlements you're involved in for that group within the selected range and will open your device's share sheet so you can save or send it."
      },
      {
        question: "What does the Stats tab show?",
        answer:
          "The Stats tab in a group shows your net balance (To Collect minus To Pay), total group spendings, and the CSV export button — all filtered by your selected date range. Use the date pills at the top to switch between 1D, 1W, 1M, 3M, 1Y, and All time."
      },
      {
        question:
          "I already paid — how do I restore my Pro access on a new device?",
        answer:
          "Go to Profile → Subscription and tap Restore Purchase. Your active subscription will be restored automatically through the App Store at no additional charge."
      }
    ]
  },
  {
    title: "Offline Mode",
    items: [
      {
        question: "Which features work offline and which need a connection?",
        answer:
          "You can keep using most of Ambagan without a connection, and actions you take offline sync automatically when you're back online. Works offline: viewing your groups, expenses, settlements, friends, and notifications from your last synced data; adding, editing, and deleting expenses (attached receipts sync on reconnect); saving an expense as a draft; creating a group and editing its name or category; archiving or restoring a group; adding or removing members if you're the admin; adding or removing favorites; changing the app appearance and settlement view; toggling the daily reminder; and sharing an invite link or downloading a group QR code. Needs a connection: settling up (request, approve, reject, or mark as settled); finalizing a draft; setting up or managing a recurring expense (pause, resume, or delete a series); joining a group or scanning a QR to join; scanning a receipt; resetting a group's invite link; leaving or permanently deleting a group; uploading a profile or group photo; editing your profile or account and changing your password; changing your default currency or notification preferences; and signing out. If you try something that needs a connection while offline, Ambagan shows a short message instead of leaving you stuck.",
        content: <OfflineFeatureList />
      },
      {
        question: "What happens when I lose internet connection?",
        answer:
          "A blue 'Offline Mode — Showing cached data' banner appears at the top, and you can keep using the app with your last synced data. Most actions work offline and sync automatically when you reconnect. A few things need a live connection — see the list of which features work offline above. You'll see a short message if you try one of those while offline."
      },
      {
        question: "Do my offline changes really get saved?",
        answer:
          "Yes. Expenses, group edits, member changes, and favorites you make offline are queued on your device and marked with a 'Syncing…' badge. As soon as you reconnect — or reopen the app while online — Ambagan sends them to the server in order and clears the badge. The queue survives closing and reopening the app, so nothing is lost if you stay offline for a while."
      }
    ]
  },
  {
    title: "Account & Settings",
    items: [
      {
        question: "How do I change my default currency?",
        answer:
          "Default currency is a Pro feature. After upgrading, go to Profile → Default Currency and select your preferred currency — it will be pre-selected when you create new expenses. Free accounts use Philippine Peso (PHP)."
      },
      {
        question: "How do I change the app appearance?",
        answer:
          "Go to Profile → App Appearance. You can switch between Light, Dark, or System (follows your device setting)."
      },
      {
        question: "What is the Settlement View setting?",
        answer:
          "Settlement View controls how settlement lists look throughout the app — on the home Recent Activity feed, a group's Settlements tab, and friends' detail pages. Go to Profile → Settlement View and pick Full for roomy cards with full member, payer, and status details, or Compact for dense two-line rows that fit more on screen at a glance. Your choice applies everywhere settlements are listed."
      },
      {
        question: "How do I update my name or profile photo?",
        answer:
          "Go to Profile → Personal Info. From there you can update your display name and upload a new profile photo."
      },
      {
        question: "How do I change my password?",
        answer:
          "Go to Profile → Account Settings → Change Password. Enter your current password and then your new password to update it."
      },
      {
        question: "I forgot my password. What do I do?",
        answer:
          "On the login screen, tap Forgot Password and enter your email. You'll receive a reset link to set a new password."
      },
      {
        question: "How do I sign out?",
        answer: "Scroll to the bottom of the Profile tab and tap Sign Out."
      },
      {
        question: "How do I delete my account?",
        answer:
          "Go to Profile → Account Settings → Delete My Account. If you have unsettled expenses, they will be listed and you will need to resolve them before deletion is allowed. Once deleted, your account is permanently removed — your name will appear as 'Deleted User' on any shared expense history so other members retain their records."
      },
      {
        question: "What do 'You receive' and 'You pay' mean in settlements?",
        answer:
          "'You receive' appears in the Mark as Settled sheet and shows the amount the other person is paying you. 'You pay' appears in the Request Settlement sheet and shows how much you owe. These labels reflect your perspective so it is always clear which direction the money moves."
      }
    ]
  }
];

// The offline capability matrix, kept in sync with the app's real offline
// behaviour (queue-and-sync vs. connection-required). Also mirrored in prose in
// the item's `answer` string so Help Center search can still find it.
const OFFLINE_CAPABLE: string[] = [
  "View groups, expenses, settlements, friends, and notifications (last synced data)",
  "Add, edit, and delete expenses — attached receipts sync on reconnect",
  "Save an expense as a draft",
  "Create a group and edit its name or category",
  "Archive or restore a group",
  "Add or remove members (group admin)",
  "Add or remove favorites",
  "Change app appearance (theme) and settlement view",
  "Toggle the daily settlement reminder",
  "Share an invite link or download a group QR code"
];

const OFFLINE_BLOCKED: string[] = [
  "Settle up — request, approve, reject, or mark as settled",
  "Finalize a draft expense",
  "Set up or manage a recurring expense (pause, resume, or delete a series)",
  "Join a group or scan a QR code to join",
  "Scan a receipt (the receipt reader needs a connection)",
  "Reset a group's invite link or change its expiration",
  "Leave a group, or permanently delete a group",
  "Upload a profile photo or group cover photo",
  "Edit your profile or account, or change your password",
  "Change your default currency or notification preferences",
  "Sign out"
];

function CapabilityRow({
  label,
  allowed,
  scheme
}: {
  label: string;
  allowed: boolean;
  scheme: "light" | "dark";
}) {
  const color = allowed
    ? scheme === "dark"
      ? "#66B584"
      : "#2A7948"
    : scheme === "dark"
      ? "#F96160"
      : "#DC2626";
  const GlyphIcon = allowed ? Check : X;

  return (
    <HStack className="gap-x-2 items-start">
      <GlyphIcon size={18} color={color} style={{ marginTop: 2 }} />
      <Text className="flex-1 text-base text-secondary-950">{label}</Text>
    </HStack>
  );
}

function OfflineFeatureList() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";

  return (
    <VStack className="gap-y-4 pt-1">
      <Text className="text-base text-secondary-950">
        You can keep using most of Ambagan without a connection. Actions you
        take offline are saved and sync automatically when you're back online.
        Here's the full breakdown:
      </Text>

      <VStack className="gap-y-2">
        <Text bold className="text-sm text-success-600 uppercase">
          Works offline
        </Text>
        <VStack className="gap-y-2">
          {OFFLINE_CAPABLE.map((label) => (
            <CapabilityRow
              key={label}
              label={label}
              allowed
              scheme={scheme}
            />
          ))}
        </VStack>
      </VStack>

      <VStack className="gap-y-2">
        <Text bold className="text-sm text-error-600 uppercase">
          Needs a connection
        </Text>
        <VStack className="gap-y-2">
          {OFFLINE_BLOCKED.map((label) => (
            <CapabilityRow
              key={label}
              label={label}
              allowed={false}
              scheme={scheme}
            />
          ))}
        </VStack>
      </VStack>

      <Text className="text-sm text-secondary-950">
        If you try something that needs a connection while offline, Ambagan shows
        a short message instead of leaving you stuck.
      </Text>
    </VStack>
  );
}

// A single titled FAQ section rendered as a bordered accordion card. Shared by
// the main list and the search results so the two never drift apart.
// `defaultOpen` pre-expands items by question (used for the deep-linked offline
// FAQ); `onLayout` lets the parent capture the section's Y to scroll to it.
function FaqSectionBlock({
  section,
  defaultOpen,
  onLayout
}: {
  section: FAQSection;
  defaultOpen?: string[];
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <VStack className="gap-y-2" onLayout={onLayout}>
      <Text bold className="text-secondary-950 uppercase text-sm">
        {section.title}
      </Text>
      <Box className="rounded-xl overflow-hidden border border-secondary-500">
        <Accordion
          size="lg"
          variant="unfilled"
          type="multiple"
          isCollapsible
          defaultValue={defaultOpen}
        >
          {section.items.map((item, index) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionHeader>
                <AccordionTrigger>
                  {({ isExpanded }: { isExpanded: boolean }) => (
                    <>
                      <AccordionTitleText className="flex-1 pr-2 text-base">
                        {item.question}
                      </AccordionTitleText>
                      <AccordionIcon
                        as={isExpanded ? ChevronUpIcon : ChevronDownIcon}
                        className="text-sm text-secondary-950"
                      />
                    </>
                  )}
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent>
                {item.content ?? (
                  <AccordionContentText className="text-secondary-950 text-base">
                    {item.answer}
                  </AccordionContentText>
                )}
              </AccordionContent>
              {index < section.items.length - 1 && (
                <Divider className="border-secondary-100" />
              )}
            </AccordionItem>
          ))}
        </Accordion>
      </Box>
    </VStack>
  );
}

export default function HelpCenterScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const tintColor = getPrimaryHex("text-primary-600", colorScheme ?? "light");

  // Deep link from the offline-message toasts: open + scroll to the Offline Mode
  // section's first FAQ.
  const { section } = useLocalSearchParams<{ section?: string }>();
  const deepLinkOffline = section === "offline";

  const scrollRef = useRef<RNScrollView>(null);
  const [offlineSectionY, setOfflineSectionY] = useState<number | null>(null);
  const didScrollRef = useRef(false);

  useEffect(() => {
    if (!deepLinkOffline || offlineSectionY == null || didScrollRef.current) {
      return;
    }
    didScrollRef.current = true;
    // Let the pre-expanded accordion content lay out before scrolling to it.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(offlineSectionY - 12, 0),
        animated: true
      });
    }, 350);
    return () => clearTimeout(t);
  }, [deepLinkOffline, offlineSectionY]);

  const [searchInput, setSearchInput] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  const isSearchActive = searchInput.trim().length > 0;

  // Keep only the sections (and items within them) whose question or answer
  // matches the query; drop any section left empty.
  const filteredSections = useMemo(() => {
    if (!isSearchActive) return [];
    const q = searchInput.toLowerCase().trim();
    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
      )
    })).filter((section) => section.items.length > 0);
  }, [isSearchActive, searchInput]);

  const resultCount = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.items.length, 0),
    [filteredSections]
  );

  const handleCancelSearch = () => {
    setSearchInput("");
    setSearchVisible(false);
  };

  return (
    <InnerLayout
      title="Help Center"
      onBack={() => router.back()}
      actions={
        <Stack.Toolbar.Button
          icon="magnifyingglass"
          tintColor={tintColor}
          accessibilityLabel="Search FAQs"
          onPress={() => setSearchVisible(true)}
        />
      }
      androidActions={
        <Pressable
          className="pr-1"
          aria-label="Search FAQs"
          onPress={() => setSearchVisible(true)}
        >
          <Search size={24} color={tintColor} />
        </Pressable>
      }
    >
      <ScrollView ref={scrollRef} className="flex-1">
        <VStack className="p-4 gap-y-6 pb-10">
          <Text className="text-sm text-secondary-950">
            Find answers to common questions below. If you need further help,
            contact us at{" "}
            <Text bold className="text-primary-400">
              lhester.monroyo.dev@gmail.com
            </Text>
            .
          </Text>

          {FAQ_SECTIONS.map((faqSection) => {
            const isOfflineTarget =
              deepLinkOffline && faqSection.title === OFFLINE_SECTION_TITLE;
            return (
              <FaqSectionBlock
                key={faqSection.title}
                section={faqSection}
                defaultOpen={
                  isOfflineTarget
                    ? [faqSection.items[0].question]
                    : undefined
                }
                onLayout={
                  isOfflineTarget
                    ? (e) => setOfflineSectionY(e.nativeEvent.layout.y)
                    : undefined
                }
              />
            );
          })}
        </VStack>
      </ScrollView>

      <SearchDrawer
        isOpen={searchVisible}
        onClose={() => setSearchVisible(false)}
        onCancel={handleCancelSearch}
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search FAQs"
      >
        {isSearchActive ? (
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <VStack className="p-4 gap-y-6">
              <Text className="text-sm text-secondary-950" bold>
                {resultCount} result{resultCount !== 1 ? "s" : ""}
              </Text>
              {resultCount > 0 ? (
                filteredSections.map((section) => (
                  <FaqSectionBlock key={section.title} section={section} />
                ))
              ) : (
                <EmptyList type={EmptyType.SEARCH} />
              )}
            </VStack>
          </ScrollView>
        ) : null}
      </SearchDrawer>
    </InnerLayout>
  );
}
