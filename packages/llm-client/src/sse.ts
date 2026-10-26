// Server-Sent Events 解析器
// 关键约束：网络分块边界与 SSE 事件边界无关，绝不能假设单个 chunk 就是完整 JSON。
// 这里按行累积、以空行作为事件分隔，最后才把 data 交给调用方解析。

export async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  onEventData: (data: string) => void,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''
  let dataLines: string[] = []

  const dispatch = () => {
    if (dataLines.length === 0) return
    const data = dataLines.join('\n')
    dataLines = []
    if (data) onEventData(data)
  }

  const handleLine = (rawLine: string) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine

    // 空行表示一个事件结束
    if (line === '') {
      dispatch()
      return
    }
    // 以冒号开头的是注释/心跳，直接忽略
    if (line.startsWith(':')) return

    const colonIndex = line.indexOf(':')
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'data') {
      dataLines.push(value)
    }
    // event / id / retry 等字段当前不需要
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        handleLine(line)
        newlineIndex = buffer.indexOf('\n')
      }
    }

    // 冲刷解码器与残留缓冲，避免最后一条事件丢失
    buffer += decoder.decode()
    if (buffer) handleLine(buffer)
    dispatch()
  } finally {
    reader.releaseLock()
  }
}
