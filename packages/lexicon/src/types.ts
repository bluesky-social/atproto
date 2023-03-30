import { z } from 'zod'
import { NSID } from '@atproto/nsid'

// primitives
// =

export const lexBoolean = z.object({
  type: z.literal('boolean'),
  description: z.string().optional(),
  default: z.boolean().optional(),
  const: z.boolean().optional(),
})
export type LexBoolean = z.infer<typeof lexBoolean>

export const lexFloat = z.object({
  type: z.literal('float'),
  description: z.string().optional(),
  default: z.number().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  enum: z.number().array().optional(),
  const: z.number().optional(),
})
export type LexFloat = z.infer<typeof lexFloat>

export const lexInteger = z.object({
  type: z.literal('integer'),
  description: z.string().optional(),
  default: z.number().int().optional(),
  minimum: z.number().int().optional(),
  maximum: z.number().int().optional(),
  enum: z.number().int().array().optional(),
  const: z.number().int().optional(),
})
export type LexInteger = z.infer<typeof lexInteger>

export const lexStringFormat = z.enum([
  'datetime',
  'uri',
  'at-uri',
  'did',
  'handle',
  'at-identifier',
  'nsid',
  'cid',
])
export type LexStringFormat = z.infer<typeof lexStringFormat>

export const lexString = z.object({
  type: z.literal('string'),
  format: lexStringFormat.optional(),
  description: z.string().optional(),
  default: z.string().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  minGraphemes: z.number().int().optional(),
  maxGraphemes: z.number().int().optional(),
  enum: z.string().array().optional(),
  const: z.string().optional(),
  knownValues: z.string().array().optional(),
})
export type LexString = z.infer<typeof lexString>

export const lexUnknown = z.object({
  type: z.literal('unknown'),
  description: z.string().optional(),
})
export type LexUnknown = z.infer<typeof lexUnknown>

export const lexPrimitive = z.union([
  lexBoolean,
  lexFloat,
  lexInteger,
  lexString,
  lexUnknown,
])
export type LexPrimitive = z.infer<typeof lexPrimitive>

// ipld types
// =

export const lexBytes = z.object({
  type: z.literal('bytes'),
  description: z.string().optional(),
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
})
export type LexBytes = z.infer<typeof lexBytes>

export const lexCidLink = z.object({
  type: z.literal('cid-link'),
  description: z.string().optional(),
})
export type LexCidLink = z.infer<typeof lexCidLink>

export const lexIpldType = z.union([lexBytes, lexCidLink])
export type LexIpldType = z.infer<typeof lexIpldType>

// references
// =

export const lexRef = z.object({
  type: z.literal('ref'),
  description: z.string().optional(),
  ref: z.string(),
})
export type LexRef = z.infer<typeof lexRef>

export const lexRefUnion = z.object({
  type: z.literal('union'),
  description: z.string().optional(),
  refs: z.string().array(),
  closed: z.boolean().optional(),
})
export type LexRefUnion = z.infer<typeof lexRefUnion>

export const lexRefVariant = z.union([lexRef, lexRefUnion])
export type LexRefVariant = z.infer<typeof lexRefVariant>

// blobs
// =

export const lexBlob = z.object({
  type: z.literal('blob'),
  description: z.string().optional(),
  accept: z.string().array().optional(),
  maxSize: z.number().optional(),
})
export type LexBlob = z.infer<typeof lexBlob>

// complex types
// =

export const lexArray = z.object({
  type: z.literal('array'),
  description: z.string().optional(),
  items: z.union([lexPrimitive, lexIpldType, lexBlob, lexRefVariant]),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
})
export type LexArray = z.infer<typeof lexArray>

export const lexPrimitiveArray = lexArray.merge(
  z.object({
    items: lexPrimitive,
  }),
)
export type LexPrimitiveArray = z.infer<typeof lexPrimitiveArray>

export const lexToken = z.object({
  type: z.literal('token'),
  description: z.string().optional(),
})
export type LexToken = z.infer<typeof lexToken>

export const lexObject = z.object({
  type: z.literal('object'),
  description: z.string().optional(),
  required: z.string().array().optional(),
  nullable: z.string().array().optional(),
  properties: z
    .record(
      z.union([lexRefVariant, lexIpldType, lexArray, lexBlob, lexPrimitive]),
    )
    .optional(),
})
export type LexObject = z.infer<typeof lexObject>

// xrpc
// =

