import {
  RecurrenceConfig,
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurringExpense
} from "@/types/expenses";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isAfter,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay
} from "date-fns";

/**
 * Local hour of day an occurrence is generated at. The client anchors a
 * template's `next_run_at` here and the run-recurring Edge Function advances by
 * the same convention, so occurrences post in the morning rather than at an
 * arbitrary time. Keep this in sync with the Edge Function's GENERATION_HOUR.
 */
export const GENERATION_HOUR = 8;

/** Set a date to GENERATION_HOUR:00:00.000 local time (the run anchor). */
const atGenerationHour = (date: Date): Date =>
  setMilliseconds(setSeconds(setMinutes(setHours(date, GENERATION_HOUR), 0), 0), 0);

/**
 * Advance a date by one recurrence step (frequency × interval). Pure date math,
 * mirrored server-side in the generator so both agree on the schedule.
 */
export const advanceByFrequency = (
  date: Date,
  frequency: RecurrenceFrequency,
  interval: number
): Date => {
  const step = Math.max(1, interval);
  switch (frequency) {
    case RecurrenceFrequency.DAILY:
      return addDays(date, step);
    case RecurrenceFrequency.WEEKLY:
      return addWeeks(date, step);
    case RecurrenceFrequency.MONTHLY:
      return addMonths(date, step);
    default:
      return addDays(date, step);
  }
};

/**
 * The template's first `next_run_at`. If the start date is today or in the past
 * the first occurrence is generated immediately by `saveRecurringExpense`, so
 * the *scheduled* next run is one step out; a future start date runs at its
 * generation hour on that day.
 */
export const computeInitialNextRunAt = (config: RecurrenceConfig): Date => {
  const startAnchor = atGenerationHour(startOfDay(config.start_date));
  const today = startOfDay(new Date());
  const startsInFuture = isAfter(startOfDay(config.start_date), today);
  if (startsInFuture) return startAnchor;
  // Start is today/past → first occurrence fires now, next one is a step later.
  return advanceByFrequency(
    startAnchor,
    config.frequency,
    config.repeat_interval
  );
};

/** Whether a template has reached its end condition and should auto-pause. */
export const hasReachedEnd = (
  config: Pick<
    RecurringExpense,
    "end_type" | "end_date" | "occurrence_limit" | "occurrences_count"
  >,
  nextRunAt: Date
): boolean => {
  if (config.end_type === RecurrenceEndType.ON_DATE && config.end_date) {
    return isAfter(startOfDay(nextRunAt), startOfDay(new Date(config.end_date)));
  }
  if (
    config.end_type === RecurrenceEndType.AFTER_COUNT &&
    config.occurrence_limit != null
  ) {
    return config.occurrences_count >= config.occurrence_limit;
  }
  return false;
};

const FREQUENCY_NOUN: Record<RecurrenceFrequency, string> = {
  [RecurrenceFrequency.DAILY]: "day",
  [RecurrenceFrequency.WEEKLY]: "week",
  [RecurrenceFrequency.MONTHLY]: "month"
};

/**
 * Human-readable recurrence label, e.g. "Repeats monthly", "Repeats every 2
 * weeks". Used on the Add Expense summary row and the manage-recurring list.
 */
export const recurrenceSummary = (config: {
  frequency: RecurrenceFrequency;
  repeat_interval: number;
}): string => {
  const noun = FREQUENCY_NOUN[config.frequency];
  if (config.repeat_interval <= 1) {
    const adverb =
      config.frequency === RecurrenceFrequency.DAILY
        ? "daily"
        : config.frequency === RecurrenceFrequency.WEEKLY
          ? "weekly"
          : "monthly";
    return `Repeats ${adverb}`;
  }
  return `Repeats every ${config.repeat_interval} ${noun}s`;
};

/** Short end-condition label, e.g. "Ends Aug 1, 2026", "Ends after 12 times". */
export const endSummary = (config: {
  end_type: RecurrenceEndType;
  end_date: Date | string | null;
  occurrence_limit: number | null;
}): string => {
  if (config.end_type === RecurrenceEndType.ON_DATE && config.end_date) {
    return `Ends ${format(new Date(config.end_date), "MMM d, yyyy")}`;
  }
  if (
    config.end_type === RecurrenceEndType.AFTER_COUNT &&
    config.occurrence_limit != null
  ) {
    return `Ends after ${config.occurrence_limit} time${
      config.occurrence_limit === 1 ? "" : "s"
    }`;
  }
  return "Never ends";
};
