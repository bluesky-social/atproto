import { l } from '@atproto/lex-schema'

// https://atproto.com/specs/lexicon

// "Concrete" Types

export const lexiconBooleanSchema = l.object({
  type: l.literal('boolean'),
  default: l.optional(l.boolean()),
  const: l.optional(l.boolean()),
  description: l.optional(l.string()),
})
export type LexiconBoolean = l.Infer<typeof lexiconBooleanSchema>

export const lexiconIntegerSchema = l.object({
  type: l.literal('integer'),
  default: l.optional(l.integer()),
  minimum: l.optional(l.integer()),
  maximum: l.optional(l.integer()),
  enum: l.optional(l.array(l.integer())),
  const: l.optional(l.integer()),
  description: l.optional(l.string()),
})
export type LexiconInteger = l.Infer<typeof lexiconIntegerSchema>

export const lexiconStringSchema = l.object({
  type: l.literal('string'),
  format: l.optional(l.enum<l.StringFormat>(l.STRING_FORMATS)),
  default: l.optional(l.string()),
  minLength: l.optional(l.integer()),
  maxLength: l.optional(l.integer()),
  minGraphemes: l.optional(l.integer()),
  maxGraphemes: l.optional(l.integer()),
  enum: l.optional(l.array(l.string())),
  const: l.optional(l.string()),
  knownValues: l.optional(l.array(l.string())),
  description: l.optional(l.string()),
})
export type LexiconString = l.Infer<typeof lexiconStringSchema>

export const lexiconBytesSchema = l.object({
  type: l.literal('bytes'),
  maxLength: l.optional(l.integer()),
  minLength: l.optional(l.integer()),
  description: l.optional(l.string()),
})
export type LexiconBytes = l.Infer<typeof lexiconBytesSchema>

export const lexiconCidLinkSchema = l.object({
  type: l.literal('cid-link'),
  description: l.optional(l.string()),
})
export type LexiconCid = l.Infer<typeof lexiconCidLinkSchema>

export const lexiconBlobSchema = l.object({
  type: l.literal('blob'),
  accept: l.optional(l.array(l.string())),
  maxSize: l.optional(l.integer()),
  description: l.optional(l.string()),
})
export type LexiconBlob = l.Infer<typeof lexiconBlobSchema>

const CONCRETE_TYPES = [
  lexiconBooleanSchema,
  lexiconIntegerSchema,
  lexiconStringSchema,
  // Lexicon (DAG-CBOR)
  lexiconBytesSchema,
  lexiconCidLinkSchema,
  // Lexicon Specific
  lexiconBlobSchema,
] as const

// Meta types

export const lexiconUnknownSchema = l.object({
  type: l.literal('unknown'),
  description: l.optional(l.string()),
})
export type LexiconUnknown = l.Infer<typeof lexiconUnknownSchema>

export const lexiconTokenSchema = l.object({
  type: l.literal('token'),
  description: l.optional(l.string()),
})
export type LexiconToken = l.Infer<typeof lexiconTokenSchema>

export const lexiconRefSchema = l.object({
  type: l.literal('ref'),
  ref: l.string(),
  description: l.optional(l.string()),
})
export type LexiconRef = l.Infer<typeof lexiconRefSchema>

export const lexiconRefUnionSchema = l.object({
  type: l.literal('union'),
  refs: l.array(l.string()),
  closed: l.optional(l.boolean()),
  description: l.optional(l.string()),
})
export type LexiconRefUnion = l.Infer<typeof lexiconRefUnionSchema>

// Complex Types

const ARRAY_ITEMS_SCHEMAS = [
  ...CONCRETE_TYPES,
  // Meta
  lexiconUnknownSchema,
  lexiconRefSchema,
  lexiconRefUnionSchema,
] as const

export type LexiconArrayItems = l.Infer<(typeof ARRAY_ITEMS_SCHEMAS)[number]>

export const lexiconArraySchema = l.object({
  type: l.literal('array'),
  items: l.discriminatedUnion('type', ARRAY_ITEMS_SCHEMAS),
  minLength: l.optional(l.integer()),
  maxLength: l.optional(l.integer()),
  description: l.optional(l.string()),
})
export type LexiconArray = l.Infer<typeof lexiconArraySchema>

const requirePropertiesRefinement: l.RefinementCheck<{
  required?: string[]
  properties: Record<string, unknown>
}> = {
  check: (v) => !v.required || v.required.every((k) => k in v.properties),
  message: 'All required parameters must be defined in properties',
  path: 'required',
}

export const lexiconObjectSchema = l.refine(
  l.object({
    type: l.literal('object'),
    properties: l.dict(
      l.string(),
      l.discriminatedUnion('type', [
        ...ARRAY_ITEMS_SCHEMAS,
        lexiconArraySchema,
      ]),
    ),
    required: l.optional(l.array(l.string())),
    nullable: l.optional(l.array(l.string())),
    description: l.optional(l.string()),
  }),
  requirePropertiesRefinement,
)
export type LexiconObject = l.Infer<typeof lexiconObjectSchema>

// Records

export const lexiconRecordKeySchema = l.custom(
  l.isLexiconRecordKey,
  'Invalid record key definition (must be "any", "nsid", "tid", or "literal:<string>")',
)

export type LexiconRecordKey = l.LexiconRecordKey

