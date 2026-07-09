/**
 * Returns a human-readable Arabic string for when the user was last seen.
 * e.g. "منذ 5 دقائق" / "منذ ساعتين" / "منذ 3 أيام"
 */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "غير متاح";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "منذ لحظات";
  if (minutes === 1) return "منذ دقيقة";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "منذ ساعة";
  if (hours === 2) return "منذ ساعتين";
  if (hours < 24) return `منذ ${hours} ساعات`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "منذ يوم";
  if (days === 2) return "منذ يومين";
  if (days < 30) return `منذ ${days} أيام`;
  return "منذ فترة طويلة";
}
