import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * 在每个测试前 mock chrome.storage.local，并清空模块缓存。
 *
 * encryption 模块有两层模块级缓存：
 *   1. ensureSalt 会把 salt 存进 chrome.storage.local，首次调用后读缓存
 *   2. getAesKey 会缓存派生出来的 AES key
 * 所以每个测试必须用 vi.resetModules() 让它们重新初始化，否则前一个测试的状态会串到后一个。
 */
function setupChromeMock(): Record<string, unknown> {
  const store: Record<string, unknown> = {}
  const api = {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | null) => {
          if (keys === null) return { ...store }
          if (typeof keys === 'string') return { [keys]: store[keys] }
          const out: Record<string, unknown> = {}
          for (const k of keys) out[k] = store[k]
          return out
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items)
        }),
        remove: vi.fn(async () => {}),
      },
    },
  }
  vi.stubGlobal('chrome', api)
  return store
}

/** 改动 base64 正文里的一个字符，确保密文真的被篡改（而不是碰巧替换成相同字符） */
function corruptBase64At(value: string, index: number): string {
  const target = value[index]
  const replacement = target === 'A' ? 'B' : 'A'
  return value.slice(0, index) + replacement + value.slice(index + 1)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('encryptApiKey / decryptApiKey', () => {
  it('round-trip 正确还原原文', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptApiKey } = await import('./encryption')

    const original = 'sk-test-abcdef1234567890xyz'
    const encrypted = await encryptApiKey(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toMatch(/^enc:v1:/)
    expect(encrypted.length).toBeGreaterThan(20) // 密文应该明显长于原文

    const decrypted = await decryptApiKey(encrypted)
    expect(decrypted).toBe(original)
  })

  it('空字符串不加前缀、保持原样', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptApiKey } = await import('./encryption')

    expect(await encryptApiKey('')).toBe('')
    expect(await decryptApiKey('')).toBe('')
  })

  it('对已加密字符串幂等，不重复加密', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptApiKey } = await import('./encryption')

    const once = await encryptApiKey('hello')
    const twice = await encryptApiKey(once)
    expect(twice).toBe(once)
    expect(await decryptApiKey(twice)).toBe('hello')
  })

  it('解密明文（无前缀）直接原样返回 —— 老数据兼容', async () => {
    setupChromeMock()
    const { decryptApiKey } = await import('./encryption')

    expect(await decryptApiKey('sk-legacy-plaintext')).toBe('sk-legacy-plaintext')
    expect(await decryptApiKey('')).toBe('')
  })

  it('密文被篡改一位 —— GCM 解密失败抛错', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptApiKey, ENCRYPTED_PREFIX } = await import('./encryption')

    const cipher = await encryptApiKey('sensitive-key')
    // base64 部分随便改一个字符
    const head = cipher.slice(0, ENCRYPTED_PREFIX.length)
    const body = cipher.slice(ENCRYPTED_PREFIX.length)
    const corrupted = head + corruptBase64At(body, 10)

    await expect(decryptApiKey(corrupted)).rejects.toThrow(/解密失败/)
  })

  it('密文长度不足也抛错', async () => {
    setupChromeMock()
    const { decryptApiKey, ENCRYPTED_PREFIX } = await import('./encryption')

    // 'AA==' 是合法 base64，但只解出 1 字节，远小于 salt+iv+tag 最小 44 字节
    await expect(decryptApiKey(ENCRYPTED_PREFIX + 'AA==')).rejects.toThrow(
      /长度异常/,
    )
  })
})

describe('salt 自动生成与持久化', () => {
  it('首次调用没有 salt 时会生成并存入 storage', async () => {
    const store = setupChromeMock()
    const { encryptApiKey } = await import('./encryption')

    await encryptApiKey('a')
    const saltInStore = (store as Record<string, unknown>)['__enc_salt__']
    expect(typeof saltInStore).toBe('string')
    expect((saltInStore as string).length).toBeGreaterThan(0)
  })

  it('第二次调用读到相同的 salt —— 加密结果可互解', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptApiKey } = await import('./encryption')

    const a = await encryptApiKey('key-a')
    const b = await encryptApiKey('key-b')
    expect(await decryptApiKey(a)).toBe('key-a')
    expect(await decryptApiKey(b)).toBe('key-b')
  })
})

describe('encryptInList / decryptInList', () => {
  const mkProvider = (apiKey: string) => ({
    id: 'p1',
    name: 'test',
    baseUrl: 'https://example.com',
    apiKey,
    model: 'gpt-4',
    supportsStreaming: true,
    supportsToolCalls: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  it('全是明文的列表 —— 加密后再解密恢复一致', async () => {
    setupChromeMock()
    const { encryptInList, decryptInList } = await import('./encryption')

    const original = [mkProvider('sk-aaa'), mkProvider('sk-bbb')]
    const encrypted = await encryptInList(original)
    expect(encrypted[0].apiKey).not.toBe('sk-aaa')
    expect(encrypted[1].apiKey).not.toBe('sk-bbb')
    // 其他字段保持
    expect(encrypted[0].id).toBe('p1')
    expect(encrypted[1].id).toBe('p1')

    const decrypted = await decryptInList(encrypted)
    expect(decrypted[0].apiKey).toBe('sk-aaa')
    expect(decrypted[1].apiKey).toBe('sk-bbb')
  })

  it('列表里混有明文、密文、空串 —— decryptInList 全部正确处理', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptInList } = await import('./encryption')

    const cipher = await encryptApiKey('cipher-key')
    const mixed = [
      mkProvider(cipher),        // 密文 → 解密成功
      mkProvider('legacy-plain'),// 明文 → 原样
      mkProvider(''),            // 空串 → 空
    ]
    const out = await decryptInList(mixed)
    expect(out[0].apiKey).toBe('cipher-key')
    expect(out[1].apiKey).toBe('legacy-plain')
    expect(out[2].apiKey).toBe('')
  })

  it('列表中某条密文被篡改 —— 只清该项 apiKey，其他正常', async () => {
    setupChromeMock()
    const { encryptApiKey, decryptInList, ENCRYPTED_PREFIX } = await import('./encryption')

    const good = await encryptApiKey('good-key')
    const good2 = await encryptApiKey('good-key-2')
    // 把中间那个密文改坏
    const head = good.slice(0, ENCRYPTED_PREFIX.length)
    const body = good.slice(ENCRYPTED_PREFIX.length)
    const bad = head + corruptBase64At(body, 10)

    const list = [mkProvider(good2), mkProvider(bad)]
    const out = await decryptInList(list)
    // 没抛错：坏的那条被置空
    expect(out.length).toBe(2)
    expect(out[0].apiKey).toBe('good-key-2')
    expect(out[1].apiKey).toBe('')
  })
})
