import { CID } from 'multiformats/cid'
import { z } from 'zod'

// The longest CID CID.parse() can legitimately produce (CIDv1 with a sha512
// digest) is 110 characters in base32, 105 in base36 and 93 in base58btc.
// Longer inputs are rejected before decoding because the base36 and base58btc
// decoders in multiformats run in time quadratic in the input length.
const MAX_CID_STRING_LENGTH = 128

/**
 * Length-bounded wrapper around `CID.parse()`.
 *
 * @throws if the input is not a valid CID string or is too long to be one.
 */
export function parseCidString(input: string): CID {
  if (input.length > MAX_CID_STRING_LENGTH) {
    throw new Error(
      `CID string too long (${input.length} > ${MAX_CID_STRING_LENGTH})`,
    )
  }
  return CID.parse(input)
}

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
