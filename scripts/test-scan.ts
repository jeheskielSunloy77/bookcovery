import fs from 'fs'
import path from 'path'
import { processBookScan } from '../src/lib/server/scan.ts'

async function runTest() {
  console.log('Testing Bookcovery Server Function with local Gemini 3.8 Flash...')

  const samplePath = path.resolve('public/samples/shelf-1.jpg')
  const buffer = fs.readFileSync(samplePath)
  const base64Data = `data:image/jpeg;base64,${buffer.toString('base64')}`

  console.log(`Loaded test image: ${samplePath} (${(buffer.length / 1024).toFixed(1)} KB)`)
  console.log('Sending to processBookScan...')

  const startTime = Date.now()
  const result = await processBookScan({
    imageBase64: base64Data,
    mode: 'shelf',
  })
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log(`Scan completed in ${duration}s!`)
  console.log(`Detected books count: ${result.books.length}`)

  result.books.forEach((book, i) => {
    console.log(`\n[Book #${i + 1}]`)
    console.log(`  Title: ${book.title}`)
    console.log(`  Author: ${book.author || 'N/A'}`)
    console.log(`  Type: ${book.type}`)
    console.log(`  Box2D: [ymin: ${book.box2d[0]}, xmin: ${book.box2d[1]}, ymax: ${book.box2d[2]}, xmax: ${book.box2d[3]}]`)
    console.log(`  Rating: ${book.metadata?.rating || 'N/A'} (Source: ${book.metadata?.source})`)
    console.log(`  Cover: ${book.metadata?.coverUrl ? 'Found' : 'None'}`)
    if (book.metadata?.synopsis) {
      console.log(`  Synopsis: ${book.metadata.synopsis.slice(0, 100)}...`)
    }
  })
}

runTest().catch(console.error)
