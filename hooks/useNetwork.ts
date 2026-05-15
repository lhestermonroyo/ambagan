import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
