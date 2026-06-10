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
          "Yes, Ambagan is free. Create groups, track expenses, and settle up with your friends at no cost."
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
          "Yes. Open the group, go to the Members section in the Group Details tab, and tap Edit Members to add or remove people."
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
          "Yes. Each expense can be set to a different currency, which is useful for travel groups. Your default currency can be changed in Profile → Default Currency."
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
      }
    ]
  },
  {
    title: "Friends",
    items: [
      {
        question: "How do friends appear in Ambagan?",
        answer:
          "Anyone who is a member of a group you belong to automatically appears in your Friends tab. You can also mark friends as favorites for quick access."
      },
      {
        question: "What does the Friends tab show?",
        answer:
          "The Friends tab shows everyone you share a group with, along with a balance summary of how much they owe you or you owe them. Use the Owes Me, I Owe, and Favorites filters to quickly find who you need."
      },
      {
        question: "How do I add someone as a favorite?",
        answer:
          "Open the Friends tab, find the person, and tap the star icon next to their name. Favorites appear first and are accessible from the Home screen carousel."
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
          "You can receive alerts for settlement requests, approvals, rejections, completions, new expense inclusions, and group member changes. Each category can be toggled individually in Profile → Push Notifications."
      },
      {
        question: "How do I turn off notifications?",
        answer:
          "Go to Profile → Push Notifications. You can toggle individual notification types on or off depending on your preference."
      }
    ]
  },
  {
    title: "Pro Plan",
    items: [
      {
        question: "What is the Pro plan?",
        answer:
          "The Pro plan unlocks premium features including unlimited groups (free plan is limited to 3), multi-currency expenses, CSV export of settlements, offline access to your data, and a Pro badge on your profile."
      },
      {
        question: "How do I upgrade to Pro?",
        answer:
          "Go to Profile → Subscription and choose a monthly or yearly plan. Upgrading unlocks all Pro features immediately."
      },
      {
        question: "How do I export settlements to CSV?",
        answer:
          "Open a group and go to the Export tab. Select a date range, then tap Export CSV. The file will include all settlements you're involved in for that group and will open your device's share sheet so you can save or send it."
      },
      {
        question: "How many groups can I create on the free plan?",
        answer:
          "Free users can create up to 3 active groups. Archived groups do not count toward this limit. Upgrade to Pro for unlimited groups."
      },
      {
        question: "Can I use Ambagan offline?",
        answer:
          "Pro users can browse their groups, expenses, settlements, and friends while offline. Data is automatically cached when you're connected and shown when you lose signal. A banner will appear at the top of the app to let you know you're viewing cached data. Creating or settling expenses still requires an internet connection."
      }
    ]
  },
  {
    title: "Account & Settings",
    items: [
      {
        question: "How do I change my default currency?",
        answer:
          "Go to Profile → Default Currency and select your preferred currency. This will be pre-selected when you create new expenses."
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
          <Text className="text-secondary-950">
            Find answers to common questions below. If you need further help,
            contact us at{" "}
            <Text bold className="text-primary-400">
              support@ambagan.ph
            </Text>
            .
          </Text>

          {FAQ_SECTIONS.map((section) => (
            <VStack key={section.title} className="gap-y-2">
              <Text bold className="text-lg">
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
                                className="text-secondary-950"
                              />
                            </>
                          )}
                        </AccordionTrigger>
                      </AccordionHeader>
                      <AccordionContent>
                        <AccordionContentText className="text-secondary-950 leading-relaxed">
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
