import { l } from '../lex/index.js'

// Scalar Types

export const lexiconBoolean = l.object(
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
export type LexiconBoolean = l.Infer<typeof lexiconBoolean>

export const lexiconInteger = l.object(
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
export type LexiconInteger = l.Infer<typeof lexiconInteger>

export const lexiconStringFormat = l.enum(l.STRING_FORMATS)
export type LexiconStringFormat = l.StringFormat

export const lexiconString = l.object(
  {
    type: l.literal('string'),
    format: lexiconStringFormat,
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
export type LexiconString = l.Infer<typeof lexiconString>

export const lexiconUnknown = l.object(
  {
    type: l.literal('unknown'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconUnknown = l.Infer<typeof lexiconUnknown>

export const lexiconBytes = l.object(
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
export type LexiconBytes = l.Infer<typeof lexiconBytes>

export const lexiconCid = l.object(
  {
    type: l.literal('cid-link'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconCid = l.Infer<typeof lexiconCid>

export const lexiconBlob = l.object(
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
export type LexiconBlob = l.Infer<typeof lexiconBlob>

export const lexiconToken = l.object(
  {
    type: l.literal('token'),
    description: l.string(),
  },
  {
    required: ['type'],
  },
)
export type LexiconToken = l.Infer<typeof lexiconToken>

// Reference Types

export const lexiconRef = l.object(
  {
    type: l.literal('ref'),
    description: l.string(),
    ref: l.string(),
  },
  {
    required: ['type', 'ref'],
  },
)
export type LexiconRef = l.Infer<typeof lexiconRef>

export const lexiconRefUnion = l.object(
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
export type LexiconRefUnion = l.Infer<typeof lexiconRefUnion>

export const lexiconRefVariant = l.discriminatedUnion('type', [
  lexiconRef,
  lexiconRefUnion,
])
export type LexiconRefVariant = l.Infer<typeof lexiconRefVariant>

// Complex Types

const LEXICON_BASE_SCHEMAS = [
  lexiconBoolean,
  lexiconInteger,
  lexiconString,
  lexiconUnknown,
  lexiconBytes,
  lexiconCid,
  lexiconRef,
  lexiconRefUnion,
  lexiconBlob,
] as const
export const lexiconBase = l.discriminatedUnion('type', LEXICON_BASE_SCHEMAS)

export type LexiconBase = l.Infer<typeof lexiconBase>

export const lexiconArray = l.object(
  {
    type: l.literal('array'),
    description: l.string(),
    items: lexiconBase,
    minLength: l.integer(),
    maxLength: l.integer(),
  },
  {
    required: ['type', 'items'],
  },
)
export type LexiconArray = l.Infer<typeof lexiconArray>

export const lexiconPrimitive = l.discriminatedUnion('type', [
  lexiconBoolean,
  lexiconInteger,
  lexiconString,
  lexiconUnknown,
])
export type LexiconPrimitive = l.Infer<typeof lexiconPrimitive>

export const lexiconPrimitiveArray = l.object(
  {
    type: l.literal('array'),
    description: l.string(),
    items: lexiconPrimitive,
    minLength: l.integer(),
    maxLength: l.integer(),
  },
  {
    required: ['type', 'items'],
  },
)
export type LexiconPrimitiveArray = l.Infer<typeof lexiconPrimitiveArray>

// @TODO: ensure that all "required" values are present in "properties"
export const lexiconObject = l.object(
  {
    type: l.literal('object'),
    description: l.string(),
    required: l.array(l.string()),
    nullable: l.array(l.string()),
    properties: l.dict(
      l.string(),
      l.discriminatedUnion('type', [lexiconArray, ...LEXICON_BASE_SCHEMAS]),
    ),
  },
  {
    required: ['type', 'properties'],
  },
)
export type LexiconObject = l.Infer<typeof lexiconObject>

// Records

export const lexiconRecord = l.object(
  {
    type: l.literal('record'),
    description: l.string(),
    key: l.string(),
    record: lexiconObject,
  },
  { required: ['type', 'record'] },
)
export type LexiconRecord = l.Infer<typeof lexiconRecord>

// XRPC Methods

// @TODO: ensure that all "required" values are present in "properties"
export const lexiconParameters = l.object(
  {
    type: l.literal('params'),
    description: l.string(),
    required: l.array(l.string()),
    properties: l.dict(
      l.string(),
      l.discriminatedUnion('type', [
        lexiconPrimitiveArray,
        lexiconBoolean,
        lexiconInteger,
        lexiconString,
        lexiconUnknown,
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
      lexiconRef,
      lexiconRefUnion,
      lexiconObject,
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
    lexiconRef,
    lexiconRefUnion,
    lexiconObject,
  ]),
})
export type LexiconSubscriptionMessage = l.Infer<
  typeof lexiconSubscriptionMessage
>

export const lexiconError = l.object({
  name: l.string(),
  description: l.string(),
})
export type LexiconError = l.Infer<typeof lexiconError>

export const lexiconQuery = l.object(
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
export type LexiconQuery = l.Infer<typeof lexiconQuery>

export const lexiconProcedure = l.object(
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
export type LexiconProcedure = l.Infer<typeof lexiconProcedure>

export const lexiconSubscription = l.object(
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
export type LexiconSubscription = l.Infer<typeof lexiconSubscription>

// Permissions

export const languageSchema = l.string({ format: 'language' })

export const lexiconLangDict = l.dict(languageSchema, l.string())

export type LexiconLangDict = l.Infer<typeof lexiconLangDict>

export type LexiconPermission = l.LexiconPermission

export const lexiconPermissionSet = l.object(
  {
    type: l.literal('permission-set'),
    description: l.string(),
    title: l.string(),
    'title:lang': lexiconLangDict,
    detail: l.string(),
    'detail:lang': lexiconLangDict,
    permissions: l.array(l.lexiconPermission),
  },
  {
    required: ['type', 'permissions'],
  },
)

export type LexiconPermissionSet = l.Infer<typeof lexiconPermissionSet>

// Schemas that can appear anywhere in the defs
const USER_LEXICON_SCHEMAS = [
  lexiconArray,
  lexiconBlob,
  lexiconBoolean,
  lexiconBytes,
  lexiconCid,
  lexiconInteger,
  lexiconObject,
  lexiconString,
  lexiconToken,
  lexiconUnknown,
] as const

export type UserLexiconDefinition = l.Infer<
  (typeof USER_LEXICON_SCHEMAS)[number]
>

// Schemas that can only appear as "main" def
const MAIN_LEXICON_SCHEMAS = [
  lexiconPermissionSet,
  lexiconProcedure,
  lexiconQuery,
  lexiconRecord,
  lexiconSubscription,
  ...USER_LEXICON_SCHEMAS,
] as const

export type MainLexiconDefinition = l.Infer<
  (typeof MAIN_LEXICON_SCHEMAS)[number]
>

export const lexiconDoc = l.object(
  {
    lexicon: l.literal(1),
    id: l.string({ format: 'nsid' }),
    revision: l.integer(),
    description: l.string(),
    defs: l.intersection(
      l.object({ main: l.discriminatedUnion('type', MAIN_LEXICON_SCHEMAS) }),
      l.dict(l.string(), l.discriminatedUnion('type', USER_LEXICON_SCHEMAS)),
    ),
  },
  {
    required: ['lexicon', 'id', 'defs'],
  },
)
export type LexiconDoc = l.Infer<typeof lexiconDoc>
