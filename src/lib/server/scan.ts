import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { getVisionModel } from '../ai/client'
import { BOOK_DETECTION_SYSTEM_PROMPT, bookDetectionResponseSchema } from '../ai/prompts'
import { resolveBookMetadata } from '../books/metadata'
import type { DetectedBook, ScanResponse, BookMetadata } from '../books/types'

export interface ScanInput {
  imageBase64?: string
  isbn?: string
  enrich?: boolean
}

function extractJson(text: string): unknown {
  try {
    // 1. Try stripping markdown code fences
    const stripped = text
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```$/m, '')
      .trim()
    return JSON.parse(stripped)
  } catch {
    // 2. Try regex extraction of outermost JSON object
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
    throw new Error('Could not parse valid JSON from vision response')
  }
}

const BANNED_TITLE_REGEX = /^(unknown|untitled|various|illegible|bookshelf|book\s*collection|row\s*of\s*books|unreadable|n\/a|none)/i
const BANNED_PHRASES = [
  'individual titles illegible',
  'various authors',
  'various books',
  'unknown title',
  'unknown book',
  'untitled book',
  'bookshelf row',
]

function isValidDetectedTitle(title: unknown): boolean {
  if (typeof title !== 'string') return false
  const trimmed = title.trim()
  if (trimmed.length < 2 || trimmed.length > 150) return false
  if (BANNED_TITLE_REGEX.test(trimmed)) return false
  const lower = trimmed.toLowerCase()
  if (BANNED_PHRASES.some((phrase) => lower.includes(phrase))) return false
  return true
}

export async function processBookScan(data: ScanInput): Promise<ScanResponse> {
  const timestamp = Date.now()

    // Fast-path: Barcode ISBN lookup
    if (data.isbn && data.isbn.trim()) {
      const cleanIsbn = data.isbn.trim()
      if (data.enrich) {
        try {
          const metadata = await resolveBookMetadata('', undefined, cleanIsbn)
          const barcodeBook: DetectedBook = {
            id: `book-barcode-${timestamp}`,
            title: metadata.title,
            author: metadata.author,
            type: 'cover',
            box2d: [200, 200, 800, 800],
            confidence: 0.99,
            metadata,
            lastSeenTimestamp: timestamp,
          }
          return {
            books: [barcodeBook],
            timestamp,
            source: 'barcode',
          }
        } catch (err) {
          console.error('[Scan] Barcode lookup failed:', err)
        }
      }

      // Progressive path: return recognized barcode book immediately
      const barcodeBook: DetectedBook = {
        id: `book-barcode-${timestamp}`,
        title: `ISBN ${cleanIsbn}`,
        author: 'Searching catalog...',
        type: 'cover',
        box2d: [200, 200, 800, 800],
        confidence: 0.99,
        metadata: {
          id: `book-barcode-${timestamp}`,
          title: `ISBN ${cleanIsbn}`,
          author: 'Searching catalog...',
          isbn: cleanIsbn,
          genres: [],
          source: 'open-library',
        },
        lastSeenTimestamp: timestamp,
      }
      return {
        books: [barcodeBook],
        timestamp,
        source: 'barcode',
      }
    }

    // Vision recognition path
    if (!data.imageBase64) {
      return {
        books: [],
        timestamp,
        source: 'vision',
        error: 'No image or ISBN provided',
      }
    }

    try {
      const model = getVisionModel()
      let rawBase64 = data.imageBase64
      let mimeType = 'image/jpeg'

      // Parse data URL if present
      if (rawBase64.startsWith('data:')) {
        const matches = rawBase64.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          mimeType = matches[1]
          rawBase64 = matches[2]
        }
      }
      const promptText =
        'Analyze this camera image. Identify ONLY genuine printed books (book covers or book spines) with clearly legible titles or recognized published covers. Do NOT detect furniture, wardrobes, cabinets, empty surfaces, or unreadable distant objects. Do NOT use placeholder titles like "Unknown Book" and do NOT guess titles. If no legible books are visible, return {"books": []}.'

      const result = await generateText({
        model,
        system: BOOK_DETECTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'file',
                data: rawBase64,
                mediaType: mimeType,
              },
            ],
          },
        ],
      })

      let rawJson = extractJson(result.text) as Record<string, unknown> | unknown[]
      if (Array.isArray(rawJson)) {
        rawJson = { books: rawJson }
      }
      console.log('Gemini raw output:', JSON.stringify(rawJson, null, 2))

      // Flexible normalizer to tolerate varied LLM field names and filter out hallucinated placeholders
      const rawBooks = Array.isArray(rawJson.books) ? rawJson.books : []
      const filteredRawBooks = rawBooks.filter((item: any) => {
        const detectedTitle = item?.title || item?.label || item?.name
        return isValidDetectedTitle(detectedTitle)
      })

      if (filteredRawBooks.length === 0) {
        return {
          books: [],
          timestamp,
          source: 'vision',
        }
      }

      const normalizedBooks = filteredRawBooks.map((item: any, idx: number) => {
        let box2d: [number, number, number, number] = [100, 100 + idx * 80, 900, 180 + idx * 80]

        const rawBox = item.box2d || item.box_2d || item.boundingBox || item.bbox || item.box
        if (Array.isArray(rawBox) && rawBox.length === 4) {
          box2d = [Number(rawBox[0]), Number(rawBox[1]), Number(rawBox[2]), Number(rawBox[3])]
        } else if (rawBox && typeof rawBox === 'object') {
          const ymin = Number(rawBox.ymin ?? rawBox.top ?? 100)
          const xmin = Number(rawBox.xmin ?? rawBox.left ?? 100)
          const ymax = Number(rawBox.ymax ?? rawBox.bottom ?? 900)
          const xmax = Number(rawBox.xmax ?? rawBox.right ?? 200)
          box2d = [ymin, xmin, ymax, xmax]
        }

        const detectedTitle = item.title || item.label || item.name || ''

        return {
          title: String(detectedTitle).trim(),
          author: item.author ? String(item.author).trim() : undefined,
          type: (item.type === 'cover' ? 'cover' : 'spine') as 'spine' | 'cover',
          box2d,
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
        }
      })

      const parsed = bookDetectionResponseSchema.safeParse({ books: normalizedBooks })

      if (!parsed.success) {
        console.warn('[Scan] Schema parse error:', parsed.error)
        return {
          books: [],
          timestamp,
          source: 'vision',
          error: 'AI response did not match expected structure',
        }
      }

      // Filter out low-confidence, invalid bounding box or remaining placeholder titles
      const validBooks = parsed.data.books.filter((item) => {
        if (!isValidDetectedTitle(item.title)) return false
        const [ymin, xmin, ymax, xmax] = item.box2d
        const height = ymax - ymin
        const width = xmax - xmin
        if (height <= 30 || width <= 20) return false
        if (ymin < 0 || xmin < 0 || ymax > 1000 || xmax > 1000) return false
        return true
      })

      if (validBooks.length === 0) {
        return {
          books: [],
          timestamp,
          source: 'vision',
        }
      }

      // Build detected books with initial optical metadata (pending catalog lookup)
      const detectedBooks: DetectedBook[] = validBooks.map((item, index) => {
        const initialMetadata: BookMetadata = {
          id: `book-${timestamp}-${index}`,
          title: item.title,
          author: item.author || 'Unknown Author',
          genres: [],
          source: 'open-library',
        }

        return {
          id: `book-${timestamp}-${index}`,
          title: item.title,
          author: item.author,
          type: item.type,
          box2d: item.box2d,
          confidence: item.confidence,
          metadata: initialMetadata,
          lastSeenTimestamp: timestamp,
        }
      })

      // If caller requested synchronous enrichment
      if (data.enrich) {
        const enrichedBooks: DetectedBook[] = await Promise.all(
          validBooks.map(async (item, index) => {
            const metadata = await resolveBookMetadata(item.title, item.author)
            return {
              ...detectedBooks[index],
              metadata,
            }
          })
        )

        return {
          books: enrichedBooks,
          timestamp,
          source: 'vision',
        }
      }

      // Progressive path: return recognized books immediately so UI can display them and show processing count
      return {
        books: detectedBooks,
        timestamp,
        source: 'vision',
      }
    } catch (err: unknown) {
      console.error('[Scan] Vision processing error:', err)
      const message = err instanceof Error ? err.message : 'Vision recognition failed'
      return {
        books: [],
        timestamp,
        source: 'vision',
        error: message,
      }
    }
}

export const scanFrameFn = createServerFn({ method: 'POST' })
  .validator((input: ScanInput) => input)
  .handler(async ({ data }): Promise<ScanResponse> => {
    return processBookScan(data)
  })

export interface EnrichBookInput {
  bookId: string
  title: string
  author?: string
  isbn?: string
}

export const enrichBookMetadataFn = createServerFn({ method: 'POST' })
  .validator((input: EnrichBookInput) => input)
  .handler(async ({ data }): Promise<{ bookId: string; metadata: BookMetadata }> => {
    const metadata = await resolveBookMetadata(data.title, data.author, data.isbn)
    return {
      bookId: data.bookId,
      metadata,
    }
  })
