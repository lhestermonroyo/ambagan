import {
  differenceInDays,
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO
} from "date-fns";

export const formatDate = (date: string) => {
  if (!date) return "";

  const parsedDate = new Date(date);
  const daysDifference = differenceInDays(new Date(), parsedDate);
  const isLastYear = parsedDate.getFullYear() === new Date().getFullYear() - 1;

  if (isLastYear) {
    return format(parsedDate, "MMM dd, yyyy - hh:mm a");
  }

  if (daysDifference > 2) {
    return format(parsedDate, "MMM dd - hh:mm a");
  }

  return formatTimeAgo(date);
};

/** Relative time for every age, including dates older than a few days. */
export const formatTimeAgo = (date: string) => {
  if (!date) return "";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return formatDistanceToNow(parsedDate, { addSuffix: true })
    .replace(/^about\s/i, "")
    .replace(/\bseconds?\b/gi, "s")
    .replace(/\bminutes\b/gi, "mins")
    .replace(/\bminute\b/gi, "min")
    .replace(/\bhours\b/gi, "hrs")
    .replace(/\bhour\b/gi, "hr");
};

/** Recent updates use relative time; updates older than 72 hours use Jan 3. */
export const formatLastUpdate = (date: string) => {
  if (!date) return "";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return Date.now() - parsedDate.getTime() > 3 * 24 * 60 * 60 * 1000
    ? format(parsedDate, "MMM d")
    : formatTimeAgo(date);
};

export const getDateGroupTitle = (dateString: string) => {
  const date = parseISO(dateString);

  if (isToday(date)) {
    return "Today";
  } else if (isYesterday(date)) {
    return "Yesterday";
  } else {
    return format(date, "EEEE, MMM dd, yyyy");
  }
};
