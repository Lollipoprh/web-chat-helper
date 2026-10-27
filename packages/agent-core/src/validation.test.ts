import { describe, expect, it } from 'vitest'
import { validateToolArguments, type JsonSchema } from './validation'

const schema: JsonSchema = {
  type: 'object',
  properties: {
    ref: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 20 },
    mode: { type: 'string', enum: ['fast', 'safe'] },
    flags: { type: 'array', items: { type: 'boolean' } },
  },
  required: ['ref'],
  additionalProperties: false,
}

describe('validateToolArguments', () => {
  it('accepts valid arguments', () => {
    const result = validateToolArguments(schema, { ref: 'ref-1', limit: 5, mode: 'safe' })
    expect(result.ok).toBe(true)
  })

  it('rejects non-object arguments', () => {
    expect(validateToolArguments(schema, []).ok).toBe(false)
    expect(validateToolArguments(schema, null).ok).toBe(false)
    expect(validateToolArguments(schema, 'ref-1').ok).toBe(false)
  })

  it('reports missing required fields', () => {
    const result = validateToolArguments(schema, { limit: 3 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('arguments.ref')
  })

  it('reports type, range and enum violations', () => {
    const result = validateToolArguments(schema, { ref: 1, limit: 99, mode: 'other' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('arguments.ref')
    expect(result.error).toContain('arguments.limit')
    expect(result.error).toContain('arguments.mode')
  })

  it('rejects unknown properties when additionalProperties is false', () => {
    const result = validateToolArguments(schema, { ref: 'ref-1', extra: true })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('arguments.extra')
  })

  it('validates array items', () => {
    const result = validateToolArguments(schema, { ref: 'ref-1', flags: [true, 'yes'] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('arguments.flags[1]')
  })
})
