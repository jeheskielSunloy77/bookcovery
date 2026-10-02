import type { WantedBookItem } from './types'

/**
 * Strips hyphens, spaces, and non-alphanumeric characters from an ISBN.
 */
export function cleanIsbn(isbn?: string): string {
  if (!isbn) return ''
  return isbn.replace(/[^0-9xX]/g, '').toUpperCase()
}

/**
 * Normalizes a text string by removing diacritics, punctuation, and extra whitespace.
 */
export function normalizeText(text?: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extracts main title by removing common subtitle separators (: or -).
 */
export function getMainTitle(title?: string): string {
  if (!title) return ''
  const firstPart = title.split(/[:—–-]/)[0]
  return normalizeText(firstPart)
}

/**
 * Checks if two author strings reasonably match.
 * If either author is omitted, it returns true (lenient when author is unspecified).
 */
export function isAuthorMatch(authorA?: string, authorB?: string): boolean {
  if (!authorA || !authorB) return true
  const normA = normalizeText(authorA)
  const normB = normalizeText(authorB)
  if (!normA || !normB) return true
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) return true

  // Check word token overlap (e.g. last name matching: "James Clear" vs "Clear")
  const wordsA = normA.split(' ').filter((w) => w.length > 2)
  const wordsB = normB.split(' ').filter((w) => w.length > 2)
  return wordsA.some((w) => wordsB.includes(w))
}

/**
 * Checks if a scanned title matches a wanted title.
 */
export function isTitleMatch(scannedTitle: string, wantedTitle: string): boolean {
  const normScanned = normalizeText(scannedTitle)
  const normWanted = normalizeText(wantedTitle)

  if (!normScanned || !normWanted) return false
  if (normScanned === normWanted) return true

  // Check substring containment
  if (normScanned.includes(normWanted) || normWanted.includes(normScanned)) {
    return true
  }

  // Check main title without subtitle (e.g. "Thinking, Fast and Slow: By Daniel Kahneman")
  const mainScanned = getMainTitle(scannedTitle)
  const mainWanted = getMainTitle(wantedTitle)
  if (mainScanned && mainWanted) {
    if (mainScanned === mainWanted || mainScanned.includes(mainWanted) || mainWanted.includes(mainScanned)) {
      return true
    }
  }

  // Token overlap check: if wanted title is multiple words, ensure most words are in scanned title
  const wantedTokens = normWanted.split(' ').filter((w) => w.length > 2)
  if (wantedTokens.length > 0) {
    const scannedTokens = new Set(normScanned.split(' '))
    const matchedTokens = wantedTokens.filter((token) => scannedTokens.has(token))
    if (matchedTokens.length / wantedTokens.length >= 0.75) {
      return true
    }
  }

  return false
}

/**
 * Checks whether a given book matches a wanted book item.
 */
export function isBookMatchingWanted(
  book: { title: string; author?: string; isbn?: string },
  wanted: WantedBookItem
): boolean {
  // 1. ISBN matching (exact clean match if both present and valid)
  const cleanA = cleanIsbn(book.isbn)
  const cleanB = cleanIsbn(wanted.isbn)
  if (cleanA && cleanB && cleanA.length >= 9 && cleanB.length >= 9) {
    if (cleanA === cleanB) return true
  }

  // 2. Title matching
  if (!isTitleMatch(book.title, wanted.title)) {
    return false
  }

  // 3. Author matching
  return isAuthorMatch(book.author, wanted.author)
}

/**
 * Finds the first matching wanted book from a list of wanted items.
 * Prioritizes un-found items over already found items.
 */
export function findMatchingWanted(
  book: { title: string; author?: string; isbn?: string },
  wantedList: WantedBookItem[]
): WantedBookItem | undefined {
  if (!book || !book.title || !wantedList || wantedList.length === 0) return undefined

  let foundMatch: WantedBookItem | undefined

  for (const wanted of wantedList) {
    if (isBookMatchingWanted(book, wanted)) {
      // If we found an un-found match, immediately return it
      if (!wanted.foundAt) {
        return wanted
      }
      if (!foundMatch) {
        foundMatch = wanted
      }
    }
  }

  return foundMatch
}