export const lexiconRecordSchema = l.object({
  type: l.literal('record'),
  record: lexiconObjectSchema,
  description: l.optional(l.string()),
  key: lexiconRecordKeySchema,
})
export type LexiconRecord = l.Infer<typeof lexiconRecordSchema>

// XRPC Methods

export const lexiconParameters = l.refine(
  l.object({
    type: l.literal('params'),
    properties: l.dict(
      l.string(),
      l.discriminatedUnion('type', [
        lexiconBooleanSchema,
        lexiconIntegerSchema,
        lexiconStringSchema,
        l.object({
          type: l.literal('array'),
          items: l.discriminatedUnion('type', [
            lexiconBooleanSchema,
            lexiconIntegerSchema,
            lexiconStringSchema,
          ]),
          minLength: l.optional(l.integer()),
          maxLength: l.optional(l.integer()),
          description: l.optional(l.string()),
        }),
      ]),
    ),
    required: l.optional(l.array(l.string())),
    description: l.optional(l.string()),
  }),
  requirePropertiesRefinement,
)
export type LexiconParameters = l.Infer<typeof lexiconParameters>

export const lexiconPayload = l.object({
  encoding: l.string(),
  schema: l.optional(
    l.discriminatedUnion('type', [
      lexiconRefSchema,
      lexiconRefUnionSchema,
      lexiconObjectSchema,
    ]),
  ),
  description: l.optional(l.string()),
})
export type LexiconPayload = l.Infer<typeof lexiconPayload>

export const lexiconError = l.object({
  name: l.string({ minLength: 1 }),
  description: l.optional(l.string()),
})
export type LexiconError = l.Infer<typeof lexiconError>

export const lexiconQuerySchema = l.object({
  type: l.literal('query'),
  parameters: l.optional(lexiconParameters),
  output: l.optional(lexiconPayload),
  errors: l.optional(l.array(lexiconError)),
  description: l.optional(l.string()),
})
export type LexiconQuery = l.Infer<typeof lexiconQuerySchema>

export const lexiconProcedureSchema = l.object({
  type: l.literal('procedure'),
  parameters: l.optional(lexiconParameters),
  input: l.optional(lexiconPayload),
  output: l.optional(lexiconPayload),
  errors: l.optional(l.array(lexiconError)),
  description: l.optional(l.string()),
})
export type LexiconProcedure = l.Infer<typeof lexiconProcedureSchema>

export const lexiconSubscriptionSchema = l.object({
  type: l.literal('subscription'),
  description: l.optional(l.string()),
  parameters: l.optional(lexiconParameters),
  message: l.object({
    description: l.optional(l.string()),
    schema: lexiconRefUnionSchema,
  }),
  errors: l.optional(l.array(lexiconError)),
})

export type LexiconSubscription = l.Infer<typeof lexiconSubscriptionSchema>

// Permissions

const lexiconLanguageSchema = l.string({ format: 'language' })

export type LexiconLanguage = l.Infer<typeof lexiconLanguageSchema>

const lexiconLanguageDict = l.dict(lexiconLanguageSchema, l.string())

export type LexiconLanguageDict = l.Infer<typeof lexiconLanguageDict>

const lexiconPermissionSchema = l.intersection(
  l.object({
    type: l.literal('permission'),
    resource: l.string({ minLength: 1 }),
  }),
  l.dict(l.string(), l.paramSchema),
)

export type LexiconPermission = l.Infer<typeof lexiconPermissionSchema>

const lexiconPermissionSetSchema = l.object({
  type: l.literal('permission-set'),
  permissions: l.array(lexiconPermissionSchema),
  title: l.optional(l.string()),
  'title:lang': l.optional(lexiconLanguageDict),
  detail: l.optional(l.string()),
  'detail:lang': l.optional(lexiconLanguageDict),
  description: l.optional(l.string()),
})

export type LexiconPermissionSet = l.Infer<typeof lexiconPermissionSetSchema>

// Schemas that can appear anywhere in the defs
const NAMED_LEXICON_SCHEMAS = [
  ...CONCRETE_TYPES,
  lexiconArraySchema,
  lexiconObjectSchema,
  lexiconTokenSchema,
] as const

export type NamedLexiconDefinition = l.Infer<
  (typeof NAMED_LEXICON_SCHEMAS)[number]
>

// Schemas that can only appear as "main" def
const MAIN_LEXICON_SCHEMAS = [
  lexiconPermissionSetSchema,
  lexiconProcedureSchema,
  lexiconQuerySchema,
  lexiconRecordSchema,
  lexiconSubscriptionSchema,
  ...NAMED_LEXICON_SCHEMAS,
] as const

export type MainLexiconDefinition = l.Infer<
  (typeof MAIN_LEXICON_SCHEMAS)[number]
>

export const lexiconIdentifierSchema = l.string({ format: 'nsid' })
export type LexiconIdentifier = l.Infer<typeof lexiconIdentifierSchema>

export const lexiconDocumentSchema = l.object({
  lexicon: l.literal(1),
  id: lexiconIdentifierSchema,
  revision: l.optional(l.integer()),
  description: l.optional(l.string()),
  defs: l.intersection(
    l.object({
      main: l.optional(l.discriminatedUnion('type', MAIN_LEXICON_SCHEMAS)),
    }),
    l.dict(
      l.string({ minLength: 1 }),
      l.discriminatedUnion('type', NAMED_LEXICON_SCHEMAS),
    ),
  ),
})
export type LexiconDocument = l.Infer<typeof lexiconDocumentSchema>
