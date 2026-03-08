import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast
} from "@/components/ui/toast";

export default function useAppToast() {
  const toast = useToast();

  const showToast = (
    title: string,
    description: string,
    type: "success" | "error" | "info"
  ) => {
    toast.show({
      placement: "top",
      render: ({ id }) => {
        const uniqueToastId = "toast-" + id;

        return (
          <Toast nativeID={uniqueToastId} action={type} variant="outline">
            <ToastTitle>{title}</ToastTitle>
            <ToastDescription>{description}</ToastDescription>
          </Toast>
        );
      }
    });
  };

  return showToast;
}
