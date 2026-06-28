import { Box } from "@/components/ui/box";
import { CloseIcon, Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useNetwork } from "@/hooks/useNetwork";
import { cn } from "@gluestack-ui/utils/nativewind-utils";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height the OfflineBanner occupies below the safe-area inset (icon/text row +
// its bottom padding). Used to drop the toast clear of the banner when offline.
const OFFLINE_BANNER_HEIGHT = 30;

type ToastActionType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "muted"
  | undefined;

type ToastParams = {
  title?: string;
  description: string;
  type?: ToastActionType;
};

interface ToastData extends ToastParams {
  id: string;
}

const ToastContext = React.createContext<{
  toast: (params: ToastParams) => void;
}>({
  toast: () => {}
});

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastIdsRef = useRef(new Set<string>());

  const showToast = (params: ToastParams) => {
    const newId = Math.random().toString();

    if (toastIdsRef.current.has(newId)) {
      return;
    }

    toastIdsRef.current.add(newId);

    const toastData: ToastData = {
      ...params,
      id: newId
    };

    setToasts((prev) => [...prev, toastData]);

    setTimeout(() => {
      dismissToast(newId);
    }, 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    toastIdsRef.current.delete(id);
  };

  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      {children}
      <CustomToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      })
    ]).start();
  }, []);

  const getBackgroundColor = (type?: ToastActionType) => {
    switch (type) {
      case "success":
        return "bg-emerald-600";
      case "error":
        return "bg-red-600";
      case "warning":
        return "bg-amber-600";
      case "info":
        return "bg-blue-600";
      case "muted":
        return "bg-gray-600";
      default:
        return "bg-gray-700";
    }
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateY }, { scale }],
        opacity
      }}
      className="w-full mb-2"
    >
      <Box
        className={cn(
          getBackgroundColor(toast.type),
          "px-4 py-3 rounded-lg mx-2 shadow-lg"
        )}
      >
        <Box className="flex-row items-center justify-between">
          <VStack space="xs" className="flex-1 mr-2">
            {toast.title && (
              <Text size="lg" className="text-white font-medium">
                {toast.title}
              </Text>
            )}
            <Text className="text-white">{toast.description}</Text>
          </VStack>

          <Pressable
            onPress={() => onDismiss(toast.id)}
            className="ml-2 p-1 -mr-1 -mt-1"
          >
            <Icon as={CloseIcon} className="text-white" size="sm" />
          </Pressable>
        </Box>
      </Box>
    </Animated.View>
  );
};

interface CustomToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const CustomToastContainer: React.FC<CustomToastContainerProps> = ({
  toasts,
  onDismiss
}) => {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetwork();

  if (toasts.length === 0) return null;

  // Clear the status bar/notch; when offline, also clear the offline banner so
  // the toast isn't hidden underneath it.
  const paddingTop =
    insets.top + 12 + (isOnline ? 0 : OFFLINE_BANNER_HEIGHT);

  return (
    <Box
      className="absolute top-0 left-0 right-0 z-50"
      style={{
        paddingTop,
        width: Dimensions.get("window").width
      }}
    >
      <VStack space="xs">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </VStack>
    </Box>
  );
};

const useAppToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useAppToast must be used within ToastProvider");
  }
  return context.toast;
};

export default useAppToast;
export { ToastProvider };
