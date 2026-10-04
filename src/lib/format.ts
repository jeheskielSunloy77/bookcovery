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

export interface RatingTheme {
  /** Qualitative tier label (e.g. 'Top Tier', 'Great', 'Good', 'Average', 'Below Average') */
  label: string
  /** Text color class for rating score number */
  text: string
  /** Background tint class */
  bg: string
  /** Border color class */
  border: string
  /** Fill & text color class for Lucide Star icon */
  star: string
  /** Muted secondary text color class for review counts */
  subtext: string
  /** Solid background color class for rating bars */
  bar: string
  /** Combined badge classes */
  badge: string
}

/**
 * Returns dynamic UI theme styling relative to the 1.0 - 5.0 book rating score:
 * - >= 4.5: Emerald (Top Tier / Masterpiece)
 * - >= 4.0: Green (Great / Highly Recommended)
 * - >= 3.5: Amber (Good / Solid)
 * - >= 3.0: Orange (Average / Mediocre)
 * - < 3.0:  Rose (Below Average / Poor)
 * - Unrated: Neutral / White-50
 */
export function getRatingTheme(rating?: number | string | null): RatingTheme {
  const score = typeof rating === 'number' ? rating : typeof rating === 'string' ? parseFloat(rating) : null

  if (score == null || isNaN(score) || score <= 0) {
    return {
      label: 'Unrated',
      text: 'text-white/50',
      bg: 'bg-white/5',
      border: 'border-white/10',
      star: 'fill-white/30 text-white/40',
      subtext: 'text-white/40',
      bar: 'bg-white/20',
      badge: 'bg-white/5 border-white/10 text-white/50',
    }
  }

  if (score >= 4.5) {
    return {
      label: 'Top Tier',
      text: 'text-emerald-300',
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-400/35',
      star: 'fill-emerald-400 text-emerald-400',
      subtext: 'text-emerald-300/70',
      bar: 'bg-emerald-400',
      badge: 'bg-emerald-500/20 border-emerald-400/35 text-emerald-300',
    }
  }

  if (score >= 4.0) {
    return {
      label: 'Great',
      text: 'text-green-300',
      bg: 'bg-green-500/20',
      border: 'border-green-400/35',
      star: 'fill-green-400 text-green-400',
      subtext: 'text-green-300/70',
      bar: 'bg-green-400',
      badge: 'bg-green-500/20 border-green-400/35 text-green-300',
    }
  }

  if (score >= 3.5) {
    return {
      label: 'Good',
      text: 'text-amber-300',
      bg: 'bg-amber-500/20',
      border: 'border-amber-400/35',
      star: 'fill-amber-400 text-amber-400',
      subtext: 'text-amber-300/70',
      bar: 'bg-amber-400',
      badge: 'bg-amber-500/20 border-amber-400/35 text-amber-300',
    }
  }

  if (score >= 3.0) {
    return {
      label: 'Average',
      text: 'text-orange-300',
      bg: 'bg-orange-500/20',
      border: 'border-orange-400/35',
      star: 'fill-orange-400 text-orange-400',
      subtext: 'text-orange-300/70',
      bar: 'bg-orange-400',
      badge: 'bg-orange-500/20 border-orange-400/35 text-orange-300',
    }
  }

  return {
    label: 'Below Average',
    text: 'text-rose-300',
    bg: 'bg-rose-500/20',
    border: 'border-rose-400/35',
    star: 'fill-rose-400 text-rose-400',
    subtext: 'text-rose-300/70',
    bar: 'bg-rose-400',
    badge: 'bg-rose-500/20 border-rose-400/35 text-rose-300',
  }
}
