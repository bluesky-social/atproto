import { l } from '@atproto/lex-schema'

// https://atproto.com/specs/lexicon

// "Concrete" Types

/**
 * Schema for validating Lexicon boolean type definitions.
 *
 * Validates boolean field definitions that may include a default value,
 * a constant value, and an optional description.
 */
export const lexiconBooleanSchema = l.object({
  type: l.literal('boolean'),
  default: l.optional(l.boolean()),
  const: l.optional(l.boolean()),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon boolean definition.
 *
 * Represents the structure of a boolean field in a Lexicon document,
 * including optional default, const, and description properties.
 *
 * @see {@link lexiconBooleanSchema} for the schema definition
 */
export type LexiconBoolean = l.Infer<typeof lexiconBooleanSchema>

/**
 * Schema for validating Lexicon integer type definitions.
 *
 * Validates integer field definitions with support for default values,
 * minimum/maximum constraints, enumerated values, and constant values.
 */
export const lexiconIntegerSchema = l.object({
  type: l.literal('integer'),
  default: l.optional(l.integer()),
  minimum: l.optional(l.integer()),
  maximum: l.optional(l.integer()),
  enum: l.optional(l.array(l.integer())),
  const: l.optional(l.integer()),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon integer definition.
 *
 * Represents the structure of an integer field in a Lexicon document,
 * including optional constraints like minimum, maximum, enum, and const.
 *
 * @see {@link lexiconIntegerSchema} for the schema definition
 */
export type LexiconInteger = l.Infer<typeof lexiconIntegerSchema>

/**
 * Schema for validating Lexicon string type definitions.
 *
 * Validates string field definitions with support for format validation,
 * length constraints (both character and grapheme-based), enumerated values,
 * known values, and constant values.
 */
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

/**
 * TypeScript type for a Lexicon string definition.
 *
 * Represents the structure of a string field in a Lexicon document,
 * including optional format, length constraints, enum, const, and knownValues.
 *
 * @see {@link lexiconStringSchema} for the schema definition
 */
export type LexiconString = l.Infer<typeof lexiconStringSchema>

/**
 * Schema for validating Lexicon bytes type definitions.
 *
 * Validates binary data field definitions with optional length constraints.
 * Used for raw byte arrays in DAG-CBOR encoding.
 */
export const lexiconBytesSchema = l.object({
  type: l.literal('bytes'),
  maxLength: l.optional(l.integer()),
  minLength: l.optional(l.integer()),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon bytes definition.
 *
 * Represents the structure of a binary data field in a Lexicon document,
 * including optional minLength and maxLength constraints.
 *
 * @see {@link lexiconBytesSchema} for the schema definition
 */
export type LexiconBytes = l.Infer<typeof lexiconBytesSchema>

/**
 * Schema for validating Lexicon CID link type definitions.
 *
 * Validates Content Identifier (CID) link field definitions.
 * CIDs are used to reference content-addressed data in IPFS/IPLD.
 */
export const lexiconCidLinkSchema = l.object({
  type: l.literal('cid-link'),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon CID link definition.
 *
 * Represents the structure of a CID link field in a Lexicon document.
 *
 * @see {@link lexiconCidLinkSchema} for the schema definition
 */
export type LexiconCid = l.Infer<typeof lexiconCidLinkSchema>

/**
 * Schema for validating Lexicon blob type definitions.
 *
 * Validates blob field definitions with optional MIME type acceptance list
 * and maximum size constraints. Blobs represent uploaded file references.
 */
export const lexiconBlobSchema = l.object({
  type: l.literal('blob'),
  accept: l.optional(l.array(l.string())),
  maxSize: l.optional(l.integer()),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon blob definition.
 *
 * Represents the structure of a blob field in a Lexicon document,
 * including optional accept list and maxSize constraints.
 *
 * @see {@link lexiconBlobSchema} for the schema definition
 */
export type LexiconBlob = l.Infer<typeof lexiconBlobSchema>

/**
 * Array of all concrete (primitive) Lexicon type schemas.
 * Includes boolean, integer, string, bytes, cid-link, and blob types.
 */
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

/**
 * Schema for validating Lexicon unknown type definitions.
 *
 * Validates unknown field definitions which accept any valid data.
 * Used when the schema cannot determine the type ahead of time.
 */
export const lexiconUnknownSchema = l.object({
  type: l.literal('unknown'),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon unknown definition.
 *
 * Represents the structure of an unknown field in a Lexicon document.
 *
 * @see {@link lexiconUnknownSchema} for the schema definition
 */
export type LexiconUnknown = l.Infer<typeof lexiconUnknownSchema>

/**
 * Schema for validating Lexicon token type definitions.
 *
 * Validates token definitions which represent symbolic constants.
 * Tokens are used to define enumeration-like values that can be
 * referenced across different lexicons.
 */
export const lexiconTokenSchema = l.object({
  type: l.literal('token'),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon token definition.
 *
 * Represents the structure of a token in a Lexicon document.
 *
 * @see {@link lexiconTokenSchema} for the schema definition
 */
export type LexiconToken = l.Infer<typeof lexiconTokenSchema>

/**
 * Schema for validating Lexicon reference type definitions.
 *
 * Validates reference definitions which point to other type definitions
 * within the same or different Lexicon documents. References use the
 * format "nsid#defName" for cross-document refs or "#defName" for local refs.
 */
export const lexiconRefSchema = l.object({
  type: l.literal('ref'),
  ref: l.string(),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon reference definition.
 *
 * Represents the structure of a reference field in a Lexicon document,
 * including the ref string pointing to another definition.
 *
 * @see {@link lexiconRefSchema} for the schema definition
 */
export type LexiconRef = l.Infer<typeof lexiconRefSchema>

/**
 * Schema for validating Lexicon union reference type definitions.
 *
 * Validates union definitions which can reference multiple possible types.
 * The union can be closed (only listed types allowed) or open (allows
 * additional unlisted types).
 */
export const lexiconRefUnionSchema = l.object({
  type: l.literal('union'),
  refs: l.array(l.string()),
  closed: l.optional(l.boolean()),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon union reference definition.
 *
 * Represents the structure of a union field in a Lexicon document,
 * including an array of reference strings and optional closed flag.
 *
 * @see {@link lexiconRefUnionSchema} for the schema definition
 */
export type LexiconRefUnion = l.Infer<typeof lexiconRefUnionSchema>

// Complex Types

const ARRAY_ITEMS_SCHEMAS = [
  ...CONCRETE_TYPES,
  // Meta
  lexiconUnknownSchema,
  lexiconRefSchema,
  lexiconRefUnionSchema,
] as const

/**
 * TypeScript type representing valid item types for Lexicon arrays.
 *
 * Union of all types that can appear as items within a Lexicon array definition.
 */
export type LexiconArrayItems = l.Infer<(typeof ARRAY_ITEMS_SCHEMAS)[number]>

/**
 * Schema for validating Lexicon array type definitions.
 *
 * Validates array field definitions with specified item type and
 * optional length constraints.
 */
export const lexiconArraySchema = l.object({
  type: l.literal('array'),
  items: l.discriminatedUnion('type', ARRAY_ITEMS_SCHEMAS),
  minLength: l.optional(l.integer()),
  maxLength: l.optional(l.integer()),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon array definition.
 *
 * Represents the structure of an array field in a Lexicon document,
 * including the items schema and optional length constraints.
 *
 * @see {@link lexiconArraySchema} for the schema definition
 */
export type LexiconArray = l.Infer<typeof lexiconArraySchema>

const requirePropertiesRefinement: l.RefinementCheck<{
  required?: string[]
  properties: Record<string, unknown>
}> = {
  check: (v) => !v.required || v.required.every((k) => k in v.properties),
  message: 'All required parameters must be defined in properties',
  path: 'required',
}

/**
 * Schema for validating Lexicon object type definitions.
 *
 * Validates object definitions with named properties, required field lists,
 * and nullable field lists. Includes refinement to ensure all required
 * properties are defined in the properties map.
 */
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

/**
 * TypeScript type for a Lexicon object definition.
 *
 * Represents the structure of an object type in a Lexicon document,
 * including properties map, required array, and nullable array.
 *
 * @see {@link lexiconObjectSchema} for the schema definition
 */
export type LexiconObject = l.Infer<typeof lexiconObjectSchema>

// Records

/**
 * Schema for validating Lexicon record key definitions.
 *
 * Validates record key type specifications. Valid values are:
 * - "any": Any valid record key
 * - "nsid": Namespaced identifier
 * - "tid": Timestamp identifier
 * - "literal:<string>": A specific literal string value
 */
export const lexiconRecordKeySchema = l.custom(
  l.isLexiconRecordKey,
  'Invalid record key definition (must be "any", "nsid", "tid", or "literal:<string>")',
)

/**
 * TypeScript type for valid Lexicon record key values.
 *
 * Can be "any", "nsid", "tid", or "literal:<string>".
 *
 * @see {@link lexiconRecordKeySchema} for the schema definition
 */
export type LexiconRecordKey = l.LexiconRecordKey

/**
 * Schema for validating Lexicon record type definitions.
 *
 * Validates record definitions which define the structure of data
 * stored in AT Protocol repositories. Records have a key type
 * and an object schema defining the record's data structure.
 */
export const lexiconRecordSchema = l.object({
  type: l.literal('record'),
  record: lexiconObjectSchema,
  description: l.optional(l.string()),
  key: lexiconRecordKeySchema,
})

/**
 * TypeScript type for a Lexicon record definition.
 *
 * Represents the structure of a record type in a Lexicon document,
 * including the key type and the object schema for the record data.
 *
 * @see {@link lexiconRecordSchema} for the schema definition
 */
export type LexiconRecord = l.Infer<typeof lexiconRecordSchema>

// XRPC Methods

/**
 * Schema for validating Lexicon XRPC method parameters.
 *
 * Validates the parameters definition for query and procedure methods.
 * Parameters can only be primitive types (boolean, integer, string)
 * or arrays of primitives.
 */
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

/**
 * TypeScript type for Lexicon XRPC method parameters.
 *
 * Represents the structure of parameters for query and procedure methods.
 *
 * @see {@link lexiconParameters} for the schema definition
 */
export type LexiconParameters = l.Infer<typeof lexiconParameters>

/**
 * Schema for validating Lexicon XRPC method payloads.
 *
 * Validates input/output payload definitions for procedures and queries.
 * Payloads specify the encoding (MIME type) and optional schema for
 * the request or response body.
 */
export const lexiconPayload = l.object({
  encoding: l.refine(l.string(), {
    check: (v) => !v.includes(',') && !v.includes(';') && !v.includes(' '),
    message:
      'Invalid encoding string (must be a single MIME type without parameters)',
  }),
  schema: l.optional(
    l.discriminatedUnion('type', [
      lexiconRefSchema,
      lexiconRefUnionSchema,
      lexiconObjectSchema,
    ]),
  ),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon XRPC payload definition.
 *
 * Represents the structure of an input or output payload,
 * including encoding type and optional schema.
 *
 * @see {@link lexiconPayload} for the schema definition
 */
export type LexiconPayload = l.Infer<typeof lexiconPayload>

/**
 * Schema for validating Lexicon XRPC error definitions.
 *
 * Validates error definitions that can be returned by XRPC methods.
 * Each error has a name and optional description.
 */
export const lexiconError = l.object({
  name: l.string({ minLength: 1 }),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon XRPC error definition.
 *
 * Represents an error that can be returned by an XRPC method.
 *
 * @see {@link lexiconError} for the schema definition
 */
export type LexiconError = l.Infer<typeof lexiconError>

/**
 * Schema for validating Lexicon query (GET) method definitions.
 *
 * Validates query method definitions which represent read-only HTTP GET
 * operations. Queries can have parameters, an output payload, and
 * defined error types.
 */
export const lexiconQuerySchema = l.object({
  type: l.literal('query'),
  parameters: l.optional(lexiconParameters),
  output: l.optional(lexiconPayload),
  errors: l.optional(l.array(lexiconError)),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon query method definition.
 *
 * Represents the structure of an XRPC query (GET) method.
 *
 * @see {@link lexiconQuerySchema} for the schema definition
 */
export type LexiconQuery = l.Infer<typeof lexiconQuerySchema>

/**
 * Schema for validating Lexicon procedure (POST) method definitions.
 *
 * Validates procedure method definitions which represent HTTP POST
 * operations that may modify state. Procedures can have parameters,
 * input payload, output payload, and defined error types.
 */
export const lexiconProcedureSchema = l.object({
  type: l.literal('procedure'),
  parameters: l.optional(lexiconParameters),
  input: l.optional(lexiconPayload),
  output: l.optional(lexiconPayload),
  errors: l.optional(l.array(lexiconError)),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon procedure method definition.
 *
 * Represents the structure of an XRPC procedure (POST) method.
 *
 * @see {@link lexiconProcedureSchema} for the schema definition
 */
export type LexiconProcedure = l.Infer<typeof lexiconProcedureSchema>

/**
 * Schema for validating Lexicon subscription (WebSocket) method definitions.
 *
 * Validates subscription method definitions which represent real-time
 * streaming connections over WebSocket. Subscriptions have parameters,
 * a message schema defining the streamed data format, and error types.
 */
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

/**
 * TypeScript type for a Lexicon subscription method definition.
 *
 * Represents the structure of an XRPC subscription (WebSocket) method.
 *
 * @see {@link lexiconSubscriptionSchema} for the schema definition
 */
export type LexiconSubscription = l.Infer<typeof lexiconSubscriptionSchema>

// Permissions

/**
 * Schema for validating language codes in Lexicon permission definitions.
 */
export const lexiconLanguageSchema = l.string({ format: 'language' })

/**
 * TypeScript type for a BCP 47 language code string.
 *
 * @see {@link lexiconLanguageSchema} for the schema definition
 */
export type LexiconLanguage = l.Infer<typeof lexiconLanguageSchema>

/**
 * Schema for validating language-keyed string dictionaries.
 * Used for localized text in permission definitions.
 */
export const lexiconLanguageDict = l.dict(lexiconLanguageSchema, l.string())

/**
 * TypeScript type for a language-keyed dictionary of localized strings.
 *
 * @see {@link lexiconLanguageDict} for the schema definition
 */
export type LexiconLanguageDict = l.Infer<typeof lexiconLanguageDict>

/**
 * Schema for validating individual Lexicon permission definitions.
 */
export const lexiconPermissionSchema = l.intersection(
  l.object({
    type: l.literal('permission'),
    resource: l.string({ minLength: 1 }),
  }),
  l.dict(l.string(), l.paramSchema),
)

/**
 * TypeScript type for a Lexicon permission definition.
 *
 * Represents a single permission with a resource identifier
 * and optional additional parameters.
 *
 * @see {@link lexiconPermissionSchema} for the schema definition
 */
export type LexiconPermission = l.Infer<typeof lexiconPermissionSchema>

/**
 * Schema for validating Lexicon permission set definitions.
 */
export const lexiconPermissionSetSchema = l.object({
  type: l.literal('permission-set'),
  permissions: l.array(lexiconPermissionSchema),
  title: l.optional(l.string()),
  'title:lang': l.optional(lexiconLanguageDict),
  detail: l.optional(l.string()),
  'detail:lang': l.optional(lexiconLanguageDict),
  description: l.optional(l.string()),
})

/**
 * TypeScript type for a Lexicon permission set definition.
 *
 * Represents a collection of permissions with optional
 * localized title and detail text.
 *
 * @see {@link lexiconPermissionSetSchema} for the schema definition
 */
export type LexiconPermissionSet = l.Infer<typeof lexiconPermissionSetSchema>

const NAMED_LEXICON_SCHEMAS = [
  ...CONCRETE_TYPES,
  lexiconArraySchema,
  lexiconObjectSchema,
  lexiconTokenSchema,
] as const

/**
 * TypeScript type for any named Lexicon definition.
 *
 * Union of all definition types that can appear in the defs section
 * of a Lexicon document (excluding main-only types).
 */
export type NamedLexiconDefinition = l.Infer<
  (typeof NAMED_LEXICON_SCHEMAS)[number]
>

const MAIN_LEXICON_SCHEMAS = [
  lexiconPermissionSetSchema,
  lexiconProcedureSchema,
  lexiconQuerySchema,
  lexiconRecordSchema,
  lexiconSubscriptionSchema,
  ...NAMED_LEXICON_SCHEMAS,
] as const

/**
 * TypeScript type for main Lexicon definitions.
 *
 * Union of all definition types that can appear as the "main" entry
 * in a Lexicon document's defs section.
 */
export type MainLexiconDefinition = l.Infer<
  (typeof MAIN_LEXICON_SCHEMAS)[number]
>

/**
 * Schema for validating Lexicon document identifiers (NSIDs).
 *
 * Validates that the identifier follows the Namespaced Identifier format
 * (e.g., "com.atproto.repo.createRecord").
 */
export const lexiconIdentifierSchema = l.string({ format: 'nsid' })

/**
 * TypeScript type for a Lexicon document identifier.
 *
 * A Namespaced Identifier (NSID) string in reverse-domain format.
 *
 * @see {@link lexiconIdentifierSchema} for the schema definition
 */
export type LexiconIdentifier = l.Infer<typeof lexiconIdentifierSchema>

/**
 * Schema for validating complete Lexicon document structures.
 *
 * Validates the top-level structure of a Lexicon document, including:
 * - `lexicon`: Must be 1 (the current Lexicon version)
 * - `id`: The document's NSID
 * - `revision`: Optional version number
 * - `description`: Optional document description
 * - `defs`: Map of definition names to their schemas
 *
 * The "main" definition (if present) can be any main-only type,
 * while other definitions are limited to named types.
 *
 * @example
 * ```ts
 * const result = lexiconDocumentSchema.parse({
 *   lexicon: 1,
 *   id: 'com.example.getProfile',
 *   defs: {
 *     main: {
 *       type: 'query',
 *       output: {
 *         encoding: 'application/json',
 *         schema: { type: 'ref', ref: '#profile' }
 *       }
 *     },
 *     profile: {
 *       type: 'object',
 *       properties: {
 *         name: { type: 'string' }
 *       }
 *     }
 *   }
 * })
 * ```
 */
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

/**
 * TypeScript type for a complete Lexicon document.
 *
 * Represents the full structure of a Lexicon JSON document,
 * including the version, identifier, and all type definitions.
 *
 * @see {@link lexiconDocumentSchema} for the schema definition
 */
export type LexiconDocument = l.Infer<typeof lexiconDocumentSchema>
