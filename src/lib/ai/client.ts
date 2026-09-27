import { createOpenAI } from '@ai-sdk/openai'

export const customAIProvider = createOpenAI({
  baseURL: process.env.AI_GATEWAY_URL || 'http://127.0.0.1:8317/v1',
  apiKey: process.env.AI_API_KEY || 'caspr-local-cliproxy-key',
})

export const visionModelName = process.env.AI_MODEL || 'gemini-3.8-flash-high'

export function getVisionModel() {
  return customAIProvider(visionModelName)
}
