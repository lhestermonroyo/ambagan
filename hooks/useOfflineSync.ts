import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import * as offlineQueue from "@/utils/offlineQueue";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";

/**
 * Watches connectivity and flushes the offline write queue when the device
 * comes back online (and once on mount, in case ops survived a restart).
 *
 * Processes queued operations in order via the same services as the online
 * path. Succeeded ops are removed and their optimistic items un-marked;
 * failed ops are flagged and skipped so one bad op never blocks the rest.
 */
export function useOfflineSync() {
  const toast = useAppToast();
  const flushing = useRef(false);
  // null = first event from NetInfo; otherwise the previous online state.
  const wasOnline = useRef<boolean | null>(null);

  useEffect(() => {
    const flush = async () => {
      if (flushing.current) return;
      flushing.current = true;

      try {
        const ops = await offlineQueue.getQueue();
        const pending = ops.filter((o) => o.status === "pending");
        if (pending.length === 0) return;

        let success = 0;
        let failed = 0;

        for (const op of pending) {
          try {
            if (op.type === "ADD_EXPENSE") {
              const { args } = op.payload;
              await services.expense.saveExpense(
                {
                  ...args.expensePayload,
                  // Stored as an ISO string in the queue — rehydrate to a Date.
                  expense_date: args.expensePayload.expense_date
                    ? new Date(args.expensePayload.expense_date)
                    : undefined
                } as any,
                args.payers,
                args.memberSplits,
                args.paymentSplits
              );
              await offlineQueue._internal.clearPendingExpense(
                op.payload.groupId,
                op.payload.clientId
              );
              await offlineQueue._internal.clearPendingPaymentsForExpense(
                op.payload.groupId,
                op.payload.optimisticPayments ?? [],
                states.user.getState().details?.id
              );
            } else if (op.type === "CREATE_DRAFT") {
              const { args } = op.payload;
              await services.expense.saveDraftExpense({
                ...args.expensePayload,
                proof_of_payment: null,
                // Pinned to the optimistic id; rehydrate the ISO date to a Date.
                id: op.payload.clientId,
                expense_date: args.expensePayload.expense_date
                  ? new Date(args.expensePayload.expense_date)
                  : undefined
              });
              await offlineQueue._internal.clearPendingExpense(
                op.payload.groupId,
                op.payload.clientId
              );
            } else if (op.type === "CREATE_GROUP") {
              await services.group.saveGroup(op.payload.args);
              await offlineQueue._internal.clearPendingGroup(
                op.payload.userId,
                op.payload.clientId
              );
            }

            await offlineQueue.removeFromQueue(op.id);
            success++;
          } catch (error) {
            console.error("Failed to sync queued operation:", error);
            await offlineQueue.markFailed(op.id);
            failed++;
          }
        }

        // Refresh the groups list from the server now that we're online.
        const userId = states.user.getState().details?.id;
        if (userId) {
          services.group
            .getGroupsByUserId(userId)
            .then((list) =>
              states.group.setState((prev) => ({ ...prev, list }))
            )
            .catch(() => {});
        }

        if (success > 0) {
          toast({
            title: "Back online",
            description: `${success} offline ${
              success === 1 ? "change" : "changes"
            } synced.`,
            type: "success"
          });
        }
        if (failed > 0) {
          toast({
            title: "Some changes didn't sync",
            description: `${failed} ${
              failed === 1 ? "change" : "changes"
            } couldn't be synced and will be retried later.`,
            type: "error"
          });
        }
      } finally {
        flushing.current = false;
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? true;

      // Flush on the first reading if already online (leftover queue), and on
      // every offline → online transition thereafter.
      if (online && wasOnline.current !== true) {
        flush();
      }

      wasOnline.current = online;
    });

    return unsubscribe;
  }, [toast]);
}
