export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(Math.max(1, Math.ceil(seconds)))} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
}
