import { l } from '@atproto/lex-schema'

// https://atproto.com/specs/lexicon

// "Concrete" Types

export const lexiconNullSchema = l.object(
  {
    type: l.literal('null'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconNull = l.Infer<typeof lexiconNullSchema>

export const lexiconBooleanSchema = l.object(
  {
    type: l.literal('boolean'),
    description: l.string(),
    default: l.boolean(),
    const: l.boolean(),
  },
  {
    required: ['type'],
  },
)
export type LexiconBoolean = l.Infer<typeof lexiconBooleanSchema>

export const lexiconIntegerSchema = l.object(
  {
    type: l.literal('integer'),
    description: l.string(),
    default: l.integer(),
    minimum: l.integer(),
    maximum: l.integer(),
    enum: l.array(l.integer()),
    const: l.integer(),
  },
  {
    required: ['type'],
  },
)
export type LexiconInteger = l.Infer<typeof lexiconIntegerSchema>

export type LexiconStringFormat = l.StringFormat
export const lexiconStringFormatSchema = l.enum<LexiconStringFormat>(
  l.STRING_FORMATS,
)

export const lexiconStringSchema = l.object(
  {
    type: l.literal('string'),
    format: lexiconStringFormatSchema,
    description: l.string(),
    default: l.string(),
    minLength: l.integer(),
    maxLength: l.integer(),
    minGraphemes: l.integer(),
    maxGraphemes: l.integer(),
    enum: l.array(l.string()),
    const: l.string(),
    knownValues: l.array(l.string()),
  },
  {
    required: ['type'],
  },
)
export type LexiconString = l.Infer<typeof lexiconStringSchema>

export const lexiconBytesSchema = l.object(
  {
    type: l.literal('bytes'),
    description: l.string(),
    maxLength: l.integer(),
    minLength: l.integer(),
  },
  {
    required: ['type'],
  },
)
export type LexiconBytes = l.Infer<typeof lexiconBytesSchema>

export const lexiconCidLinkSchema = l.object(
  {
    type: l.literal('cid-link'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconCid = l.Infer<typeof lexiconCidLinkSchema>

export const lexiconBlobSchema = l.object(
  {
    type: l.literal('blob'),
    description: l.string(),
    accept: l.array(l.string()),
    maxSize: l.integer(),
  },
  {
    required: ['type'],
  },
)
export type LexiconBlob = l.Infer<typeof lexiconBlobSchema>

const CONCRETE_TYPES = [
  lexiconNullSchema,
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

export const lexiconUnknownSchema = l.object(
  {
    type: l.literal('unknown'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconUnknown = l.Infer<typeof lexiconUnknownSchema>

export const lexiconTokenSchema = l.object(
  {
    type: l.literal('token'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconToken = l.Infer<typeof lexiconTokenSchema>

export const lexiconRefSchema = l.object(
  {
    type: l.literal('ref'),
    description: l.string(),
    ref: l.string(),
  },
  {
    required: ['type', 'ref'],
  },
)
export type LexiconRef = l.Infer<typeof lexiconRefSchema>

export const lexiconRefUnionSchema = l.object(
  {
    type: l.literal('union'),
    description: l.string(),
    refs: l.array(l.string()),
    closed: l.boolean(),
  },
  {
    required: ['type', 'refs'],
  },
)
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

export const lexiconArraySchema = l.object(
  {
    type: l.literal('array'),
    description: l.string(),
    items: l.discriminatedUnion('type', ARRAY_ITEMS_SCHEMAS),
    minLength: l.integer(),
    maxLength: l.integer(),
  },
  {
    required: ['type', 'items'],
  },
)
export type LexiconArray = l.Infer<typeof lexiconArraySchema>

export const lexiconObjectSchema = l.object(
  {
    type: l.literal('object'),
    description: l.string(),
    required: l.array(l.string()),
    nullable: l.array(l.string()),
    properties: l.dict(
      l.string(),
      l.discriminatedUnion('type', [
        ...ARRAY_ITEMS_SCHEMAS,
        lexiconArraySchema,
      ]),
    ),
  },
  {
    required: ['type', 'properties'],
  },
)
export type LexiconObject = l.Infer<typeof lexiconObjectSchema>

// Records

export const lexiconRecordSchema = l.object(
  {
    type: l.literal('record'),
    description: l.string(),
    key: l.string(),
    record: lexiconObjectSchema,
  },
  { required: ['type', 'record'] },
)
export type LexiconRecord = l.Infer<typeof lexiconRecordSchema>

// XRPC Methods

export const lexiconParameters = l.object(
  {
    type: l.literal('params'),
    description: l.string(),
    required: l.array(l.string()),
    properties: l.dict(
      l.string(),
      l.discriminatedUnion('type', [
        lexiconBooleanSchema,
        lexiconIntegerSchema,
        lexiconStringSchema,
        l.object(
          {
            type: l.literal('array'),
            description: l.string(),
            items: l.discriminatedUnion('type', [
              lexiconBooleanSchema,
              lexiconIntegerSchema,
              lexiconStringSchema,
            ]),
            minLength: l.integer(),
            maxLength: l.integer(),
          },
          {
            required: ['type', 'items'],
          },
        ),
      ]),
    ),
  },
  {
    required: ['type', 'properties'],
  },
)
export type LexiconParameters = l.Infer<typeof lexiconParameters>

export const lexiconPayload = l.object(
  {
    description: l.string(),
    encoding: l.string(),
    schema: l.discriminatedUnion('type', [
      lexiconRefSchema,
      lexiconRefUnionSchema,
      lexiconObjectSchema,
    ]),
  },
  {
    required: ['encoding'],
  },
)
export type LexiconPayload = l.Infer<typeof lexiconPayload>

export const lexiconSubscriptionMessage = l.object({
  description: l.string(),
  schema: l.discriminatedUnion('type', [
    lexiconRefSchema,
    lexiconRefUnionSchema,
    lexiconObjectSchema,
  ]),
})
export type LexiconSubscriptionMessage = l.Infer<
  typeof lexiconSubscriptionMessage
>

export const lexiconError = l.object(
  {
    name: l.string({ minLength: 1 }),
    description: l.string(),
  },
  {
    required: ['name'],
  },
)
export type LexiconError = l.Infer<typeof lexiconError>

export const lexiconQuerySchema = l.object(
  {
    type: l.literal('query'),
    description: l.string(),
    parameters: lexiconParameters,
    output: lexiconPayload,
    errors: l.array(lexiconError),
  },
  {
    required: ['type'],
  },
)
export type LexiconQuery = l.Infer<typeof lexiconQuerySchema>

export const lexiconProcedureSchema = l.object(
  {
    type: l.literal('procedure'),
    description: l.string(),
    parameters: lexiconParameters,
    input: lexiconPayload,
    output: lexiconPayload,
    errors: l.array(lexiconError),
  },
  {
    required: ['type'],
  },
)
export type LexiconProcedure = l.Infer<typeof lexiconProcedureSchema>

export const lexiconSubscriptionSchema = l.object(
  {
    type: l.literal('subscription'),
    description: l.string(),
    parameters: lexiconParameters,
    message: lexiconSubscriptionMessage,
    errors: l.array(lexiconError),
  },
  {
    required: ['type'],
  },
)

export type LexiconSubscription = l.Infer<typeof lexiconSubscriptionSchema>

// Permissions

const lexiconLanguageSchema = l.string({ format: 'language' })

export type LexiconLanguage = l.Infer<typeof lexiconLanguageSchema>

const lexiconLanguageDict = l.dict(lexiconLanguageSchema, l.string())

export type LexiconLanguageDict = l.Infer<typeof lexiconLanguageDict>

const lexiconPermissionSchema = l.object(
  {
    type: l.literal('permission'),
    resource: l.string({ minLength: 1 }),
  },
  {
    required: ['type', 'resource'],
    unknownProperties: l.dict(l.string(), l.parameterSchema),
  },
)

export type LexiconPermission = l.Infer<typeof lexiconPermissionSchema>

const lexiconPermissionSetSchema = l.object(
  {
    type: l.literal('permission-set'),
    description: l.string(),
    title: l.string(),
    'title:lang': lexiconLanguageDict,
    detail: l.string(),
    'detail:lang': lexiconLanguageDict,
    permissions: l.array(lexiconPermissionSchema),
  },
  {
    required: ['type', 'permissions'],
  },
)

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

export const lexiconDocumentSchema = l.object(
  {
    lexicon: l.literal(1),
    id: lexiconIdentifierSchema,
    revision: l.integer(),
    description: l.string(),
    defs: l.object(
      { main: l.discriminatedUnion('type', MAIN_LEXICON_SCHEMAS) },
      {
        unknownProperties: l.dict(
          l.string({ minLength: 1 }),
          l.discriminatedUnion('type', NAMED_LEXICON_SCHEMAS),
        ),
      },
    ),
  },
  {
    required: ['lexicon', 'id', 'defs'],
  },
)
export type LexiconDocument = l.Infer<typeof lexiconDocumentSchema>
