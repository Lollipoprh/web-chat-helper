// API Key 加解密封装
//
// 威胁模型：防止同机用户随手打开 chrome.storage.local 的 LevelDB 就看到明文 API Key。
// 这**不是**密钥保险库 —— 静态主密钥硬编码在源码里，能拿到扩展源码 / 内存 dump 的人
// 照样能解，也不防同机恶意进程的主动攻击。实际作用是把裸奔的明文变成「看起来没东西」。
//
// 算法：AES-256-GCM，密钥由 PBKDF2-SHA256(静态主密钥 + 每实例 salt) 派生。
// 密文格式：`enc:v1:` + base64(salt(16) || iv(12) || ciphertext || gcmTag(16))
// 无前缀的 apiKey 视为明文（老数据兼容）。

import type { ProviderConfig } from 'llm-client'

/** 密文前缀，用来区分「已经加密过」和「还是老的明文」 */
export const ENCRYPTED_PREFIX = 'enc:v1:'

/** salt 存到 chrome.storage.local 的键名 */
const SALT_STORAGE_KEY = '__enc_salt__'

/** 每个扩展实例 salt 长度 */
const SALT_BYTE_LEN = 16
/** AES-GCM nonce / iv 长度 */
const IV_BYTE_LEN = 12
/** GCM tag 长度（subtle.encrypt 会把 tag 拼在 ciphertext 末尾一起返回） */
const TAG_BYTE_LEN = 16
/** AES-256 密钥长度 */
const AES_KEY_BYTE_LEN = 32
/** PBKDF2 迭代次数 —— 足以抵御 GPU 撞库，又不拖慢每次打开面板 */
const PBKDF2_ITERATIONS = 100_000

/**
 * 静态主密钥。32 字节随机数，base64 后写死在源码里。
 * 注意：把它改了会导致所有已加密的 apiKey 全部解不开，
 *       因此**不要随意改动这个常量**。
 */
const STATIC_MASTER_KEY_B64 =
  'dGlzLWlzLWEtMzlieXRlLXN0YXRpYy1tYXN0ZXIta2V5LWZvci1hZXMtMjU2LWdjbQ=='

let _saltPromise: Promise<Uint8Array> | null = null
let _derivedKeyPromise: Promise<CryptoKey> | null = null

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)
}

/** base64 → Uint8Array。浏览器环境用 atob + TextEncoder 手动转，避免 UTF-8 问题。 */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff
  return out
}

/** Uint8Array → base64。 */
function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** UTF-8 字符串 → Uint8Array。 */
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/** Uint8Array → UTF-8 字符串。 */
function bytesToStr(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/**
 * TS 5.4+ 里 `Uint8Array` 默认绑定 `ArrayBufferLike`（含 SharedArrayBuffer），
 * 但 Web Crypto 的 BufferSource 只接受绑定普通 ArrayBuffer 的视图。
 * 这里做一次显式复制 + 类型断言，生成确定为 ArrayBuffer 绑定的数组。
 */
function toCryptoInput(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>
}

/**
 * 确保 salt 存在。首次调用会生成随机 salt 并存入 chrome.storage.local，
 * 后续调用直接返回缓存。模块内 Promise 单例，防并发下重复写入。
 */
function ensureSalt(): Promise<Uint8Array> {
  if (_saltPromise) return _saltPromise
  _saltPromise = (async () => {
    const stored = await chrome.storage.local.get(SALT_STORAGE_KEY)
    const raw = stored[SALT_STORAGE_KEY]
    if (typeof raw === 'string' && raw.length > 0) {
      return b64ToBytes(raw)
    }
    const fresh = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LEN))
    await chrome.storage.local.set({ [SALT_STORAGE_KEY]: bytesToB64(fresh) })
    return fresh
  })()
  return _saltPromise
}

/**
 * 由静态主密钥 + 每实例 salt 派生 AES-GCM 密钥。
 * Promise 单例，避免每次加解密都重复 importKey + deriveKey。
 */
