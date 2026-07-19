import OfflineBanner from "@/components/OfflineBanner";
import SlowConnectionBanner from "@/components/SlowConnectionBanner";
import { useNetwork } from "@/hooks/useNetwork";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";

// Renders whichever top network banner currently applies (or nothing): blue when
// truly offline, amber when online-but-slow. Shared by the root layout and the
// search drawer so the two never drift apart. `topInset` is forwarded for callers
// inside a native Modal where the safe-area context is unreliable.
export default function NetworkBanner({ topInset }: { topInset?: number }) {
  const { isOnline } = useNetwork();
  const { isDegraded } = useNetworkHealth();

  if (!isOnline) return <OfflineBanner topInset={topInset} />;
  if (isDegraded) return <SlowConnectionBanner topInset={topInset} />;
  return null;
}