export const lexXrpcParameters = z.object({
  type: z.literal('params'),
  description: z.string().optional(),
  required: z.string().array().optional(),
  properties: z.record(z.union([lexPrimitive, lexPrimitiveArray])),
})
export type LexXrpcParameters = z.infer<typeof lexXrpcParameters>

export const lexXrpcBody = z.object({
  description: z.string().optional(),
  encoding: z.string(),
  schema: z.union([lexRefVariant, lexObject]).optional(),
})
export type LexXrpcBody = z.infer<typeof lexXrpcBody>

export const lexXrpcSubscriptionMessage = z.object({
  description: z.string().optional(),
  schema: z.union([lexRefVariant, lexObject]).optional(),
})
export type LexXrpcSubscriptionMessage = z.infer<
  typeof lexXrpcSubscriptionMessage
>

export const lexXrpcError = z.object({
  name: z.string(),
  description: z.string().optional(),
})
export type LexXrpcError = z.infer<typeof lexXrpcError>

export const lexXrpcQuery = z.object({
  type: z.literal('query'),
  description: z.string().optional(),
  parameters: lexXrpcParameters.optional(),
  output: lexXrpcBody.optional(),
  errors: lexXrpcError.array().optional(),
})
export type LexXrpcQuery = z.infer<typeof lexXrpcQuery>

export const lexXrpcProcedure = z.object({
  type: z.literal('procedure'),
  description: z.string().optional(),
  parameters: lexXrpcParameters.optional(),
  input: lexXrpcBody.optional(),
  output: lexXrpcBody.optional(),
  errors: lexXrpcError.array().optional(),
})
export type LexXrpcProcedure = z.infer<typeof lexXrpcProcedure>

export const lexXrpcSubscription = z.object({
  type: z.literal('subscription'),
  description: z.string().optional(),
  parameters: lexXrpcParameters.optional(),
  message: lexXrpcSubscriptionMessage.optional(),
  infos: lexXrpcError.array().optional(),
  errors: lexXrpcError.array().optional(),
})
export type LexXrpcSubscription = z.infer<typeof lexXrpcSubscription>

// database
// =

export const lexRecord = z.object({
  type: z.literal('record'),
  description: z.string().optional(),
  key: z.string().optional(),
  record: lexObject,
})
export type LexRecord = z.infer<typeof lexRecord>

// core
// =

export const lexUserType = z.union([
  lexRecord,

  lexXrpcQuery,
  lexXrpcProcedure,
  lexXrpcSubscription,

  lexBlob,

  lexArray,
  lexToken,
  lexObject,

  lexBoolean,
  lexFloat,
  lexInteger,
  lexString,
  lexBytes,
  lexCidLink,
  lexUnknown,
])
export type LexUserType = z.infer<typeof lexUserType>

export const lexiconDoc = z
  .object({
    lexicon: z.literal(1),
    id: z.string().refine((v: string) => NSID.isValid(v), {
      message: 'Must be a valid NSID',
    }),
    revision: z.number().optional(),
    description: z.string().optional(),
    defs: z.record(lexUserType),
  })
  .superRefine((doc: LexiconDoc, ctx) => {
    for (const defId in doc.defs) {
      const def = doc.defs[defId]
      if (
        defId !== 'main' &&
        (def.type === 'record' ||
          def.type === 'procedure' ||
          def.type === 'query' ||
          def.type === 'subscription')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Records, procedures, queries, and subscriptions must be the main definition.`,
        })
      }
    }
  })
export type LexiconDoc = z.infer<typeof lexiconDoc>

// helpers
// =

export function isValidLexiconDoc(v: unknown): v is LexiconDoc {
  return lexiconDoc.safeParse(v).success
}

export function isObj(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object'
}

export function hasProp<K extends PropertyKey>(
  data: object,
  prop: K,
): data is Record<K, unknown> {
  return prop in data
}

export const discriminatedObject = z.object({ $type: z.string() })
export type DiscriminatedObject = z.infer<typeof discriminatedObject>
export function isDiscriminatedObject(
  value: unknown,
): value is DiscriminatedObject {
  return discriminatedObject.safeParse(value).success
}

export class LexiconDocMalformedError extends Error {
  constructor(
    message: string,
    public schemaDef: unknown,
    public issues?: z.ZodIssue[],
  ) {
    super(message)
    this.schemaDef = schemaDef
    this.issues = issues
  }
}

export type ValidationResult =
  | {
      success: true
      value: unknown
    }
  | {
      success: false
      error: ValidationError
    }

export class ValidationError extends Error {}
export class InvalidLexiconError extends Error {}
export class LexiconDefNotFoundError extends Error {}
