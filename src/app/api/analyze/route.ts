import { NextResponse } from 'next/server'
import { createLlmFromEnv, handleAnalyzeRequest } from '@engine/index'

// Thin adapter: all analysis logic lives in /engine, which knows nothing about Next.js.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const { status, body: result } = await handleAnalyzeRequest(body, { llm: createLlmFromEnv(process.env) })
  return NextResponse.json(result, { status })
}
