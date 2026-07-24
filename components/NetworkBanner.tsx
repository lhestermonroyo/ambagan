import OfflineBanner from "@/components/OfflineBanner";
import { useNetwork } from "@/hooks/useNetwork";

// Renders the offline banner when the device is truly offline, otherwise nothing.
// Shared by the root layout and the search drawer so the two never drift apart.
// `topInset` is forwarded for callers inside a native Modal where the safe-area
// context is unreliable.
export default function NetworkBanner({ topInset }: { topInset?: number }) {
  const { isOnline } = useNetwork();

  if (!isOnline) return <OfflineBanner topInset={topInset} />;
  return null;
}
