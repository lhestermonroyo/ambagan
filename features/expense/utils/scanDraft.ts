import states from "@/states";
import { ScanDraft } from "@/types/expenses";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

/**
 * How long a scanned receipt stays available to seed a form. Long enough to
 * cover backing out of Add Expense, picking a different destination, or making a
 * group/book first; short enough that a receipt forgotten in the store can't
 * resurface much later. The `scanId` param check below is what actually keeps a
 * stale draft out of an unrelated form — this is the backstop for the case where
 * the user leaves the app mid-flow and comes back to a restored navigation state.
 */
export const SCAN_DRAFT_TTL_MS = 15 * 60 * 1000;

/** Stamps a fresh scan with the identity the hand-off is tracked by. */
export const buildScanDraft = (
  fields: Omit<ScanDraft, "scan_id" | "scanned_at">
): ScanDraft => ({
  ...fields,
  scan_id: uuid(),
  scanned_at: Date.now()
});

/** False once a draft has aged out — expiry is a read-time check, so this stays
 *  safe to call from render. */
export const isScanDraftFresh = (draft: ScanDraft | null) =>
  !!draft && Date.now() - draft.scanned_at <= SCAN_DRAFT_TTL_MS;

/** The waiting draft, or null when there is none / it has aged out. */
export const readScanDraft = (): ScanDraft | null => {
  const { scanDraft } = states.expense.getState();
  return isScanDraftFresh(scanDraft) ? scanDraft : null;
};

/**
 * The draft an Add Expense screen should seed from, given the `scanId` it was
 * routed with. Null for a form opened any other way — a manually opened Add
 * Expense must never inherit a receipt the user scanned for somewhere else.
 *
 * Deliberately does NOT clear: the same draft has to survive a back-out and
 * seed again when the user re-picks a destination. {@link consumeScanDraft}
 * ends its life once the expense is actually saved.
 */
export const scanDraftFor = (scanId?: string | string[]): ScanDraft | null => {
  const id = Array.isArray(scanId) ? scanId[0] : scanId;
  if (!id) return null;
  const draft = readScanDraft();
  return draft && draft.scan_id === id ? draft : null;
};

/**
 * Drop the hand-off now that it's been acted on. Scoped to an id so a save on a
 * screen seeded by an older scan can't discard a newer one; called with no id
 * (from the scanner's close button) it clears whatever is there.
 */
export const consumeScanDraft = (scanId?: string | string[]) => {
  const id = Array.isArray(scanId) ? scanId[0] : scanId;
  const { scanDraft, clearScanDraft } = states.expense.getState();
  if (!scanDraft) return;
  if (id && scanDraft.scan_id !== id) return;
  clearScanDraft();
};
