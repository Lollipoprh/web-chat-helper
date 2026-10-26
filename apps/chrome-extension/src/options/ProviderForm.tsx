import { useState } from 'react'
import {
  maskApiKey,
  parseEndpoint,
  testConnection,
  type ProviderConfig,
  type ProviderDraft,
} from 'llm-client'
import { requestOriginPermission } from '../shared/permissions'
import {
  cardStyle,
  dangerButtonStyle,
  disabledButtonStyle,
  errorTextStyle,
  fieldRowStyle,
  hintStyle,
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  sectionTitleStyle,
} from './styles'

interface ProviderFormProps {
  /** 传入表示编辑，不传表示新增 */
  initial?: ProviderConfig
  onSubmit: (draft: ProviderDraft) => Promise<void>
  onCancel: () => void
}

interface TestFeedback {
  ok: boolean
  message: string
}

export default function ProviderForm({ initial, onSubmit, onCancel }: ProviderFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [supportsStreaming, setSupportsStreaming] = useState(initial?.supportsStreaming ?? true)
  const [supportsToolCalls, setSupportsToolCalls] = useState(initial?.supportsToolCalls ?? true)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [testFeedback, setTestFeedback] = useState<TestFeedback | null>(null)

  // 端点解析结果，用于实时提示最终请求地址
  const parsedEndpoint = baseUrl.trim() ? parseEndpoint(baseUrl) : null

  function validateRequired(): string | null {
    if (!name.trim()) return '请填写供应商名称'
    if (!baseUrl.trim()) return '请填写 Base URL'
    if (!apiKey.trim()) return '请填写 API Key'
    if (!model.trim()) return '请填写 Model'
    return null
  }

  async function handleTest() {
    const missing = validateRequired()
    if (missing) {
      setTestFeedback({ ok: false, message: missing })
      return
    }

    if (!parsedEndpoint || !parsedEndpoint.ok) {
      setTestFeedback({
        ok: false,
        message: parsedEndpoint ? parsedEndpoint.error : '请填写 Base URL',
      })
      return
    }

    // 重要：权限申请必须紧贴用户点击，前面不能有其他 await
    const granted = await requestOriginPermission(parsedEndpoint.endpoint.originPattern)
    if (!granted) {
      setTestFeedback({
        ok: false,
        message: `未获得 ${parsedEndpoint.endpoint.origin} 的访问权限，无法测试连接`,
      })
      return
    }

    setTesting(true)
    setTestFeedback(null)
    const result = await testConnection({
      chatCompletionsUrl: parsedEndpoint.endpoint.chatCompletionsUrl,
      apiKey: apiKey.trim(),
      model: model.trim(),
    })
    setTestFeedback({
      ok: result.ok,
      message: `${result.message} · 用时 ${result.durationMs}ms`,
    })
    setTesting(false)
  }

  async function handleSubmit() {
    const missing = validateRequired()
    if (missing) {
      setFormError(missing)
      return
    }
    if (!parsedEndpoint || !parsedEndpoint.ok) {
      setFormError(parsedEndpoint ? parsedEndpoint.error : '请填写 Base URL')
      return
    }

    setFormError(null)
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
        supportsStreaming,
        supportsToolCalls,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={{ ...cardStyle, marginTop: 16 }}>
      <h2 style={sectionTitleStyle}>{initial ? '编辑供应商' : '新增供应商'}</h2>

      <div style={{ marginTop: 16 }}>
        <div style={fieldRowStyle}>
          <label style={labelStyle} htmlFor="provider-name">
            名称
          </label>
          <input
            id="provider-name"
            style={inputStyle}
            value={name}
            placeholder="例如：公司网关 / 本地模型"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div style={fieldRowStyle}>
          <label style={labelStyle} htmlFor="provider-base-url">
            Base URL
          </label>
          <input
            id="provider-base-url"
            style={inputStyle}
            value={baseUrl}
            placeholder="https://api.your-provider.com/v1"
            spellCheck={false}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
          <p style={hintStyle}>
            支持根地址、带版本号地址，或完整的 <code>/chat/completions</code> 地址；仅支持
            HTTPS，本机地址可用 HTTP。
          </p>
          {parsedEndpoint && (
            <p style={parsedEndpoint.ok ? hintStyle : errorTextStyle}>
              {parsedEndpoint.ok
                ? `实际请求：${parsedEndpoint.endpoint.chatCompletionsUrl}`
                : parsedEndpoint.error}
            </p>
          )}
        </div>

        <div style={fieldRowStyle}>
          <label style={labelStyle} htmlFor="provider-api-key">
            API Key
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="provider-api-key"
              style={inputStyle}
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder="仅保存在本机浏览器存储中"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <button
              type="button"
              style={{ ...secondaryButtonStyle, whiteSpace: 'nowrap' }}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          {apiKey.trim() && !showKey && (
            <p style={hintStyle}>当前填入：{maskApiKey(apiKey)}</p>
          )}
        </div>

        <div style={fieldRowStyle}>
          <label style={labelStyle} htmlFor="provider-model">
            Model
          </label>
          <input
            id="provider-model"
            style={inputStyle}
            value={model}
            placeholder="填写该服务商提供的模型名"
            spellCheck={false}
            onChange={(event) => setModel(event.target.value)}
          />
        </div>

        <div style={{ ...fieldRowStyle, display: 'flex', gap: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={supportsStreaming}
              onChange={(event) => setSupportsStreaming(event.target.checked)}
            />
            支持流式输出
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={supportsToolCalls}
              onChange={(event) => setSupportsToolCalls(event.target.checked)}
            />
            支持 Tool Calls
          </label>
        </div>

        {formError && <p style={errorTextStyle}>{formError}</p>}

        {testFeedback && (
          <div
            style={{
              marginTop: 4,
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 6,
              fontSize: 12,
              lineHeight: 1.6,
              background: testFeedback.ok ? '#ecfdf5' : '#fef2f2',
              color: testFeedback.ok ? '#047857' : '#b91c1c',
              border: `1px solid ${testFeedback.ok ? '#a7f3d0' : '#fecaca'}`,
              wordBreak: 'break-word',
            }}
          >
            {testFeedback.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            style={testing || saving ? disabledButtonStyle : primaryButtonStyle}
            disabled={testing || saving}
            onClick={handleSubmit}
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            style={testing || saving ? disabledButtonStyle : secondaryButtonStyle}
            disabled={testing || saving}
            onClick={handleTest}
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            style={dangerButtonStyle}
            disabled={saving}
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </section>
  )
}
