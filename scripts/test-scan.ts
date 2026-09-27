import { processBookScan } from '../src/lib/server/scan.ts'

async function runTest() {
  console.log('Testing Bookcovery Server Function with local Gemini 3.8 Flash & Metadata Resolver...')

  // Test barcode / ISBN fast-path lookup
  console.log('Testing ISBN barcode lookup (Dune: 9780441172719)...')
  const startTime = Date.now()
  const result = await processBookScan({
    isbn: '9780441172719',
    mode: 'single',
  })
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log(`Scan completed in ${duration}s!`)
  console.log(`Detected books count: ${result.books.length}`)

  result.books.forEach((book, i) => {
    console.log(`\n[Book #${i + 1}]`)
    console.log(`  Title: ${book.title}`)
    console.log(`  Author: ${book.author || 'N/A'}`)
    console.log(`  Type: ${book.type}`)
    console.log(`  Rating: ${book.metadata?.rating || 'N/A'} (Source: ${book.metadata?.source})`)
    console.log(`  Cover: ${book.metadata?.coverUrl ? 'Found' : 'None'}`)
    if (book.metadata?.synopsis) {
      console.log(`  Synopsis: ${book.metadata.synopsis.slice(0, 100)}...`)
    }
  })
}

runTest().catch(console.error)
