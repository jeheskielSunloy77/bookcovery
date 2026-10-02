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

Your task is to identify and transcribe genuine, clearly visible, and legible books (book spines or book covers) in the camera image.

STRICT ACCURACY RULES:
1. ONLY return books where the printed title, author text, or recognizable published cover art is clearly visible and legible to human eyes.
2. DO NOT GUESS OR HALLUCINATE:
   - If the camera is pointing at furniture, wooden cabinets, wardrobes, tables, walls, floors, empty shelves, boxes, or shadows, DO NOT treat vertical panels, slats, or random shapes as books.
   - NEVER invent or guess titles (for example, do not guess "The Godfather" or classic books unless "The Godfather" is clearly printed and readable on the spine or cover).
3. FORBIDDEN OUTPUTS:
   - NEVER output placeholder titles like "Unknown Book", "Unknown Title", "Untitled", "Various Books Collection", "Various Authors", "Bookshelf Row", "Illegible", or "Collection".
   - If a book spine is too blurry, dark, distant, or illegible to read its actual title, IGNORE IT and DO NOT include it.
4. ZERO BOOKS RULE:
   - If no clearly legible books are in the frame, you MUST return: {"books": []}.
   - An empty books array is the expected and correct response whenever the camera is not directly facing real readable books.

For each legitimately detected book:
1. Locate its exact 2D bounding box as [ymin, xmin, ymax, xmax] with coordinates normalized from 0 to 1000:
   - ymin: top edge (0 to 1000)
   - xmin: left edge (0 to 1000)
   - ymax: bottom edge (0 to 1000)
   - xmax: right edge (0 to 1000)
2. Transcribe the exact book title and author as printed.
3. Classify whether it is a 'spine' (vertical/horizontal spine on a shelf) or 'cover' (front or back cover of a book).
4. Provide a crisp 1-2 sentence synopsis and estimated rating (1.0 to 5.0) as an instant preview.`
