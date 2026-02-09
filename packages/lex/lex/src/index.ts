/* eslint-disable @typescript-eslint/no-unused-vars */

import type * as client from '@atproto/lex-client'
import type * as data from '@atproto/lex-data'
import type * as json from '@atproto/lex-json'
import { l } from '@atproto/lex-schema'

/**
 * The `@atproto/lex` package provides utilities for working with ATProtocol
 * lexicons, including data types, JSON encoding/decoding, schema validation,
 * and HTTP client functionality.
 *
 * ## `@atproto/lex-client`
 *
 * - {@link client.Client} - Type-safe XRPC client for making ATProtocol API calls
 * - {@link client.XrpcError} - Base error class for XRPC request failures
 * - {@link client.Agent} - Interface used by {@link client.Client} for making HTTP requests
 * - {@link client.xrpc} - Utility function for making XRPC requests
 *
 * ## `@atproto/lex-data`
 *
 * - {@link data.LexValue} - Union type representing any valid Lexicon value
 * - {@link data.LexMap} - Object type with string keys and {@link data.LexValue} values
 * - {@link data.Cid} - Content Identifier for referencing data by hash
 * - {@link data.BlobRef} - Reference to binary data (images, videos, etc.)
 *
 * ## `@atproto/lex-json`
 *
 * - {@link json.lexStringify} - Serialize Lex values to JSON strings
 * - {@link json.lexParse} - Parse JSON strings into Lex values
 * - {@link json.lexToJson} - Convert Lex values to plain JSON objects
 * - {@link json.jsonToLex} - Convert plain JSON objects to Lex values
 *
 * ## `@atproto/lex-schema`
 *
 * The {@link l} namespace provides a fluent API for building schemas:
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
 *
 * @packageDocumentation
 */

export * from '@atproto/lex-data'
export * from '@atproto/lex-json'
export * from '@atproto/lex-schema'
export * from '@atproto/lex-client'
