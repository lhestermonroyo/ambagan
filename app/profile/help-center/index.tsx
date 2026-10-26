import { useEmptyStatePreview } from "@/hooks/useEmptyStatePreview";
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
        question: "What Is Ambagan?",
        answer:
          "Ambagan helps you split shared expenses, keep track of who owes whom, and record settlements with friends, family, or colleagues. You can also track private spending in Individual entries, alongside your shared groups in the Groups tab."
      },
      {
        question: "How Do I Create an Account?",
        answer:
          "On the welcome screen, choose Login With Google or Login With Apple (on iOS), or tap Sign Up to create an account with email and password. New accounts complete three onboarding steps: name, phone number, and an optional profile photo. Already have an email account? Choose Login With Email to open the login form."
      },
      {
        question: "Is Ambagan Free to Use?",
        answer:
          "Yes. Create shared groups and private Individual entries, split bills, record settlements, scan receipts, link your private spending to a group, and receive notifications for free. Free accounts can add up to 5 group expenses and a separate 5 individual expenses per day. Pro removes both daily limits and unlocks drafts, recurring expenses, Spending Analytics, CSV export, and multi-currency. Choose a one-time 2-week pass or a monthly or yearly subscription."
      },
      {
        question: "What's the Difference Between Groups and Individual Entries?",
        answer:
          "Groups are for money shared with other people — you split a bill, everyone sees it, and balances are settled between you. Individual entries are for money that's only yours: individual expenses nobody else can see. Both live together in the Groups tab, and the home Overview covers both — the Net Balance page for what you owe and are owed, and the Individual Totals page for all your recorded individual expenses. An Individual entry can also be linked to a group so you can see what a trip cost you in total."
      },
      {
        question: "How Do I Find Groups and Individual Entries?",
        answer:
          "Open the Groups tab and switch between Groups and Individual. Each list is sorted by recent activity and remembers its filter. Groups has All, Created, Joined, and Archived filters; Individual has All and Archived. Search looks across both modes, so you can find shared groups and private entries from one place."
      },
      {
        question: "What Does the Net Balance on the Home Screen Mean?",
        answer:
          "The Net Balance on the home screen overview card is your total across all groups — how much you are owed (To Collect) minus how much you owe (To Pay). A positive number means you are owed more than you owe overall; a negative number means the opposite."
      },
      {
        question: "How Do I Search This Help Center?",
        answer:
          "Tap the magnifying glass in the top-right corner of the Help Center to open a search field, then type a keyword like 'draft', 'QR', or 'currency'. Ambagan filters the questions and answers as you type so you can jump straight to the topic you need."
      }
    ]
  },
  {
    title: "Groups",
    items: [
      {
        question: "How Do I Create a Group?",
        answer:
          "Go to the Groups tab, tap Add Group, then choose Create Group. Give your group a name, pick a category (Trip, Household, etc.), add members, and hit Create."
      },
      {
        question: "Can I Add Members After a Group Is Created?",
        answer:
          "Yes — any admin can. Open the group, go to its Members tab, and tap Edit to add or remove people. Only admins see that option; other members can leave on their own but can't change the roster."
      },
      {
        question: "Can a Group Have More Than One Admin?",
        answer:
          "Yes. The person who created the group is its owner, and they can make any member an admin: open the group, go to its Members tab, tap the ⋯ button next to their name, and choose Make admin. Admins can add or remove members and share or reset the invite link — handy when you don't want to be the only one keeping the roster up to date. They appear under the Admins tab, with you listed first as the owner. Editing the group's details, archiving it, deleting it, and choosing who's an admin stay with the owner. Admins can't remove each other; only the owner can, from the same ⋯ menu on the Admins tab."
      },
      {
        question: "What Happens to the Group if the Owner Leaves?",
        answer:
          "The owner has to hand the group over before they can leave — when they tap Leave Group they're asked to pick who takes over, with existing admins listed first. If they're the only member left, leaving deletes the group and all its data instead."
      },
      {
        question: "Can a Group Be in a Different Currency?",
        answer:
          "Yes, with Pro. Pick the group's currency when you create it, or change it later in Edit Group — a Japan trip can sit in JPY while your household group stays in PHP. The group's currency is used for its balances and Stats tab, and new expenses start in it. To start new expenses in a different currency while keeping the same reporting currency, set 'Default for new expenses' in Edit Group. On the free plan the picker stays locked to Philippine Peso (PHP)."
      },
      {
        question: "Why Can't I Remove a Member From the Group?",
        answer:
          "Members with pending or unpaid expenses are locked and cannot be removed until all their settlements are completed."
      },
      {
        question: "How Do I Archive or Leave a Group?",
        answer:
          "Open the group and tap the menu (⋮) in the top-right corner. The owner can archive the group; members can choose to leave once their unsettled balances are cleared. The owner must transfer ownership before leaving, unless they are the only member. Archived groups are hidden from your active list while their history is preserved."
      },
      {
        question: "How Do I Restore an Archived Group?",
        answer:
          "Go to the Groups tab, select Groups, tap the filter button, and choose Archived. Swipe left on the group and tap the restore button, or open the group and tap the menu then select Unarchive. The group will move back to your active list. Individual entries have their own list with the same Archived filter."
      }
    ]
  },
  {
    title: "Inviting & Joining Groups",
    items: [
      {
        question: "How Do I Invite Someone to My Group?",
        answer:
          "Open the group and tap the share icon in the top-right corner (available to the group's owner and its admins). Ambagan creates a unique invite link and a matching QR code for the group. Tap Share Invite Link to send it through any app, or Download QR to save the QR card as an image. Anyone with the link or QR can join, so only share it with people you want in the group."
      },
      {
        question: "How Do I Join a Group I've Been Invited to?",
        answer:
          "There are three ways: tap the invite link someone shared with you (it opens Ambagan and adds you to the group), scan the group's QR code using Scan to Join, or upload a screenshot of the QR. Joining needs an internet connection. If you're not signed in yet, Ambagan remembers the invite and adds you to the group automatically right after you finish signing up."
      },
      {
        question: "How Do I Scan a QR Code to Join a Group?",
        answer:
          "Go to the Groups tab, tap Add Group, then choose Scan to Join. Point your camera at the group's QR code and you'll be added automatically. You can turn on the flashlight for dim rooms, or tap Upload QR from Photos to join from a saved screenshot instead of using the camera. Ambagan will ask for camera permission the first time — allow it when prompted."
      },
      {
        question: "Can I Download or Print the Group QR Code?",
        answer:
          "Yes. On the Share Group screen, tap Download QR to save a clean, print-ready card showing the group name and who's inviting. It's saved as an image through your device's share sheet, so you can print it, post it in a chat, or add it to an event page for people to scan."
      },
      {
        question: "How Do I Reset a Group's Invite Link?",
        answer:
          "Open the group, tap the share icon, then tap Link Expiration under 'Reset invite link'. Choose how long the new link stays valid — Never, 1 hour, 24 hours, or 7 days — and tap Reset Link. A brand-new link and QR are generated and the old one stops working immediately. Reset the link if it has been shared too widely. Only the group's owner or an admin can reset it, and the group must be active (not archived)."
      },
      {
        question: "Why Does It Say the Invite Link Has Expired?",
        answer:
          "Invite links can be set to expire after a chosen time. Once expired, the link and QR stop working and the Share and Download buttons are disabled. The group's owner or an admin can generate a fresh link anytime from the Share Group screen by resetting the invite link. If someone gave you a link that's invalid or expired, ask them to share a new one."
      }
    ]
  },
  {
    title: "Expenses",
    items: [
      {
        question: "How Do I Add an Expense?",
        answer:
          "Tap Add Expense — from the action buttons on your home screen, or the + button inside a group. Enter the amount and a short description, and you're done: by default the bill is paid by you, split equally among everyone in the group, and dated today. You can adjust any of that before saving."
      },
      {
        question: "How Do I Customize an Expense?",
        answer:
          "The Add Expense screen starts with you as the payer, an equal split, and today's date. Tap Paid by to change who covered the bill, or Edit Split to choose the participants and divide it equally, by percentage, or by exact amounts. Use the options below to change the category or date, attach a receipt, or set up a recurring expense with Pro."
      },
      {
        question: "Can I Choose Who Paid?",
        answer:
          "Yes. Add Expense defaults to you as the payer, but you can tap the Paid by row to open a member list and pick someone else — or split the payment across several people who each covered part of the bill."
      },
      {
        question: "How Do I Change the Split, Date, or Attach a Receipt?",
        answer:
          "It's all on the same screen. Tap Edit Split to divide the bill equally, by percentage, or by exact amounts (and to leave anyone out who isn't part of it). You can also change the date and attach a proof of payment image before you save."
      },
      {
        question: "What Split Types Are Available?",
        answer:
          "You can split expenses equally among all members, by a percentage you define per person, or with a fully custom amount for each participant. On the Add Expense screen, tap Edit Split to choose the split type."
      },
      {
        question: "Can I Split an Expense Among Only Some Members?",
        answer:
          "Yes. On the Add Expense screen, tap Edit Split, then tap the 'Split among' selector — it shows how many of the group's members are currently included (e.g. 'Split among 3 of 5'). Check the people who share this expense and uncheck anyone who doesn't, then tap Done. Use Select all / Unselect all to toggle everyone at once. Excluded members are left out, and the amount is divided only among those included. This works with equal, percentage, and custom splits; at least one member must be included."
      },
      {
        question: "Can I Attach Proof of Payment to an Expense?",
        answer:
          "Yes. On the Add Expense screen you can attach an image as proof of payment (e.g. a receipt or bank transfer screenshot) before saving."
      },
      {
        question: "Can I Use Different Currencies?",
        answer:
          "Multi-currency is a Pro feature. With Pro, each group and Individual entry has its own currency — set it when you create or edit one — which becomes the default for new expenses there, and any single expense can still be switched to another currency. That's what makes a JPY trip group sit next to a PHP household Individual entry. Free groups, Individual entries, and expenses are in Philippine Peso (PHP)."
      },
      {
        question: "Where Are the Category, Date, and Receipt Fields?",
        answer:
          "The Add Expense screen keeps the essentials up front and collapses everything that already has a sensible default into a row of chips — Category, Date, Repeat, and the receipt upload. Tap a chip to jump straight to that field, or tap the chevron at the end of the row to expand them all under More options. Chips you've changed fill in with colour, so one glance shows what isn't on its default. When you edit an expense that already differs from the defaults, the options open for you automatically."
      },
      {
        question: "How Are Members Shown in the Expense Detail?",
        answer:
          "When you open an expense, you are always listed first in both the Members Split and Payers' Contribution sections so your share and contribution are immediately visible without scrolling."
      },
      {
        question: "What Is Save as Draft and How Does It Work?",
        answer:
          "Save as Draft is a Pro feature that lets you log an expense with just the amount and description, then finalize who paid and how to split it later. On the Add Expense screen, tap Save Draft instead of Add Expense. Draft expenses appear at the top of the group's Expenses tab with an amber Draft badge and are only visible to you until finalized. Tap a draft and press Finalize Expense to complete the split."
      },
      {
        question: "Can Other Group Members See My Draft Expenses?",
        answer:
          "No. Draft expenses are private — only you (the creator) can see them until you finalize the split. Once finalized, the expense becomes visible to all group members and they receive an expense inclusion notification."
      },
      {
        question: "What Are Recurring Expenses?",
        answer:
          "Recurring expenses are a Pro feature for bills that repeat — monthly rent, subscriptions, weekly groceries. On the Add Expense screen, set the amount, payers, and split as usual, then tap Repeat and choose a frequency (daily, weekly, or monthly), a start date, and an optional end (never, on a date, or after a number of times). Ambagan then posts the expense automatically on schedule — even if you don't open the app — and notifies everyone involved, just like a normal expense. If the start date is today or earlier, the first one posts immediately."
      },
      {
        question: "How Do I Pause, Resume, or Delete a Recurring Expense?",
        answer:
          "Open the group, tap the ⋯ menu in the top-right, and choose Recurring Expenses. There you'll see each series with its next run date. Toggle a series to pause or resume it, or delete it to stop future occurrences. Deleting a series never removes expenses it already created. If someone leaves the group and their share can no longer be split, that occurrence is posted as a draft for you to review instead."
      }
    ]
  },
  {
    title: "Individual Mode",
    items: [
      {
        question: "What Are Individual Entries?",
        answer:
          "Individual entries are where you track the spending that isn't split with anyone — your own coffee, groceries, rent, or a trip's personal extras. Open the Groups tab, tap Create Group, select Individual mode, and create an entry (e.g. Daily, Japan Trip, Household), then log individual expenses inside it. An Individual entry belongs to you alone: nobody can be added to it, and no group member can see what's in it. Groups are for shared bills; Individual entries are for the rest of your money."
      },
      {
        question: "How Do I Create an Individual Entry?",
        answer:
          "Go to the Groups tab, tap +, choose Create Group, then select Individual mode. Enter a name (e.g. Daily or Japan Trip), pick a category and an optional cover photo, and set a currency (Pro) if needed. Tap Create. You can link it to a shared group later in Edit. There's no limit on how many Individual entries you can have, on either plan."
      },
      {
        question: "Can I Change an Entry's Mode After Creating It?",
        answer:
          "No. Choose Group for shared bills or Individual for private spending when you create the entry. Its mode stays fixed. You can create a separate entry in the other mode and link an Individual entry to a group when you want a combined view of your spending."
      },
      {
        question: "How Do I Add an Individual Expense?",
        answer:
          "Two ways. From the home screen, tap Add Expense and choose 'Individual expense' — the form opens on your most recent Individual entry, and you can switch Individual entries from the Individual row. Or open an Individual entry from the Groups tab and tap Add Expense inside it. Enter the amount and a description and you're done; category, date, status, currency, and a receipt photo are all optional."
      },
      {
        question: "Can Anyone Else See My Individual Expenses?",
        answer:
          "No. Individual entries and everything in them are private to your account. They are never shared with a group, and linking an Individual entry to a group doesn't expose it either — group members only ever see group expenses."
      },
      {
        question:
          "How Many Individual Expenses Can I Add per Day on the Free Plan?",
        answer:
          "Free accounts can add up to 5 individual expenses per day. That's a separate allowance from the 5 group expenses per day, so on the free plan you get both. Each counter resets at midnight. Pro removes both limits."
      },
      {
        question: "What Do Paid and Pending Mean on an Individual Expense?",
        answer:
          "Paid means the money is already out. Pending is an upcoming or unpaid bill you want logged early. Tap the status pill on an expense to flip between the two, or set it in the Status row on the form. In an Individual entry you can filter the list by All, Pending, or Paid. The total expenses card includes every recorded expense, paid or pending. The home Individual Totals overview shows all recorded expenses across every Individual entry, including archived entries, with separate Paid and Pending totals. Category analytics show paid spend."
      },
      {
        question: "Can an Individual Entry Use a Different Currency?",
        answer:
          "An Individual entry's currency is a Pro feature. With Pro you can set it when creating or editing the Individual entry — it is used for totals and stats, and new expenses start in it. In Edit Individual, you can set 'Default for new expenses' to a different currency. Each expense can also be switched to another currency. Free Individual entries are in Philippine Peso (PHP)."
      },
      {
        question: "Why Do Some Totals Show a ≈ Sign?",
        answer:
          "≈ means the figure mixes currencies and part of it was converted at an approximate rate. A spending total or the Overview's Individual Totals has to be a single number, so foreign spend is folded in using indicative rates that Ambagan refreshes weekly. Tap the currency chip next to any ≈ figure to see the exact amount per currency, what each one converts to, and the date of the rates used. Individual settlement amounts stay in their original currency. Combined balance summaries may use approximate conversions, but those summaries do not change the currency or amount to repay. If a currency has no rate available it's left out of the total, and the card tells you so instead of quietly dropping it."
      },
      {
        question: "What Does Linking an Individual Entry to a Group Do?",
        answer:
          "It answers 'what did this trip actually cost me'. Pick a group under 'Linked group (optional)' when creating or editing an Individual entry, and Ambagan adds your share of that group's expenses to the Individual entry's total — always shown as two lines that visibly add up (this Individual entry, plus your share of the group), never one blended figure. Your individual expenses stay private, and nothing about the Individual entry is shown to the group. You can link one Individual entry per group, and your share means what you consumed, not what you fronted for others."
      },
      {
        question: "Where Do I See the Combined Total for a Trip?",
        answer:
          "Both sides show it. In the Individual entry, open the Stats tab and look for the Trip/Household/Combined total card. In the group, open the Stats tab and switch to the You view — if no Individual entry is linked yet, that card offers 'Link an Individual entry'. The group side totals in the group's currency, the Individual entry side in the Individual entry's."
      },
      {
        question: "Can an Individual Expense Repeat Automatically?",
        answer:
          "Yes, with Pro. On the Individual Add Expense screen, tap the Repeat row and choose a frequency (daily, weekly, or monthly), a start date, and an optional end. Ambagan then posts that expense into the Individual entry on schedule — even if the app is closed — and notifies you. To manage a series, open the Individual entry's Expenses tab and tap the Recurring Expenses card, where you can pause, resume, or delete any series. Deleting a series never removes the expenses it already created."
      },
      {
        question: "What Does an Individual Entry's Stats Tab Show?",
        answer:
          "Total Spent for the selected date range as a category gauge — one headline figure plus where the money actually went — with pending, the expense count, and your average expense underneath, followed by the expenses themselves. Use the date range pill at the top to change the period and the currency chip to see exact per-currency amounts. If the Individual entry is linked to a group, the combined total card sits here too."
      },
      {
        question: "Can I Scan a Receipt Into an Individual Entry?",
        answer:
          "Yes. Tap Scan Receipt on the home screen and choose 'Individual expense' when asked what you're adding, or tap Scan Receipt inside an Individual entry. Ambagan reads the amount, description, and date and fills them into the Individual Add Expense form for you to check and save."
      },
      {
        question: "How Do I Archive or Delete an Individual Entry?",
        answer:
          "Swipe left on an Individual entry in the Groups tab, or open the Individual entry and use the ⋯ menu in the top-right. Archiving hides the Individual entry while keeping everything in it — switch to the Archived filter to find it and restore it. Deleting is permanent and removes the Individual entry together with all of its expenses, so archive instead if you might want the history later."
      }
    ]
  },
  {
    title: "Scanning Receipts",
    items: [
      {
        question: "What Is Scan Receipt?",
        answer:
          "Scan Receipt lets you photograph a paper receipt and have Ambagan read the amount, description, and date for you, then drop them straight into the Add Expense screen — so you don't have to type them in. It's a faster way to log an expense when you have the receipt in hand."
      },
      {
        question: "How Do I Scan a Receipt?",
        answer:
          "Tap Scan Receipt — from the action buttons on your home screen, or the + speed-dial inside a group. Take a photo of the receipt, or tap to pick one from your Photos. Ambagan reads it and fills in the amount, description, and date on the Add Expense screen; from there you set who paid and how to split, then save. You'll be asked for camera permission the first time — allow it when prompted."
      },
      {
        question: "Is Scanning Receipts Free?",
        answer:
          "Yes. Scan Receipt is free for everyone, with no scan limit. The expense it creates still counts toward your 5-per-day limit on the free plan. Free scans read amounts in Philippine Peso (PHP); setting a different currency on a scanned expense is a Pro feature."
      },
      {
        question: "What if the Scan Gets a Detail Wrong?",
        answer:
          "Everything the scan fills in is fully editable, so always check the amount, description, and date on the Add Expense screen before saving. The receipt reader is smart but not perfect. If a receipt is blurry or can't be read, Ambagan simply opens a blank Add Expense form for you to fill in manually — it never blocks you."
      }
    ]
  },
  {
    title: "Settlements",
    items: [
      {
        question: "How Do I Settle a Payment?",
        answer:
          "Tap a settlement in a group, friend details, or Recent Settlements. Pay in Full is selected by default: use Request Settled if you owe the money, or Mark Settled if you received a full payment. Only the sender can choose Pay Partially or record remaining payments. The recipient confirms or rejects each request in Payment History. Notes and proof are optional. Ambagan tracks payments; arrange the actual transfer with the other person."
      },
      {
        question: "What Happens After I Request a Settlement?",
        answer:
          "For a full payment, the recipient opens Review Settlement and chooses Approve or Reject. You can Undo Request while it awaits review. For a partial payment, the recipient confirms or rejects the individual payment in Settlement Details, and you can withdraw a pending request. Only confirmed amounts reduce the balance; the settlement is fully paid when the entire amount is confirmed."
      },
      {
        question: "Where Can I See My Settlement History?",
        answer:
          "Open a settlement from a group, friend details, or Recent Activity. All settlement forms and review screens open fullscreen. Full payments use Review Settlement with the dates, participants, notes, and proof. Settlements that used partial payments open Settlement Details with the remaining balance and payment history. Expand an entry to see its details. That history stays available after the final payment."
      },
      {
        question: "Can I Pay My Share in Parts?",
        answer:
          "Yes, on the free plan too. Choose Pay Partially and enter an amount below the remaining balance. Only confirmed payments reduce what you owe. To finish, tap Pay Remaining and choose Pay in Full. Requested, rejected, and withdrawn amounts do not reduce the balance."
      },
      {
        question: "Can a Confirmed Payment Be Reopened?",
        answer:
          "For a full payment, the recipient uses Revert in Review Settlement. For a partial payment, expand the confirmed entry in Settlement Details and choose Reopen payment. Its amount returns to the remaining balance and awaits confirmation again. Notes and proof are kept. Resolve any existing pending request before reopening another payment."
      },
      {
        question: "What Is the Net Balance Shown in the Settlements Tab?",
        answer:
          "The Net Balance card at the top of the Settlements tab shows your current standing in the group — how much you're owed (To Collect) minus how much you owe (To Pay). A positive balance means you're owed more than you owe; a negative balance means the opposite."
      },
      {
        question: "What Is the Compact Bar That Appears When I Scroll Down?",
        answer:
          "When you scroll past the main balance card on the home screen, a group's Settlements tab, or a friend's detail page, a compact sticky bar appears at the top showing your Net Balance, To Collect, and To Pay amounts at a glance without having to scroll back up."
      }
    ]
  },
  {
    title: "Friends",
    items: [
      {
        question: "How Do Friends Appear in Ambagan?",
        answer:
          "Anyone who is a member of a group you belong to automatically appears in your Friends tab. All group members are also silently saved to your Friends contact list so they are available when adding members to future groups — even if you didn't create the group."
      },
      {
        question: "What Does the Friends Tab Show?",
        answer:
          "The Friends tab has two views. Balances shows everyone you share money with, along with the amount — use the All, To Collect, and To Pay filters to focus on who owes you or who you owe. Contacts is your full directory of people (favorites pinned at the top, then everyone else) for browsing or starting something new. Search at the top looks across both at once: matching people show their balance if they have one, or just their name if they don't."
      },
      {
        question: "How Do I Add Someone as a Favorite?",
        answer:
          "Tap the heart icon next to any person in the Friends tab — in either the Balances or Contacts view, or in search results. You can also tap the heart in the top-right corner of a friend's detail page. Your favorites are pinned to the top of the Contacts view for quick access."
      },
      {
        question: "What Is the Net Balance Shown on a Friend's Detail Page?",
        answer:
          "The net balance at the top of a friend's detail page is the total amount you're owed by that person minus what you owe them, across all shared groups. It gives you a quick single-number summary of your overall standing with that friend."
      },
      {
        question: "How Do I View Payment History With a Friend?",
        answer:
          "Tap on a friend's name in the Friends tab to open their detail page. You'll see your balance breakdown, shared groups, and full payment history with that person."
      }
    ]
  },
  {
    title: "Notifications",
    items: [
      {
        question: "What Notifications Will I Receive?",
        answer:
          "You can receive alerts for settlement requests, approvals, rejections, completions, new expense inclusions, group member changes, and recurring expenses that post automatically. You can also enable a daily reminder that nudges you at 9 AM when you have unpaid settlements. Each type can be toggled individually in Profile → Push Notifications."
      },
      {
        question: "Will I Be Notified When a Recurring Expense Posts?",
        answer:
          "Yes. When Ambagan posts an occurrence of one of your recurring series — in a group or in an Individual entry — you get a notification saying it was added, with a tap-through to the expense. If a group occurrence can't be split (for example a member left the group), it's posted as a draft instead and you're notified to review it. Notifications are grouped into one per series per run, so a series catching up on several missed periods can't flood you. Turn them off in Profile → Push Notifications → Recurring Expenses."
      },
      {
        question: "How Are Notifications Organised?",
        answer:
          "Notifications are grouped by date — Today, Yesterday, and earlier dates — so it is easy to see what is recent and what is older at a glance."
      },
      {
        question: "How Do I Turn Off Notifications?",
        answer:
          "Go to Profile → Push Notifications. You can toggle individual notification types on or off depending on your preference."
      },
      {
        question: "What Is the Daily Settlement Reminder?",
        answer:
          "The daily settlement reminder is a local notification that fires every day at 9 AM if you have outstanding unpaid settlements. It is automatically cancelled once all your settlements are cleared. You can enable or disable it in Profile → Push Notifications → Reminders."
      },
      {
        question:
          "A Notification Shows a Different Status Than When I Received It — Why?",
        answer:
          "Each notification is a record of what happened at the time — for example, 'requested a settlement.' The status badge on a settlement notification always reflects the settlement's current state, so if that request has since been approved, the notification shows a Settled badge. In short: the message is the history, and the badge is the live status."
      },
      {
        question: "What Happens When I Tap a Settlement Notification?",
        answer:
          "Tapping a settlement notification takes you straight to that exact settlement — it opens the settlement's details and highlights it in the list — so you can review or act on it right away without searching through your history. This works whether you tap it in the in-app Notifications list or a push notification on your lock screen."
      },
      {
        question: "Can I View My Notifications Without an Internet Connection?",
        answer:
          "Yes. Your most recent notifications are saved on your device, so you can open the Notifications screen and read them while offline. Loading older notifications and opening the settlement a notification links to still need a connection."
      }
    ]
  },
  {
    title: "Pro Plan",
    items: [
      {
        question: "What Is the Pro Plan?",
        answer:
          "Pro removes both daily expense limits and unlocks draft expenses, recurring expenses in groups and Individual entries, Spending Analytics, CSV settlement export, and multi-currency with separate defaults for new expenses. Choose a one-time 2-week pass (₱99), a monthly subscription (₱149), or a yearly subscription (₱799). Basic Individual tracking, linked spending totals, receipt scanning, and notifications are free for everyone."
      },
      {
        question: "What Is Spending Analytics?",
        answer:
          "Spending Analytics is a Pro screen at Profile → Spending Analytics that pulls your whole spending picture into one place for a date range you choose. It shows your total spend, where it went by group and Individual entry, a trend chart over time, who you spend with most, and how much you fronted for others versus your own share. Use the All / Groups / Individual toggle at the top to look at both halves of the app together or one at a time."
      },
      {
        question: "How Do I Upgrade to Pro?",
        answer:
          "Go to Profile → Subscription and choose 2 Weeks, Monthly, or Yearly. Tap Get Pro for the 2-week pass or Subscribe for a monthly or yearly plan, then complete the App Store purchase. All plans unlock the same Pro features for the duration of your access. The 2-week pass is a one-time purchase and does not renew automatically; monthly and yearly subscriptions auto-renew until cancelled."
      },
      {
        question: "Does Pro Renew Automatically?",
        answer:
          "The 2-week pass gives you 14 days of Pro without auto-renewal. Monthly and yearly subscriptions renew automatically unless cancelled through your App Store subscription settings. You can open those settings from Profile → Subscription → Manage Subscription. All three options include the same Pro features while your access is active."
      },
      {
        question: "How Many Expenses Can I Add per Day on the Free Plan?",
        answer:
          "Free users can add up to 5 group expenses per day, counted across all your groups combined, plus a separate 5 individual expenses per day across your Individual entries. Both counters reset at midnight. Upgrade to Pro (from ₱99) for unlimited daily expenses."
      },
      {
        question: "How Do I Export Settlements to CSV?",
        answer:
          "CSV export is a Pro feature. After upgrading, open a group and go to the Stats tab. Select a date range, then tap Export CSV. The file includes all settlements you're involved in for that group within the selected range and will open your device's share sheet so you can save or send it."
      },
      {
        question: "What Does the Stats Tab Show?",
        answer:
          "A group's Stats tab has Group and You views for the selected date range. Group shows total group spending, a category breakdown, expense count, average expense, and the expense list. You focuses on your own share and can show a combined total with a linked Individual entry. Pro also unlocks settlement export as CSV. An Individual entry's Stats tab shows your private spending by category, pending expenses, expense count, and average expense."
      },
      {
        question:
          "I Already Paid — How Do I Restore My Pro Access on a New Device?",
        answer:
          "Sign in to the same Ambagan account, go to Profile → Subscription, and tap Restore in the top-right corner to restore an active monthly or yearly App Store subscription. A 2-week pass is a one-time purchase tied to your Ambagan account's access period; it is not a recurring subscription."
      }
    ]
  },
  {
    title: "Offline Mode",
    items: [
      {
        question: "Which Features Work Offline and Which Need a Connection?",
        answer:
          "You can keep using most of Ambagan without a connection, and actions you take offline sync automatically when you're back online. Works offline: viewing your groups, Individual entries, expenses, settlements, friends, and notifications from your last synced data; adding, editing, and deleting expenses (attached receipts sync on reconnect); adding, editing, and deleting individual expenses in an Individual entry; marking an individual expense as paid or pending; saving an expense as a draft; creating a group and editing its name or category; creating an Individual entry and editing its name, category, or linked group; archiving or restoring a group or an Individual entry; adding or removing members if you're the owner or an admin; adding or removing favorites; changing the app appearance and settlement view; toggling the daily reminder; and sharing an invite link or downloading a group QR code. Needs a connection: settling up (request, approve, reject, or mark as settled); finalizing a draft; setting up or managing a recurring expense (pause, resume, or delete a series); joining a group or scanning a QR to join; scanning a receipt; resetting a group's invite link; making a member an admin or removing their admin; leaving a group or permanently deleting a group or Individual entry; opening Spending Analytics; uploading a profile, group, or Individual entry photo; editing your profile or account and changing your password; changing your notification preferences; and signing out. If you try something that needs a connection while offline, Ambagan shows a short message instead of leaving you stuck.",
        content: <OfflineFeatureList />
      },
      {
        question: "What Happens When I Lose Internet Connection?",
        answer:
          "A blue 'Offline Mode — Showing cached data' banner appears at the top, and you can keep using the app with your last synced data. Most actions work offline and sync automatically when you reconnect. A few things need a live connection — see the list of which features work offline above. You'll see a short message if you try one of those while offline."
      },
      {
        question: "Do My Offline Changes Really Get Saved?",
        answer:
          "Yes. Expenses, individual expenses and Individual entry edits, group edits, member changes, and favorites you make offline are queued on your device and marked with a 'Syncing…' badge. As soon as you reconnect — or reopen the app while online — Ambagan sends them to the server in order and clears the badge. The queue survives closing and reopening the app, so nothing is lost if you stay offline for a while."
      }
    ]
  },
  {
    title: "Account & Settings",
    items: [
      {
        question: "How Do I Change the Currency I Track in?",
        answer:
          "Currency is set per group and per Individual entry rather than once for your whole account, so a JPY trip and a PHP household expense recorder can live side by side. Choose it when you create a group or Individual entry, or change it later in Edit — it's a Pro feature, and free accounts stay in Philippine Peso (PHP). Totals that span several groups or Individual entries (the home Overview, Friends, Spending Analytics) are shown in PHP with a ≈ when a conversion was involved."
      },
      {
        question: "What Is the Overview Hero Setting?",
        answer:
          "The purple card at the top of the home screen has two pages — Net Balance (what your groups owe you and what you owe them) and Individual Totals (all recorded expenses across every Individual entry, with Paid and Pending totals). Both are always one swipe or arrow tap apart; Profile → Overview Hero just picks which one the home screen opens on, and the choice sticks between launches."
      },
      {
        question: "How Do I Change the App Appearance?",
        answer:
          "Go to Profile → App Appearance. You can switch between Light, Dark, or System (follows your device setting)."
      },
      {
        question: "What Is the Settlement View Setting?",
        answer:
          "Settlement View controls how settlement lists look throughout the app — on the home Recent Activity feed, a group's Settlements tab, and friends' detail pages. Go to Profile → Settlement View and pick Full (the default) for roomy cards with full member, payer, and status details, Compact for dense two-line rows, or Arrow for payer → receiver on a single line. Your choice applies everywhere settlements are listed."
      },
      {
        question: "How Do I Update My Name or Profile Photo?",
        answer:
          "Go to Profile → Personal Info. From there you can update your display name and upload a new profile photo."
      },
      {
        question: "How Do I Change My Password?",
        answer:
          "Go to Profile → Account Settings → Change Password. Enter your current password and then your new password to update it."
      },
      {
        question: "I Forgot My Password. What Do I Do?",
        answer:
          "On the login screen, tap Forgot Password and enter your email. You'll receive a reset link to set a new password."
      },
      {
        question: "How Do I Sign Out?",
        answer: "Scroll to the bottom of the Profile tab and tap Sign Out."
      },
      {
        question: "How Do I Delete My Account?",
        answer:
          "Go to Profile → Account Settings → Delete My Account. If you have unsettled expenses, they will be listed and you will need to resolve them before deletion is allowed. Once deleted, your account is permanently removed — your name will appear as 'Deleted User' on any shared expense history so other members retain their records."
      },
      {
        question: "What Do the Arrow and Amount Mean in a Settlement?",
        answer:
          "The arrow points from the person repaying the expense to the person receiving that payment. The label says who pays whom, or who paid whom for a settled payment, and the amount stays in the settlement's original currency. Expand Breakdown of computation to see how the amount was calculated. Use View Group to open the group it belongs to."
      }
    ]
  }
];

