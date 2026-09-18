export interface StructuredRequest {
  system: string
  user: string
  // JSON Schema the model's reply must follow.
  schema: Record<string, unknown>
}

export interface LlmClient {
  readonly name: string
  // Resolves with the parsed JSON reply. Rejects with LlmError on any failure.
  completeJson(request: StructuredRequest): Promise<unknown>
}

export class LlmError extends Error {}
