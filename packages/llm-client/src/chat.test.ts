import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatCompletion, streamChatCompletion } from './chat'
import { LLMError } from './errors'

const encoder = new TextEncoder()

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sseResponse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

const baseRequest = {
  chatCompletionsUrl: 'https://api.example.com/v1/chat/completions',
  apiKey: 'test-key',
  model: 'test-model',
  messages: [{ role: 'user' as const, content: 'hi' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createChatCompletion', () => {
  it('normalizes tool calls and sends tools only when provided', async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          choices: [
            {
              message: {
                content: '',
                tool_calls: [
                  {
                    function: { name: 'get_page_snapshot', arguments: '{"limit":1}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await createChatCompletion({
      ...baseRequest,
      tools: [
        {
          type: 'function',
          function: { name: 'get_page_snapshot', description: 'read page', parameters: {} },
        },
      ],
    })

    expect(result.toolCalls).toEqual([
      {
        id: 'call_0',
        type: 'function',
        function: { name: 'get_page_snapshot', arguments: '{"limit":1}' },
      },
    ])
    expect(result.finishReason).toBe('tool_calls')

    const init = fetchMock.mock.calls[0][1]
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body.stream).toBe(false)
    expect(body.tool_choice).toBe('auto')
    expect(body.tools).toHaveLength(1)
  })

  it('maps server errors to LLMError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { message: 'insufficient balance' } }, 402)),
    )

    const error = await createChatCompletion(baseRequest).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(LLMError)
    expect((error as LLMError).code).toBe('server')
    expect((error as LLMError).status).toBe(402)
    expect((error as LLMError).message).toContain('insufficient balance')
  })

  it('rejects an empty assistant response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{}] })))

    const error = await createChatCompletion(baseRequest).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(LLMError)
    expect((error as LLMError).code).toBe('protocol')
  })

  it('fails before sending when the signal is already aborted', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    const error = await createChatCompletion({ ...baseRequest, signal: controller.signal }).catch(
      (caught: unknown) => caught,
    )
    expect((error as LLMError).code).toBe('aborted')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('streamChatCompletion', () => {
  it('assembles tool call fragments by index and streams content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_a","function":{"name":"click_element","arguments":""}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"ref\\":"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"ref-1\\"}"}}]}}]}\n',
          '\ndata: {"choices":[{"finish_reason":"tool_calls"}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    )

    const deltas: string[] = []
    const result = await streamChatCompletion(baseRequest, (delta) => deltas.push(delta))

    expect(deltas).toEqual(['你', '好'])
    expect(result.content).toBe('你好')
    expect(result.finishReason).toBe('tool_calls')
    expect(result.toolCalls).toEqual([
      {
        id: 'call_a',
        type: 'function',
        function: { name: 'click_element', arguments: '{"ref":"ref-1"}' },
      },
    ])
  })

  it('reports incompatible streams instead of returning empty content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(['data: not-json\n\n'])))

    const error = await streamChatCompletion(baseRequest, () => {}).catch(
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(LLMError)
    expect((error as LLMError).code).toBe('protocol')
  })
})
