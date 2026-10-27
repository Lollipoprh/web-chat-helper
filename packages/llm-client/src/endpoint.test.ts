import { describe, expect, it } from 'vitest'
import { parseEndpoint } from './endpoint'

describe('parseEndpoint', () => {
  it('appends /chat/completions to a bare origin', () => {
    const result = parseEndpoint('https://api.example.com')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.endpoint.chatCompletionsUrl).toBe('https://api.example.com/chat/completions')
    expect(result.endpoint.originPattern).toBe('https://api.example.com/*')
    expect(result.endpoint.isLocal).toBe(false)
  })

  it('keeps the version path', () => {
    const result = parseEndpoint('https://api.example.com/v1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.endpoint.chatCompletionsUrl).toBe('https://api.example.com/v1/chat/completions')
  })

  it('does not duplicate an existing /chat/completions path', () => {
    const result = parseEndpoint(' https://api.example.com/v1/chat/completions/ ')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.endpoint.chatCompletionsUrl).toBe('https://api.example.com/v1/chat/completions')
  })

  it('allows http only for local hosts', () => {
    const local = parseEndpoint('http://localhost:8080/v1')
    expect(local.ok).toBe(true)
    if (!local.ok) return
    expect(local.endpoint.isLocal).toBe(true)
    expect(local.endpoint.chatCompletionsUrl).toBe('http://localhost:8080/v1/chat/completions')

    const remote = parseEndpoint('http://api.example.com')
    expect(remote.ok).toBe(false)
  })

  it('rejects malformed or unsafe input', () => {
    expect(parseEndpoint('').ok).toBe(false)
    expect(parseEndpoint('api.example.com/v1').ok).toBe(false)
    expect(parseEndpoint('ftp://api.example.com').ok).toBe(false)
    expect(parseEndpoint('https://user:pass@api.example.com').ok).toBe(false)
    expect(parseEndpoint('https://api.example.com?key=1').ok).toBe(false)
    expect(parseEndpoint('https://api.example.com#section').ok).toBe(false)
  })
})
