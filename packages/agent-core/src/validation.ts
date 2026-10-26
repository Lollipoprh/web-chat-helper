// 轻量 JSON Schema 子集校验
// 只覆盖工具参数常用的约束：对象/字符串/数字/整数/布尔/数组、required、enum、范围、additionalProperties
// 目的不是实现完整 JSON Schema，而是在执行前拦住模型写坏的参数

export interface JsonSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: Array<string | number | boolean | null>
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  additionalProperties?: boolean
  default?: unknown
}

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }

/** 校验工具参数，顶层必须是对象 */
export function validateToolArguments(schema: JsonSchema, args: unknown): ValidationResult {
  if (!isPlainObject(args)) {
    return { ok: false, error: '参数必须是 JSON 对象' }
  }

  const errors: string[] = []
  validateInto(schema, args, 'arguments', errors)

  if (errors.length > 0) {
    const head = errors.slice(0, 3).join('；')
    return { ok: false, error: errors.length > 3 ? `${head}（另有更多错误）` : head }
  }

  return { ok: true, value: args }
}

function validateInto(
  schema: JsonSchema,
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (schema.type) {
    const typeError = checkType(schema.type, value, path)
    if (typeError) {
      errors.push(typeError)
      return
    }
  }

  if (schema.enum && !schema.enum.some((option) => Object.is(option, value))) {
    errors.push(`${path} 必须是 ${schema.enum.map((option) => JSON.stringify(option)).join(' / ')} 之一`)
    return
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path} 不能小于 ${schema.minimum}`)
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${path} 不能大于 ${schema.maximum}`)
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path} 长度不能小于 ${schema.minLength}`)
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push(`${path} 长度不能大于 ${schema.maxLength}`)
    }
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      validateInto(schema.items as JsonSchema, item, `${path}[${index}]`, errors)
    })
    return
  }

  if (isPlainObject(value) && (schema.properties || schema.required)) {
    const properties = schema.properties ?? {}

    for (const key of schema.required ?? []) {
      if (!(key in value) || value[key] === undefined) {
        errors.push(`缺少必填参数 ${path}.${key}`)
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push(`不支持的参数 ${path}.${key}`)
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      const childValue = value[key]
      if (childValue === undefined) continue
      validateInto(childSchema, childValue, `${path}.${key}`, errors)
    }
  }
}

function checkType(
  type: NonNullable<JsonSchema['type']>,
  value: unknown,
  path: string,
): string | null {
  switch (type) {
    case 'object':
      return isPlainObject(value) ? null : `${path} 必须是对象`
    case 'array':
      return Array.isArray(value) ? null : `${path} 必须是数组`
    case 'string':
      return typeof value === 'string' ? null : `${path} 必须是字符串`
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : `${path} 必须是数字`
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
        ? null
        : `${path} 必须是整数`
    case 'boolean':
      return typeof value === 'boolean' ? null : `${path} 必须是布尔值`
    default:
      return null
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
