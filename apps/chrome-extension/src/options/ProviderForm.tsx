import { useState } from 'react'
import {
  maskApiKey,
  parseEndpoint,
  testConnection,
  type ProviderConfig,
  type ProviderDraft,
} from 'llm-client'
import { requestOriginPermission } from '../shared/permissions'
import { Alert, Button, Card, Checkbox, Field, Input, color, space } from '../ui'

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
    <Card title={initial ? '编辑供应商' : '新增供应商'} style={{ marginTop: space.xl }}>
      <div style={{ marginTop: space.xl }}>
        <Field label="名称">
          <Input
            value={name}
            placeholder="例如：公司网关 / 本地模型"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Base URL"
          hint={
            <>
              支持根地址、带版本号地址，或完整的 <code>/chat/completions</code> 地址；仅支持
              HTTPS，本机地址可用 HTTP。
              {parsedEndpoint && (
                <span
                  style={{
                    display: 'block',
                    marginTop: space.xs,
                    color: parsedEndpoint.ok ? color.textMuted : color.danger,
                  }}
                >
                  {parsedEndpoint.ok
                    ? `实际请求：${parsedEndpoint.endpoint.chatCompletionsUrl}`
                    : parsedEndpoint.error}
                </span>
              )}
            </>
          }
        >
          <Input
            value={baseUrl}
            placeholder="https://api.your-provider.com/v1"
            spellCheck={false}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </Field>

        <Field
          label="API Key"
          htmlFor="provider-api-key"
          hint={apiKey.trim() && !showKey ? `当前填入：${maskApiKey(apiKey)}` : undefined}
        >
          <div style={{ display: 'flex', gap: space.md }}>
            <Input
              id="provider-api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder="仅保存在本机浏览器存储中"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <Button
              variant="secondary"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? '隐藏' : '显示'}
            </Button>
          </div>
        </Field>

        <Field label="Model">
          <Input
            value={model}
            placeholder="填写该服务商提供的模型名"
            spellCheck={false}
            onChange={(event) => setModel(event.target.value)}
          />
        </Field>

        <div
          style={{
            display: 'flex',
            gap: space.xxl,
            marginBottom: space.xl,
          }}
        >
          <Checkbox
            checked={supportsStreaming}
            onChange={(event) => setSupportsStreaming(event.target.checked)}
            label="支持流式输出"
          />
          <Checkbox
            checked={supportsToolCalls}
            onChange={(event) => setSupportsToolCalls(event.target.checked)}
            label="支持 Tool Calls"
          />
        </div>

        {formError && (
          <Alert tone="error" style={{ marginBottom: space.xl }}>
            {formError}
          </Alert>
        )}

        {testFeedback && (
          <Alert
            tone={testFeedback.ok ? 'success' : 'error'}
            style={{ marginTop: space.xs, marginBottom: space.xl }}
          >
            {testFeedback.message}
          </Alert>
        )}

        <div style={{ display: 'flex', gap: space.md, marginTop: space.xs }}>
          <Button
            variant="primary"
            loading={saving}
            loadingText="保存中…"
            disabled={testing}
            onClick={() => void handleSubmit()}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            loading={testing}
            loadingText="测试中…"
            disabled={saving}
            onClick={() => void handleTest()}
          >
            测试连接
          </Button>
          <Button variant="danger" disabled={saving} onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>
    </Card>
  )
}
