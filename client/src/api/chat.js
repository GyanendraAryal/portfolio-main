/**
 * Chat API — POST /api/chat/ with chunked streaming response.
 *
 * The backend returns a chunked HTTP response where each chunk is a
 * newline-delimited SSE-style line:
 *   data: {"token": "..."}\n\n
 *   data: {"done": true}\n\n
 *   data: {"error": "..."}\n\n
 *
 * We read it via fetch + ReadableStream (no EventSource needed).
 *
 * @param {string} message
 * @param {string} sessionId
 * @param {(token: string) => void} onToken  — called for each streamed token
 * @param {AbortSignal} [signal]             — optional AbortController signal
 * @returns {Promise<{answer: string, rateLimitRemaining: number|null}>}
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export async function streamChat(message, sessionId, onToken, signal) {
  const response = await fetch(`${BASE_URL}/chat/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  })

  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
    ? Number(response.headers.get('X-RateLimit-Remaining'))
    : null

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const err = new Error('rate_limited')
    err.code = 'rate_limited'
    err.retryAfter = retryAfter ? Number(retryAfter) : 60
    err.remaining = 0
    throw err
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      detail = body?.message || body?.detail || detail
    } catch {}
    throw new Error(detail)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullAnswer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete lines (split on \n\n)
    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''  // keep the incomplete tail

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const jsonStr = trimmed.slice('data:'.length).trim()
      if (!jsonStr) continue

      let parsed
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        continue
      }

      if (parsed.error) {
        const err = new Error(parsed.error)
        err.code = 'stream_error'
        throw err
      }

      if (parsed.done) break

      if (parsed.token) {
        fullAnswer += parsed.token
        onToken(parsed.token)
      }
    }
  }

  return { answer: fullAnswer, rateLimitRemaining }
}
