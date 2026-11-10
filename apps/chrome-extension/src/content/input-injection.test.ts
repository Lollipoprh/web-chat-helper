import { describe, expect, it } from 'vitest'
import {
  codePointLength,
  describeFillFailure,
  evaluateFill,
  looseMatch,
  normalizeForCompare,
  planFillStrategies,
} from './input-injection'
import type { FillOutcome } from './input-injection'

describe('planFillStrategies', () => {
  it('prefers the native editing command for text inputs', () => {
    expect(
      planFillStrategies({
        kind: 'input',
        inputType: 'text',
        hasOwnValueAccessor: false,
        commandAvailable: true,
      }),
    ).toEqual(['insert-text-command', 'native-value-setter'])
  })

  it('adds the instance setter only when the element has its own value accessor', () => {
    expect(
      planFillStrategies({
        kind: 'input',
        inputType: 'tel',
        hasOwnValueAccessor: true,
        commandAvailable: true,
      }),
    ).toEqual(['insert-text-command', 'native-value-setter', 'instance-value-setter'])
  })

  it('skips insertText for input types the browser formats itself', () => {
    expect(
      planFillStrategies({
        kind: 'input',
        inputType: 'number',
        hasOwnValueAccessor: false,
        commandAvailable: true,
      }),
    ).toEqual(['native-value-setter'])
    expect(
      planFillStrategies({
        kind: 'input',
        inputType: 'date',
        hasOwnValueAccessor: true,
        commandAvailable: true,
      }),
    ).toEqual(['native-value-setter', 'instance-value-setter'])
  })

  it('uses editing commands for textareas and contenteditable', () => {
    expect(
      planFillStrategies({
        kind: 'textarea',
        hasOwnValueAccessor: false,
        commandAvailable: true,
      }),
    ).toEqual(['insert-text-command', 'native-value-setter'])
    expect(
      planFillStrategies({ kind: 'contenteditable', hasOwnValueAccessor: true, commandAvailable: true }),
    ).toEqual(['insert-text-command'])
  })

  it('falls back to value setters when execCommand is unavailable', () => {
    expect(
      planFillStrategies({
        kind: 'input',
        inputType: 'text',
        hasOwnValueAccessor: false,
        commandAvailable: false,
      }),
    ).toEqual(['native-value-setter'])
  })
})

describe('evaluateFill', () => {
  it('reports committed when the field holds exactly what was written', () => {
    expect(evaluateFill('13800001234', '13800001234', '')).toBe('committed')
  })

  it('reports formatted when the page only added separators', () => {
    expect(evaluateFill('13800001234', '1380 000 1234', '')).toBe('formatted')
    expect(evaluateFill('1234567.89', '1,234,567.89', '')).toBe('formatted')
  })

  it('reports reverted when the value is unchanged from before', () => {
    expect(evaluateFill('hello', '', '')).toBe('reverted')
    expect(evaluateFill('hello', 'old', 'old')).toBe('reverted')
  })

  it('reports partial when the page truncated the value', () => {
    expect(evaluateFill('hello world', 'hello', '')).toBe('partial')
  })

  it('reports empty when nothing survived the write', () => {
    expect(evaluateFill('hello', '   ', 'previous')).toBe('empty')
  })
})

describe('text helpers', () => {
  it('normalizes whitespace variants', () => {
    expect(normalizeForCompare('  a\u00a0\u3000 b\n\nc ')).toBe('a b c')
  })

  it('matches masked values by stripping separators', () => {
    expect(looseMatch('13800001234', '138-0000-1234')).toBe(true)
    expect(looseMatch('13800001234', '1380000123')).toBe(false)
    expect(looseMatch('', '')).toBe(false)
  })

  it('counts code points instead of UTF-16 units', () => {
    expect(codePointLength('你好')).toBe(2)
    expect(codePointLength('👍🏽')).toBe(2)
    expect(codePointLength('👨‍👩‍👧‍👦')).toBe(7)
  })
})

describe('describeFillFailure', () => {
  const base: FillOutcome = {
    committed: false,
    verdict: 'reverted',
    actual: '',
    attempts: [{ strategy: 'native-value-setter', actual: '' }],
  }

  it('explains that the page reverted the write', () => {
    const message = describeFillFailure(base, 'hello', '「手机号」')
    expect(message).toContain('改回了原样')
    expect(message).toContain('「手机号」')
    expect(message).toContain('click_element')
  })

  it('explains a cancelled beforeinput', () => {
    const message = describeFillFailure(
      {
        ...base,
        attempts: [{ strategy: 'native-value-setter', actual: '', note: 'beforeinput_cancelled' }],
      },
      'hello',
      '「手机号」',
    )
    expect(message).toContain('beforeinput')
  })

  it('reports partial writes with both lengths', () => {
    const message = describeFillFailure(
      { ...base, verdict: 'partial', actual: '1380' },
      '13800001234',
      '「手机号」',
    )
    expect(message).toContain('4/11')
    expect(message).toContain('已恢复原值')
  })

  it('reports empty fields', () => {
    const message = describeFillFailure({ ...base, verdict: 'empty' }, 'hello', '「搜索」')
    expect(message).toContain('仍为空')
  })
})
