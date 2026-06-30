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
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import InnerLayout from "@/layouts/InnerLayout";
import { useRouter } from "expo-router";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react-native";

type FAQItem = { question: string; answer: string };
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
          "Yes. The core features are free — add up to 5 expenses per day, track balances, split bills, and settle up with friends at no cost. A Pro subscription is available (starting at ₱99 for 2 weeks) for unlimited daily expenses, draft expenses, CSV export, spending analytics, multi-currency support, and more."
      },
      {
        question: "What does the Net Balance on the home screen mean?",
        answer:
          "The Net Balance on the home screen overview card is your total across all groups — how much you are owed (To Collect) minus how much you owe (To Pay). A positive number means you are owed more than you owe overall; a negative number means the opposite."
      }
    ]
  },
  {
    title: "Groups",
    items: [
      {
        question: "How do I create a group?",
        answer:
          "Go to the Groups tab and tap the + button. Give your group a name, pick a category (Trip, Household, etc.), add members, and hit Create."
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
    title: "Expenses",
    items: [
      {
        question: "How do I add an expense?",
        answer:
          "Open a group and tap the New Expense button. You can choose between two options: Quick Add for a fast, simplified entry, or Custom for full control over the date, split type, payer contributions, and proof of payment."
      },
      {
        question: "What is Quick Add and when should I use it?",
        answer:
          "Quick Add is a streamlined way to log an expense in just a few taps. Enter the amount and a description, pick who paid, and the bill is automatically split equally among all group members and dated today. Use it when you're splitting a bill on the spot and everyone pays an equal share."
      },
      {
        question: "Can I choose who paid in Quick Add?",
        answer:
          "Yes. Quick Add defaults to you as the payer, but you can tap the Payer field to open a member list and select someone else. The subtitle at the top of the sheet updates to reflect the selected payer so you always know who the expense is attributed to."
      },
      {
        question: "When should I use Custom instead of Quick Add?",
        answer:
          "Use Custom when you need to set a specific date, split the bill by percentage or custom amounts, have multiple payers contribute different amounts, or attach a proof of payment image. Quick Add covers the common equal-split case; Custom handles everything else."
      },
      {
        question: "What split types are available?",
        answer:
          "You can split expenses equally among all members, by a percentage you define per person, or with a fully custom amount for each participant. Split type selection is available in the Custom expense form."
      },
      {
        question: "Can I attach proof of payment to an expense?",
        answer:
          "Yes. When adding an expense via the Custom form, you can upload an image as proof of payment (e.g. a receipt or bank transfer screenshot)."
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
          "Save as Draft is a Pro feature that lets you log an expense with just the amount and description, then finalize who paid and how to split it later. On the Custom expense form, tap Save as Draft instead of Continue. Draft expenses appear at the top of the group's Expenses tab with an amber Draft badge and are only visible to you until finalized. Tap a draft and press Finalize Expense to complete the split."
      },
      {
        question: "Can other group members see my draft expenses?",
        answer:
          "No. Draft expenses are private — only you (the creator) can see them until you finalize the split. Once finalized, the expense becomes visible to all group members and they receive an expense inclusion notification."
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
        question: "What happens when I lose internet connection?",
        answer:
          "A blue 'Offline Mode — Showing cached data' banner appears at the top, and you can keep using the app with your last synced data. Most actions work offline and sync automatically when you reconnect: adding, editing, and deleting expenses; creating groups and editing a group's name or category; archiving a group; adding or removing members (group admin); managing favorites; and changing the app appearance. A few things need a live connection: settling up, finalizing a draft, leaving a group, logging out, editing your profile or account, changing your default currency or notification preferences, and uploading images (payment proofs and photos). You'll see a short message if you try one of those while offline."
      },
      {
        question: "Why does it say 'Slow connection — showing saved data'?",
        answer:
          "If your device is connected but the network is too slow or unresponsive to load fresh data, Ambagan shows your last saved data with an amber 'Slow connection' banner instead of leaving you stuck waiting. It refreshes automatically once the connection recovers."
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

export default function HelpCenterScreen() {
  const router = useRouter();

  return (
    <InnerLayout title="Help Center" onBack={() => router.back()}>
      <ScrollView className="flex-1">
        <VStack className="p-4 gap-y-6 pb-10">
          <Text className="text-sm text-secondary-950">
            Find answers to common questions below. If you need further help,
            contact us at{" "}
            <Text bold className="text-primary-400">
              lhester.monroyo.dev@gmail.com
            </Text>
            .
          </Text>

          {FAQ_SECTIONS.map((section) => (
            <VStack key={section.title} className="gap-y-2">
              <Text bold className="text-secondary-950 uppercase text-sm">
                {section.title}
              </Text>
              <Box className="rounded-xl overflow-hidden border border-secondary-500">
                <Accordion
                  size="lg"
                  variant="unfilled"
                  type="multiple"
                  isCollapsible
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
                                as={
                                  isExpanded ? ChevronUpIcon : ChevronDownIcon
                                }
                                className="text-sm text-secondary-950"
                              />
                            </>
                          )}
                        </AccordionTrigger>
                      </AccordionHeader>
                      <AccordionContent>
                        <AccordionContentText className="text-secondary-950 text-base">
                          {item.answer}
                        </AccordionContentText>
                      </AccordionContent>
                      {index < section.items.length - 1 && (
                        <Divider className="border-secondary-100" />
                      )}
                    </AccordionItem>
                  ))}
                </Accordion>
              </Box>
            </VStack>
          ))}
        </VStack>
      </ScrollView>
    </InnerLayout>
  );
}