// The offline capability matrix, kept in sync with the app's real offline
// behaviour (queue-and-sync vs. connection-required). Also mirrored in prose in
// the item's `answer` string so Help Center search can still find it.
const OFFLINE_CAPABLE: string[] = [
  "View groups, Individual entries, expenses, settlements, friends, and notifications (last synced data)",
  "Add, edit, and delete expenses — attached receipts sync on reconnect",
  "Add, edit, and delete individual expenses in an Individual entry",
  "Mark an individual expense as paid or pending",
  "Save an expense as a draft",
  "Create a group and edit its name or category",
  "Create an Individual entry and edit its name, category, or linked group",
  "Archive or restore a group",
  "Archive or restore an Individual entry",
  "Add or remove members (group owner or admin)",
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
  "Make a member an admin, or remove their admin",
  "Leave a group, or permanently delete a group or Individual entry",
  "Open Spending Analytics",
  "Upload a profile photo, group cover photo, or Individual entry cover photo",
  "Edit your profile or account, or change your password",
  "Change notification preferences",
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
        take offline are saved and sync automatically when you&apos;re back online.
        Here&apos;s the full breakdown:
      </Text>

      <VStack className="gap-y-2">
        <Text bold className="text-sm text-success-600 uppercase">
          Works Offline
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
          Needs a Connection
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

// A single titled FAQ section rendered as an accordion card. Shared by
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
      <Box className="rounded-xl overflow-hidden bg-secondary-100">
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
  const previewEmpty = useEmptyStatePreview();
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
                {previewEmpty ? 0 : resultCount} result{previewEmpty || resultCount !== 1 ? "s" : ""}
              </Text>
              {!previewEmpty && resultCount > 0 ? (
                filteredSections.map((section) => (
                  <FaqSectionBlock key={section.title} section={section} />
                ))
              ) : (
                <EmptyList
                  type={EmptyType.SEARCH}
                />
              )}
            </VStack>
          </ScrollView>
        ) : null}
      </SearchDrawer>
    </InnerLayout>
  );
}
