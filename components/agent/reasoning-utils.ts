export function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}
