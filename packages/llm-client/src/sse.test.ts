import { describe, expect, it } from 'vitest'
import { consumeSseStream } from './sse'

const encoder = new TextEncoder()

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function collect(chunks: Array<string | Uint8Array>): Promise<string[]> {
  const events: string[] = []
  const bytes = chunks.map((chunk) => (typeof chunk === 'string' ? encoder.encode(chunk) : chunk))
  await consumeSseStream(streamOf(bytes), (data) => events.push(data))
  return events
}

describe('consumeSseStream', () => {
  it('does not depend on network chunk boundaries', async () => {
    const events = await collect(['da', 'ta: {"a":', '1}\n', '\n'])
    expect(events).toEqual(['{"a":1}'])
  })

  it('handles CRLF line endings', async () => {
    const events = await collect(['data: first\r\n\r\ndata: second\r\n\r\n'])
    expect(events).toEqual(['first', 'second'])
  })

  it('joins multiple data lines of one event', async () => {
    const events = await collect(['data: line1\ndata: line2\n\n'])
    expect(events).toEqual(['line1\nline2'])
  })

  it('ignores comments and non-data fields', async () => {
    const events = await collect([': heartbeat\nevent: message\nid: 7\ndata: payload\n\n'])
    expect(events).toEqual(['payload'])
  })

  it('flushes the last event without a trailing blank line', async () => {
    const events = await collect(['data: tail'])
    expect(events).toEqual(['tail'])
  })

  it('decodes multi-byte characters split across chunks', async () => {
    const full = encoder.encode('data: 你好\n\n')
    const events = await collect([full.slice(0, 8), full.slice(8)])
    expect(events).toEqual(['你好'])
  })
})
