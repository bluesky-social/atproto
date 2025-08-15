import { z } from 'zod'
import { ensureValidDid, isValidNsid } from '@atproto/syntax'

export const nsidSchema = z.string().refine(isValidNsid, {
  message: 'Must be a valid NSID',
})

export const didSchema = z.string().superRefine((input, ctx) => {
  try {
    ensureValidDid(input)
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid DID',
    })
  }
})

export const acceptSchema = z.string().refine(
  (v): v is '*/*' | `${string}/*` | `${string}/${string}` => {
    if (v === '*/*') return true
    const parts = v.split('/')
    const { length, 0: a, 1: b } = parts
    if (length !== 2) return false
    if (a.includes('*')) return false
    if (b !== '*' && b.includes('*')) return false
    return true
  },
  { message: 'Invalid accept MIME' },
)

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
