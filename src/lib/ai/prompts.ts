import { z } from 'zod'

export const detectedBookItemSchema = z.object({
  title: z.string().describe('The title of the book recognized from the spine or cover'),
  author: z.string().optional().describe('Author name if visible on the book'),
  type: z.enum(['spine', 'cover']).describe('Whether this is a spine on a shelf or a front/back cover'),
  box2d: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .describe('Bounding box [ymin, xmin, ymax, xmax] normalized between 0 and 1000'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  quickSynopsis: z
    .string()
    .optional()
    .describe('A 1-2 sentence compelling hook/synopsis of what the book is about'),
  estimatedRating: z
    .number()
    .optional()
    .describe('Estimated public rating on a 1.0 to 5.0 scale (e.g. 4.2)'),
  genres: z.array(z.string()).optional().describe('1-3 primary genres (e.g. Sci-Fi, Memoir, Mystery)'),
})

export const bookDetectionResponseSchema = z.object({
  books: z.array(detectedBookItemSchema).describe('List of all detected books in the image'),
  sceneDescription: z.string().optional().describe('Brief description of the shelf or book arrangement'),
})

export type DetectedBookItem = z.infer<typeof detectedBookItemSchema>
export type BookDetectionResponse = z.infer<typeof bookDetectionResponseSchema>

export const BOOK_DETECTION_SYSTEM_PROMPT = `You are Bookcovery Vision, an ultra-precise optical computer vision system for augmented-reality book recognition.

Your task is to analyze camera images of bookshelves, book stacks, or individual book covers.
For every visible and legible book:
1. Locate its exact 2D bounding box as [ymin, xmin, ymax, xmax] with coordinates normalized from 0 to 1000:
   - ymin: top edge (0 to 1000)
   - xmin: left edge (0 to 1000)
   - ymax: bottom edge (0 to 1000)
   - xmax: right edge (0 to 1000)
2. Transcribe the exact book title and author.
3. Classify whether it is a 'spine' (vertical/horizontal spine on a shelf) or 'cover' (front or back cover of a book).
4. Provide a high-confidence bounding box that tightly frames the book spine or cover so the AR tags overlay accurately in real-time.
5. Provide a crisp 1-2 sentence synopsis and estimated rating (1.0 to 5.0) as an instant preview.

If no books are clearly legible, return an empty array for books.`
