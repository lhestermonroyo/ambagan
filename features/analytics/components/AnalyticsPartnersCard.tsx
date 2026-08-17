import AppAvatar from "@/components/AppAvatar";
import ListDivider from "@/components/ListDivider";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TopPartner } from "@/features/analytics/services/analytics.service";

/**
 * Who the user splits with most. Ranked by how MANY expenses they've shared,
 * not by how much — this answers "who do I actually go out with", and ranking
 * by amount would let one expensive trip outrank a year of weekly lunches.
 */
export default function AnalyticsPartnersCard({
  partners
}: {
  partners: TopPartner[];
}) {
  return (
    <VStack className="gap-y-2">
      <Text bold className="text-2xl">
        Top Split Partners
      </Text>
      <Card className="rounded-2xl bg-secondary-100 p-0 overflow-hidden">
        <VStack>
          {partners.map((partner, index) => (
            <Box key={partner.id}>
              <HStack className="p-4 gap-x-3 items-center">
                <AppAvatar
                  name={partner.firstName}
                  uri={partner.avatar ?? undefined}
                />
                <VStack className="flex-1">
                  <Text className="text-lg">
                    {partner.firstName} {partner.lastName}
                  </Text>
                  <Text className="text-secondary-950 text-sm">
                    {partner.count} shared expense
                    {partner.count !== 1 ? "s" : ""}
                  </Text>
                </VStack>
                <Box className="bg-primary-50 dark:bg-primary-900 px-3 py-1 rounded-full">
                  <Text bold className="text-primary-400 text-sm">
                    #{index + 1}
                  </Text>
                </Box>
              </HStack>
              {index < partners.length - 1 && <ListDivider />}
            </Box>
          ))}
        </VStack>
      </Card>
    </VStack>
  );
}
