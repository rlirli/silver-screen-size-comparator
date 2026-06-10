/**
 * Formats a Date object or parseable date string using the user's system locale.
 * If the input is invalid or undefined, returns a fallback value.
 */
export function formatToSystemDate(dateInput?: Date | string, fallback: string = "N/A"): string {
  if (!dateInput) return fallback;

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return typeof dateInput === "string" ? dateInput : fallback;
  }

  return date.toLocaleDateString();
}
