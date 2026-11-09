import { useState } from 'react'
import {
  maskApiKey,
  parseEndpoint,
  testConnection,
  type ProviderConfig,
  type ProviderDraft,
} from 'llm-client'
import { requestOriginPermission } from '../shared/permissions'
import { useI18n } from '../shared/useI18n'
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
  const { t } = useI18n()
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
    if (!name.trim()) return t('providerForm.errName')
    if (!baseUrl.trim()) return t('providerForm.errBaseUrl')
    if (!apiKey.trim()) return t('providerForm.errApiKey')
    if (!model.trim()) return t('providerForm.errModel')
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
        message: parsedEndpoint ? parsedEndpoint.error : t('providerForm.errBaseUrl'),
      })
      return
    }

    // 重要：权限申请必须紧贴用户点击，前面不能有其他 await
    const granted = await requestOriginPermission(parsedEndpoint.endpoint.originPattern)
    if (!granted) {
      setTestFeedback({
        ok: false,
        message: t('providerForm.errPermission', { origin: parsedEndpoint.endpoint.origin }),
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
      message: t('providerForm.testResult', {
        message: result.message,
        ms: result.durationMs,
      }),
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
      setFormError(parsedEndpoint ? parsedEndpoint.error : t('providerForm.errBaseUrl'))
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
    <Card
      title={initial ? t('providerForm.editTitle') : t('providerForm.newTitle')}
      style={{ marginTop: space.xl }}
    >
      <div style={{ marginTop: space.xl }}>
        <Field label={t('providerForm.nameLabel')}>
          <Input
            value={name}
            placeholder={t('providerForm.namePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label="Base URL"
          hint={
            <>
              {t('providerForm.baseUrlHint')}
              {parsedEndpoint && (
                <span
                  style={{
                    display: 'block',
                    marginTop: space.xs,
                    color: parsedEndpoint.ok ? color.textMuted : color.danger,
                  }}
                >
                  {parsedEndpoint.ok
                    ? t('providerForm.resolvedUrl', {
                        url: parsedEndpoint.endpoint.chatCompletionsUrl,
                      })
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
          hint={
            apiKey.trim() && !showKey
              ? t('providerForm.apiKeyHint', { masked: maskApiKey(apiKey) })
              : undefined
          }
        >
          <div style={{ display: 'flex', gap: space.md }}>
            <Input
              id="provider-api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              placeholder={t('providerForm.apiKeyPlaceholder')}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setApiKey(event.target.value)}
            />
            <Button
              variant="secondary"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? t('providerForm.hideKey') : t('providerForm.showKey')}
            </Button>
          </div>
        </Field>

        <Field label="Model">
          <Input
            value={model}
            placeholder={t('providerForm.modelPlaceholder')}
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
            label={t('providerForm.supportsStreaming')}
          />
          <Checkbox
            checked={supportsToolCalls}
            onChange={(event) => setSupportsToolCalls(event.target.checked)}
            label={t('providerForm.supportsToolCalls')}
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
            loadingText={t('providerForm.saving')}
            disabled={testing}
            onClick={() => void handleSubmit()}
          >
            {t('common.save')}
          </Button>
          <Button
            variant="secondary"
            loading={testing}
            loadingText={t('providerForm.testing')}
            disabled={saving}
            onClick={() => void handleTest()}
          >
            {t('providerForm.test')}
          </Button>
          <Button variant="danger" disabled={saving} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
