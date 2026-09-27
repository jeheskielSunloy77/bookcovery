export interface BookMetadata {
  id: string
  title: string
  author: string
  rating?: number // 1.0 to 5.0
  ratingsCount?: number
  coverUrl?: string
  publishedYear?: number | string
  genres: string[]
  pageCount?: number
  synopsis?: string
  isbn?: string
  source: 'google-books' | 'open-library' | 'ai-estimate'
  ratingsBreakdown?: {
    1?: number
    2?: number
    3?: number
    4?: number
    5?: number
  }
}

export interface DetectedBook {
  id: string
  title: string
  author?: string
  type: 'spine' | 'cover'
  // Normalized coordinates [ymin, xmin, ymax, xmax] between 0 and 1000
  box2d: [number, number, number, number]
  confidence: number
  metadata?: BookMetadata
  lastSeenTimestamp: number
}

export interface ScanResponse {
  books: DetectedBook[]
  timestamp: number
  source: 'vision' | 'barcode'
  error?: string
}
