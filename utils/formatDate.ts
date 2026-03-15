import { differenceInDays, format, formatDistanceToNow } from "date-fns";

const formatDate = (date: string) => {
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

  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

export default formatDate;
