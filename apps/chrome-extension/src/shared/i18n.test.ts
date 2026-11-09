import { describe, expect, it } from 'vitest'
import { isLangPref, resolveLang, translate } from './i18n'

describe('translate', () => {
  it('interpolates {name} placeholders', () => {
    expect(translate('zh', 'sidepanel.checkpointNotice', { rounds: 3 })).toContain('第 3 轮')
    expect(translate('en', 'options.savedAt', { time: '12:00' })).toBe('Saved at 12:00')
  })

  it('keeps placeholders that were not supplied', () => {
    expect(translate('en', 'sidepanel.checkpointNotice')).toContain('{rounds}')
  })

  it('returns the key itself when it exists in no table', () => {
    expect(translate('en', 'missing.key' as never)).toBe('missing.key')
  })
})

describe('language preference', () => {
  it('pins an explicit preference', () => {
    expect(resolveLang('zh')).toBe('zh')
    expect(resolveLang('en')).toBe('en')
  })

  it('only accepts known preference values', () => {
    expect(isLangPref('auto')).toBe(true)
    expect(isLangPref('zh')).toBe(true)
    expect(isLangPref('en')).toBe(true)
    expect(isLangPref('fr')).toBe(false)
    expect(isLangPref(undefined)).toBe(false)
  })
})
