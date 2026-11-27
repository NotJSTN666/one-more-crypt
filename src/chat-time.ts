// When a chat message was posted, for the chat list.

/**
 * When a message was posted, in the reader's own time: just the time today, "Yesterday" and the
 * time, then the date and the time (with the year once it's from another year).
 */
export function chatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const clock = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const daysAgo = Math.round((day(now) - day(d)) / 86_400_000);
  if (daysAgo <= 0) return clock;
  if (daysAgo === 1) return `Yesterday ${clock}`;
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
  return `${date}, ${clock}`;
}
