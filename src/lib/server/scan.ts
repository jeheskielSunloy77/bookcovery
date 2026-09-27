import { createServerFn } from '@tanstack/react-start'
import { generateText } from 'ai'
import { getVisionModel } from '../ai/client'
import { BOOK_DETECTION_SYSTEM_PROMPT, bookDetectionResponseSchema } from '../ai/prompts'
import { resolveBookMetadata } from '../books/metadata'
import type { DetectedBook, ScanResponse } from '../books/types'

export interface ScanInput {
  imageBase64?: string
  isbn?: string
  mode?: 'shelf' | 'single'
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

export async function processBookScan(data: ScanInput): Promise<ScanResponse> {
  const timestamp = Date.now()

    // Fast-path: Barcode ISBN lookup
    if (data.isbn && data.isbn.trim()) {
      try {
        const metadata = await resolveBookMetadata('', undefined, data.isbn.trim())
        const barcodeBook: DetectedBook = {
          id: `book-barcode-${Date.now()}`,
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
        data.mode === 'shelf'
          ? 'Identify all visible book spines on this shelf. For each, return its title, author, and precise 2D bounding box [ymin, xmin, ymax, xmax] (0-1000).'
          : 'Identify the book in focus. Return its title, author, and precise 2D bounding box [ymin, xmin, ymax, xmax] (0-1000).'

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

      // Flexible normalizer to tolerate varied LLM field names
      const rawBooks = Array.isArray(rawJson.books) ? rawJson.books : []
      const normalizedBooks = rawBooks.map((item: any, idx: number) => {
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

        const preview = item.preview && typeof item.preview === 'object' ? item.preview : {}
        const detectedTitle = item.title || item.label || item.name || 'Untitled Book'
        const detectedSynopsis = item.quickSynopsis || item.synopsis || item.description || preview.synopsis
        const rawRating = item.estimatedRating ?? item.rating ?? preview.rating
        const detectedRating = typeof rawRating === 'number' ? rawRating : undefined

        return {
          title: String(detectedTitle),
          author: item.author ? String(item.author) : undefined,
          type: (item.type === 'cover' ? 'cover' : 'spine') as 'spine' | 'cover',
          box2d,
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
          quickSynopsis: detectedSynopsis ? String(detectedSynopsis) : undefined,
          estimatedRating: detectedRating,
          genres: Array.isArray(item.genres) ? item.genres : undefined,
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

      // Concurrently resolve rich metadata for all detected books
      const enrichedBooks: DetectedBook[] = await Promise.all(
        parsed.data.books.map(async (item, index) => {
          let metadata = await resolveBookMetadata(item.title, item.author)

          // Augment with AI quick synopsis / estimated rating if missing
          if (!metadata.rating && item.estimatedRating) {
            metadata = {
              ...metadata,
              rating: item.estimatedRating,
              source: 'ai-estimate',
            }
          }

          if (!metadata.synopsis && item.quickSynopsis) {
            metadata = {
              ...metadata,
              synopsis: item.quickSynopsis,
            }
          }

          if (item.genres && item.genres.length > 0 && metadata.genres.length === 0) {
            metadata = {
              ...metadata,
              genres: item.genres,
            }
          }

          return {
            id: `book-${timestamp}-${index}`,
            title: item.title,
            author: item.author,
            type: item.type,
            box2d: item.box2d,
            confidence: item.confidence,
            metadata,
            lastSeenTimestamp: timestamp,
          }
        })
      )

      return {
        books: enrichedBooks,
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
