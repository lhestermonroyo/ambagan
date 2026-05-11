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
          "Open the group and tap the menu in the top-right corner. Admins can archive the group; other members can choose to leave."
      }
    ]
  },
  {
    title: "Expenses",
    items: [
      {
        question: "How do I add an expense?",
        answer:
          "Open a group and tap Add Expense. Enter the amount, description, date, and choose how to split — equally, by percentage, or with a custom amount per person."
      },
      {
        question: "What split types are available?",
        answer:
          "You can split expenses equally among all members, by a percentage you define per person, or with a fully custom amount for each participant."
      },
      {
        question: "Can I attach proof of payment to an expense?",
        answer:
          "Yes. When adding or viewing an expense, you can upload an image as proof of payment (e.g. a receipt or bank transfer screenshot)."
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
          "Go to the Settlements tab inside a group or open the friend's details from the Friends tab. Tap Request Settle on the amount you owe, and the payer will review and approve it."
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
      <ScrollView className="flex-1" bounces={false}>
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
