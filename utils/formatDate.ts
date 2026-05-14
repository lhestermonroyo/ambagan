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

  return formatDistanceToNow(parsedDate, {
    addSuffix: true, 
    
   });
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