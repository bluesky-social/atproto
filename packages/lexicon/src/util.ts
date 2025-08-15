import { z } from 'zod'

export function toLexUri(str: string, baseUri?: string): string {
  if (str.split('#').length > 2) {
    throw new Error('Uri can only have one hash segment')
  }

  if (str.startsWith('lex:')) {
    return str
  }
  if (str.startsWith('#')) {
    if (!baseUri) {
      throw new Error(`Unable to resolve uri without anchor: ${str}`)
    }
    return `${baseUri}${str}`
  }
  return `lex:${str}`
}

export function requiredPropertiesRefinement<
  ObjectType extends {
    required?: string[]
    properties?: Record<string, unknown>
  },
>(object: ObjectType, ctx: z.RefinementCtx) {
  // Required fields check
  if (object.required === undefined) {
    return
  }

  if (!Array.isArray(object.required)) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      received: typeof object.required,
      expected: 'array',
    })
    return
  }

  if (object.properties === undefined) {
    if (object.required.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Required fields defined but no properties defined`,
      })
    }
    return
  }

  for (const field of object.required) {
    if (object.properties[field] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Required field "${field}" not defined`,
      })
    }
  }
}
