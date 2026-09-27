import type { BookMetadata } from './types'

interface CacheEntry {
  data: BookMetadata
  timestamp: number
}

class BookMetadataCache {
  private cache = new Map<string, CacheEntry>()
  private maxItems: number
  private ttlMs: number

  constructor(maxItems = 300, ttlMs = 1000 * 60 * 60 * 24) {
    this.maxItems = maxItems
    this.ttlMs = ttlMs
  }

  private normalizeKey(title: string, author?: string, isbn?: string): string {
    if (isbn && isbn.trim().length > 0) {
      return `isbn:${isbn.trim().replace(/[-\s]/g, '')}`
    }
    const cleanTitle = (title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    const cleanAuthor = (author || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    return `${cleanTitle}::${cleanAuthor}`
  }

  get(title: string, author?: string, isbn?: string): BookMetadata | null {
    const key = this.normalizeKey(title, author, isbn)
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    // Refresh LRU order
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(title: string, data: BookMetadata, author?: string, isbn?: string): void {
    const key = this.normalizeKey(title, author, isbn)
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }
}

export const bookCache = new BookMetadataCache()