async function getAesKey(): Promise<CryptoKey> {
  if (_derivedKeyPromise) return _derivedKeyPromise
  _derivedKeyPromise = (async () => {
    const salt = await ensureSalt()
    const masterBytes = b64ToBytes(STATIC_MASTER_KEY_B64)

    const baseKey = await crypto.subtle.importKey(
      'raw',
      toCryptoInput(masterBytes),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toCryptoInput(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: AES_KEY_BYTE_LEN * 8 },
      false,
      ['encrypt', 'decrypt'],
    )
  })()
  return _derivedKeyPromise
}

/**
 * 加密一段明文。返回带 `enc:v1:` 前缀的 base64 字符串。
 * 抛错只在 Web Crypto 不可用或 storage 异常时发生（极端情况）。
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext
  if (isEncrypted(plaintext)) return plaintext // 幂等：已经是密文了就直接返回

  const aesKey = await getAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LEN))
  const cipherWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toCryptoInput(iv) },
      aesKey,
      toCryptoInput(strToBytes(plaintext)),
    ),
  )

  // 拼装：salt(16) || iv(12) || ciphertext || gcmTag(16)
  const salt = await ensureSalt()
  const packed = new Uint8Array(SALT_BYTE_LEN + IV_BYTE_LEN + cipherWithTag.length)
  packed.set(salt, 0)
  packed.set(iv, SALT_BYTE_LEN)
  packed.set(cipherWithTag, SALT_BYTE_LEN + IV_BYTE_LEN)

  return ENCRYPTED_PREFIX + bytesToB64(packed)
}

/**
 * 解密一段密文。
 * - 无前缀 → 直接返回原串（老数据兼容）。
 * - 有前缀但解密失败（GCM tag 校验不过 / 格式不对）→ 抛 Error，由上层决定怎么处理。
 */
export async function decryptApiKey(ciphertext: string): Promise<string> {
  if (!isEncrypted(ciphertext)) return ciphertext // 明文原样返回

  const packed = b64ToBytes(ciphertext.slice(ENCRYPTED_PREFIX.length))
  if (packed.length < SALT_BYTE_LEN + IV_BYTE_LEN + TAG_BYTE_LEN) {
    throw new Error('[encryption] 密文长度异常，无法解密')
  }

  const salt = packed.slice(0, SALT_BYTE_LEN)
  const iv = packed.slice(SALT_BYTE_LEN, SALT_BYTE_LEN + IV_BYTE_LEN)
  const cipherWithTag = packed.slice(SALT_BYTE_LEN + IV_BYTE_LEN)

  // 用密文里自带的 salt 派生 key，**不要**用缓存的那个（它是当前实例 salt，
  // 但如果用户重装/换 salt 了，缓存 key 会解不开老数据；保险起见每次按密文 salt 派生）。
  const masterBytes = b64ToBytes(STATIC_MASTER_KEY_B64)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toCryptoInput(masterBytes),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toCryptoInput(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BYTE_LEN * 8 },
    false,
    ['decrypt'],
  )

  try {
    const plainBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toCryptoInput(iv) },
      aesKey,
      toCryptoInput(cipherWithTag),
    )
    return bytesToStr(new Uint8Array(plainBytes))
  } catch (err) {
    // GCM 解密失败 = tag 对不上 → 密文被篡改 / 密钥不对
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[encryption] 解密失败：${msg}`)
  }
}

/**
 * 对 ProviderConfig 里的 apiKey 字段做加解密。其他字段不动。
 * 解密失败不抛错 —— 上层 loadProviders 调 decryptInList 时，
 * 某个 provider 解不开只把它的 apiKey 置空，不要让整个列表挂掉。
 */
export async function encryptInList(
  providers: ProviderConfig[],
): Promise<ProviderConfig[]> {
  return Promise.all(
    providers.map(async (p) => ({ ...p, apiKey: await encryptApiKey(p.apiKey) })),
  )
}

export async function decryptInList(
  providers: ProviderConfig[],
): Promise<ProviderConfig[]> {
  return Promise.all(
    providers.map(async (p) => {
      try {
        return { ...p, apiKey: await decryptApiKey(p.apiKey) }
      } catch (err) {
        console.warn('[encryption] 某个 provider 的 apiKey 无法解密，已清空：', err)
        return { ...p, apiKey: '' }
      }
    }),
  )
}
