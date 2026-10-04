/**
 * Formats a number to a compact string (e.g. 450 -> "450", 1200 -> "1.2k", 15000 -> "15k", 1200000 -> "1.2M")
 */
export function formatCompactNumber(count?: number | null): string {
  if (count == null || isNaN(count) || count <= 0) return '0'
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  }
  return count.toLocaleString()
}
