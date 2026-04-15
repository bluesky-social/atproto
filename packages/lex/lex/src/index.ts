/**
 * The `@atproto/lex` package provides utilities for working with ATProtocol
 * lexicons, including data types, JSON encoding/decoding, schema validation,
 * and HTTP client functionality.
 *
 * @packageDocumentation
 */

export {
  /**
   * The Client class is the primary interface for interacting with AT Protocol
   * services though an authenticated session. It provides methods for making
   * XRPC requests, handling records, and managing blobs.
   */
  Client,
  /**
   * The `xrpc` function is a low-level utility for making XRPC requests towards
   * a specific service. It allows for detailed control over the request,
   * including custom parameters, body, and headers. This function is useful for
   * advanced use cases where the higher-level `Client` methods may not provide
   * enough flexibility.
   */
  xrpc,
  /**
   * The `xrpcSafe` function is a wrapper around `xrpc` that provides additional
   * safety checks and error handling. It ensures that the request is properly
   * formed and that any errors are caught and handled gracefully. This function
   * is recommended for most use cases, as it provides a safer interface for
   * making XRPC requests.
   */
  xrpcSafe,
} from '@atproto/lex-client'
export * from '@atproto/lex-client'

export {
  /**
   * The {@link l} namespace (from `@atproto/lex-schema`) provides an imperative API for building schemas:
   *
   * ### Primitive Types
   * - {@link l.string | l.string()} - String values with optional format/length constraints
   * - {@link l.integer | l.integer()} - Integer values with optional min/max constraints
   * - {@link l.boolean | l.boolean()} - Boolean values
   * - {@link l.bytes | l.bytes()} - Binary data (Uint8Array)
   * - {@link l.cid | l.cid()} - Content Identifier values
   * - {@link l.blob | l.blob()} - Blob references with mime type and size
   *
   * ### Composite Types
   * - {@link l.object | l.object()} - Objects with defined property schemas
   * - {@link l.array | l.array()} - Arrays with element type validation
   * - {@link l.union | l.union()} - Union of multiple possible types
   * - {@link l.ref | l.ref()} - Reference to another schema definition
   * - {@link l.literal | l.literal()} - Literal constant values
   * - {@link l.enum | l.enum()} - Enum of allowed string values
   * - {@link l.typedRef | l.typedRef()} - Reference to a {@link l.typedObject | l.typedObject()}
   * - {@link l.typedUnion | l.typedUnion()} - Discriminated union between multiple {@link l.typedRef | l.typedRef()} or {@link l.typedObject | l.typedObject()} types
   *
   * ### Modifiers
   * - {@link l.optional | l.optional()} - Mark a property as optional
   * - {@link l.nullable | l.nullable()} - Allow null values
   * - {@link l.withDefault | l.withDefault()} - Provide a default value
   *
   * ### Lexicon Definitions
   * - {@link l.typedObject | l.typedObject()} - Define a typed object with a `$type` property
   * - {@link l.record | l.record()} - Define a Lexicon record type
   * - {@link l.query | l.query()} - Define a Lexicon query method
   * - {@link l.procedure | l.procedure()} - Define a Lexicon procedure method
   * - {@link l.subscription | l.subscription()} - Define a Lexicon subscription method
   */
  l,
} from '@atproto/lex-schema'
export * from '@atproto/lex-schema'

export {
  /**
   * The `LexMap` type represents an object with string keys and `LexValue` values.
   * It is used to represent arbitrary objects in Lexicon schemas, where the
   * properties are not predefined. This type allows for flexible data structures
   * while still ensuring that all values conform to the `LexValue` type.
   */
  type LexMap,
  /**
   * The `LexValue` type represents any valid value that can be used in a
   * Lexicon schema. It is a union of all the primitive and composite types
   * defined in `@atproto/lex-data`, including strings, integers, booleans,
   * bytes, CIDs, blob references, objects, arrays, and maps. This type is used
   * throughout the library to represent data that conforms to Lexicon schemas.
   */
  type LexValue,
} from '@atproto/lex-data'
export * from '@atproto/lex-data'

export {
  /**
   * The `jsonToLex` function takes a plain JavaScript object (typically parsed from
   * JSON) and converts it back into a LexValue, reconstructing any complex types as needed. This is useful
   * for processing data received from the network or loaded from JSON storage.
   */
  jsonToLex,
  /**
   * The `lexParse` function takes a JSON string and parses it into a LexValue. It
   * performs the necessary conversions to reconstruct complex LexValue types from
   * their JSON representations.
   */
  lexParse,
  /**
   * The `lexStringify` function takes a LexValue and serializes it to a JSON string.
   * It handles the conversion of complex LexValue types (like BlobRef and Cid) into
   * a JSON-friendly format.
   */
  lexStringify,
  /**
   * The `lexToJson` function converts a LexValue into a plain JavaScript object
   * that can be safely serialized to JSON. This is useful for preparing data to be
   * sent over the network or stored in a JSON format.
   */
  lexToJson,
} from '@atproto/lex-json'
export * from '@atproto/lex-json'
