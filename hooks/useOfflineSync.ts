import useAppToast from "@/hooks/use-app-toast";
import services from "@/services";
import states from "@/states";
import * as offlineQueue from "@/utils/offlineQueue";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Watches connectivity and flushes the offline write queue when the device
 * comes back online (and once on mount / on app-foreground, in case ops
 * survived a restart or NetInfo never emitted a transition).
 *
 * Processes queued operations in order via the same services as the online
 * path. Succeeded ops are removed and their optimistic items un-marked. A
 * failed op is flagged and skipped so one bad op never blocks the rest, but it
 * is RE-ATTEMPTED on the next flush (reconnect / foreground) — a transient
 * failure on the first moment of reconnect must not strand a write forever.
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
        // Retry failed ops alongside pending ones — nothing else ever resets a
        // failed op, so excluding them here would strand it permanently.
        const retryable = ops.filter(
          (o) => o.status === "pending" || o.status === "failed"
        );
        if (retryable.length === 0) return;

        let success = 0;
        let failed = 0;
        let dead = 0;

        for (const op of retryable) {
          try {
            if (op.type === "ADD_EXPENSE") {
              const { args } = op.payload;
              // saveExpense is idempotent on the pinned id: a retry where the row
              // already committed detects the unique violation and repairs the
              // children instead of duplicating or stranding a half-written
              // expense (see saveExpense).
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
              // Re-upload a receipt stashed while offline. Best-effort: the
              // expense already synced, so a missing/failed image is dropped
              // rather than failing (and retrying) the whole op forever.
              if (op.payload.proofUpload) {
                try {
                  await services.expense.attachExpenseProof(
                    op.payload.clientId,
                    op.payload.proofUpload
                  );
                } catch (e) {
                  console.warn("Failed to re-upload offline receipt:", e);
                }
              }
            } else if (op.type === "CREATE_DRAFT") {
              const { args } = op.payload;
              // saveDraftExpense is idempotent on the pinned id (see ADD_EXPENSE).
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
              // Re-upload a stashed receipt best-effort (see ADD_EXPENSE above).
              if (op.payload.proofUpload) {
                try {
                  await services.expense.attachExpenseProof(
                    op.payload.clientId,
                    op.payload.proofUpload
                  );
                } catch (e) {
                  console.warn("Failed to re-upload offline receipt:", e);
                }
              }
            } else if (op.type === "UPDATE_EXPENSE") {
              const { args } = op.payload;
              await services.expense.updateExpense(
                op.payload.expenseId,
                {
                  ...args.expensePayload,
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
            } else if (op.type === "DELETE_EXPENSE") {
              await services.expense.deleteExpense(op.payload.expenseId);
            } else if (op.type === "CREATE_GROUP") {
              // saveGroup is idempotent on the pinned id: a retry where the group
              // row already committed repairs the member rows instead of leaving
              // a memberless group (see saveGroup).
              await services.group.saveGroup(op.payload.args);
              await offlineQueue._internal.clearPendingGroup(
                op.payload.userId,
                op.payload.clientId
              );
            } else if (op.type === "UPDATE_GROUP") {
              await services.group.updateGroup(op.payload.groupId, {
                ...op.payload.args
              });
              const uid = states.user.getState().details?.id;
              if (uid) {
                await offlineQueue._internal.clearPendingGroup(
                  uid,
                  op.payload.groupId
                );
              }
            } else if (op.type === "SET_GROUP_ARCHIVED") {
              if (op.payload.archived) {
                await services.group.archiveGroup(op.payload.groupId);
              } else {
                await services.group.unarchiveGroup(op.payload.groupId);
              }
            } else if (op.type === "ADD_FAVORITE") {
              await services.friend.addFavorite(
                op.payload.userId,
                op.payload.favoriteId
              );
            } else if (op.type === "REMOVE_FAVORITE") {
              await services.friend.removeFavorite(
                op.payload.userId,
                op.payload.favoriteId
              );
            } else if (op.type === "UPDATE_PREFERENCES") {
              await services.preferences.updatePreferences(
                op.payload.userId,
                op.payload.prefs
              );
            } else if (op.type === "UPDATE_MEMBERS") {
              await services.member.updateGroupMembers(
                op.payload.groupId,
                op.payload.membersToAdd,
                op.payload.membersToRemove
              );
            }

            await offlineQueue.removeFromQueue(op.id);
            success++;
          } catch (error) {
            console.error("Failed to sync queued operation:", error);
            // Dead-lettered ops stop retrying (and stop re-toasting) after too
            // many attempts; still-failed ops are retried on the next flush.
            const status = await offlineQueue.markFailed(op.id);
            if (status === "dead") dead++;
            else failed++;
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
        // Dead-lettered this pass: retried enough times to stop. Toast once (they
        // won't be retried again, so this won't re-fire on future reconnects).
        if (dead > 0) {
          toast({
            title: "Some changes couldn't be synced",
            description: `${dead} ${
              dead === 1 ? "change" : "changes"
            } couldn't be synced after several attempts and have stopped retrying.`,
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

    // Also flush when the app returns to the foreground while online — covers a
    // reconnect that happened while backgrounded (no NetInfo transition fires)
    // and re-attempts any op left `failed` by an earlier flush.
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      offlineQueue.isOnline().then((online) => {
        if (online) flush();
      });
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, [toast]);
}
