import type { BookMetadata } from './types'
import { bookCache } from './cache'

interface OpenLibraryDoc {
  key?: string
  title?: string
  author_name?: string[]
  ratings_average?: number
  ratings_count?: number
  first_publish_year?: number
  subject?: string[]
  cover_i?: number
  isbn?: string[]
  number_of_pages_median?: number
}

interface OpenLibraryRatings {
  summary?: {
    average?: number
    count?: number
    sortable?: number
  }
  counts?: Record<string, number>
}

/**
 * Fetch book metadata from Open Library
 */
async function fetchFromOpenLibrary(
  title: string,
  author?: string,
  isbn?: string
): Promise<Partial<BookMetadata> | null> {
  const cleanTitle = (title || '').trim()
  const cleanIsbn = (isbn || '').trim()
  if (!cleanTitle && !cleanIsbn) return null

  try {
    let searchUrl = ''
    if (cleanIsbn) {
      const sanitizedIsbn = cleanIsbn.replace(/[-\s]/g, '')
      searchUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(sanitizedIsbn)}&limit=1`
    } else {
      const queryParts: string[] = []
      if (cleanTitle) queryParts.push(`title=${encodeURIComponent(cleanTitle)}`)
      if (author && author.trim()) queryParts.push(`author=${encodeURIComponent(author.trim())}`)
      searchUrl = `https://openlibrary.org/search.json?${queryParts.join('&')}&limit=1`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Bookcovery/1.0 (bookcovery-app)' },
    })
    clearTimeout(timeoutId)

    if (!res.ok) return null

    const data = await res.json()
    const doc: OpenLibraryDoc = data.docs?.[0]
    if (!doc) return null

    let ratingsData: OpenLibraryRatings | null = null
    if (doc.key) {
      try {
        const ratingController = new AbortController()
        const rTimeout = setTimeout(() => ratingController.abort(), 2000)
        const ratingsRes = await fetch(`https://openlibrary.org${doc.key}/ratings.json`, {
          signal: ratingController.signal,
          headers: { 'User-Agent': 'Bookcovery/1.0 (bookcovery-app)' },
        })
        clearTimeout(rTimeout)
        if (ratingsRes.ok) {
          ratingsData = await ratingsRes.json()
        }
      } catch {
        // Soft fail for ratings sub-request
      }
    }

    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : undefined

    const rating =
      ratingsData?.summary?.average != null
        ? Number(ratingsData.summary.average.toFixed(2))
        : doc.ratings_average != null
          ? Number(doc.ratings_average.toFixed(2))
          : undefined

    const ratingsCount = ratingsData?.summary?.count ?? doc.ratings_count

    return {
      title: doc.title || title,
      author: doc.author_name?.[0] || author || 'Unknown Author',
      rating,
      ratingsCount,
      coverUrl,
      publishedYear: doc.first_publish_year,
      genres: (doc.subject || []).slice(0, 4),
      pageCount: doc.number_of_pages_median,
      source: 'open-library',
      ratingsBreakdown: ratingsData?.counts,
    }
  } catch (err: unknown) {
    const isTimeout =
      (err as any)?.name === 'AbortError' ||
      (err as any)?.code === 'ETIMEDOUT' ||
      (err as any)?.cause?.code === 'ETIMEDOUT'
    if (isTimeout) {
      console.log(`[Metadata] Open Library timeout for "${cleanTitle || cleanIsbn}" — continuing with available data`)
    } else {
      console.log(`[Metadata] Open Library lookup unavailable for "${cleanTitle || cleanIsbn}"`)
    }
    return null
  }
}

/**
 * Fetch book metadata from Google Books
 */
async function fetchFromGoogleBooks(
  title: string,
  author?: string,
  isbn?: string
): Promise<Partial<BookMetadata> | null> {
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    let query = ''
    if (isbn && isbn.trim()) {
      query = `isbn:${isbn.trim().replace(/[-\s]/g, '')}`
    } else {
      query = `intitle:${title}`
      if (author) query += `+inauthor:${author}`
    }

    let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`
    if (apiKey) url += `&key=${apiKey}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) return null

    const data = await res.json()
    const item = data.items?.[0]
    if (!item?.volumeInfo) return null

    const info = item.volumeInfo
    const coverUrl = info.imageLinks?.extraLarge ||
      info.imageLinks?.large ||
      info.imageLinks?.medium ||
      info.imageLinks?.thumbnail ||
      info.imageLinks?.smallThumbnail

    return {
      title: info.title || title,
      author: info.authors?.[0] || author || 'Unknown Author',
      rating: info.averageRating != null ? Number(info.averageRating.toFixed(2)) : undefined,
      ratingsCount: info.ratingsCount,
      coverUrl: coverUrl ? coverUrl.replace('http://', 'https://') : undefined,
      publishedYear: info.publishedDate ? info.publishedDate.slice(0, 4) : undefined,
      genres: info.categories?.slice(0, 4) || [],
      pageCount: info.pageCount,
      synopsis: info.description,
      source: 'google-books',
    }
  } catch {
    return null
  }
}

/**
 * Master metadata resolver with multi-engine fallback and caching
 */
export async function resolveBookMetadata(
  title: string,
  author?: string,
  isbn?: string
): Promise<BookMetadata> {
  const cleanTitle = (title || '').trim()
  const cleanAuthor = (author || '').trim()
  const cleanIsbn = (isbn || '').trim()

  if (!cleanTitle && !cleanIsbn) {
    return {
      id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: 'Untitled Book',
      author: 'Unknown Author',
      genres: [],
      source: 'open-library',
    }
  }

  // Check cache first
  const cached = bookCache.get(cleanTitle, cleanAuthor, cleanIsbn)
  if (cached) {
    return cached
  }

  // 1. Try Google Books (if available / non-exhausted)
  const googleData = await fetchFromGoogleBooks(cleanTitle, cleanAuthor, cleanIsbn)

  // 2. Try Open Library
  let openLibData: Partial<BookMetadata> | null = null
  if (!googleData || !googleData.rating || !googleData.coverUrl) {
    openLibData = await fetchFromOpenLibrary(cleanTitle, cleanAuthor, cleanIsbn)
  }

  // Synthesize best available fields
  const finalTitle = googleData?.title || openLibData?.title || title
  const finalAuthor = googleData?.author || openLibData?.author || author || 'Unknown Author'
  const finalRating = googleData?.rating ?? openLibData?.rating
  const finalRatingsCount = googleData?.ratingsCount ?? openLibData?.ratingsCount
  const finalCoverUrl = googleData?.coverUrl || openLibData?.coverUrl
  const finalYear = googleData?.publishedYear || openLibData?.publishedYear
  const finalGenres = (googleData?.genres?.length ? googleData.genres : openLibData?.genres) || []
  const finalPageCount = googleData?.pageCount || openLibData?.pageCount
  const finalSynopsis = googleData?.synopsis || openLibData?.synopsis
  const finalSource = (googleData?.source || openLibData?.source || 'open-library') as 'google-books' | 'open-library'

  const metadata: BookMetadata = {
    id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: finalTitle,
    author: finalAuthor,
    rating: finalRating,
    ratingsCount: finalRatingsCount,
    coverUrl: finalCoverUrl,
    publishedYear: finalYear,
    genres: finalGenres,
    pageCount: finalPageCount,
    synopsis: finalSynopsis,
    isbn,
    source: finalSource,
    ratingsBreakdown: openLibData?.ratingsBreakdown,
  }

  // Cache for future lookups
  bookCache.set(finalTitle, metadata, finalAuthor, isbn)
  return metadata
}
