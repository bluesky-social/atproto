import { LexErrorData } from '@atproto/lex-data'
import {
  AtIdentifierString,
  InferOutput,
  NsidString,
  RecordKeyValue,
  Restricted,
  Schema,
  assertAtIdentifierString,
  assertStringFormat,
} from './core.js'
import {
  InferPayload,
  InferPayloadBody,
  InferPayloadEncoding,
  InferRecordKey,
  Procedure,
  Query,
  RecordSchema,
  Subscription,
  object,
  optional,
  regexp,
  string,
} from './schema.js'

export type Main<T> = T | { main: T }

export function getMain<T extends object>(ns: Main<T>): T {
  return 'main' in ns ? ns.main : ns
}

/**
 * Every XRPC implementation should translate `application/json` and `text/*`
 * payloads into their native equivalent ({@link LexValue} or string). Binary
 * data payloads, however, can be represented differently depending on the
 * environment and use case (e.g. `Uint8Array`, `Blob`, `Buffer`,
 * `ReadableStream`, etc.). This type is a placeholder to represent binary data
 * when not explicitly provided.
 */
export type BinaryData = Restricted<'Binary data'>

export type InferMethodParams<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
> =
  M extends Procedure<any, infer TParams, any, any, any>
    ? InferOutput<TParams>
    : M extends Query<any, infer TParams, any, any>
      ? InferOutput<TParams>
      : M extends Subscription<any, infer TParams, any, any>
        ? InferOutput<TParams>
        : never

export type InferMethodInput<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
  B = BinaryData,
> =
  M extends Procedure<any, any, infer TInput, any, any>
    ? InferPayload<TInput, B>
    : undefined

export type InferMethodInputBody<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
  B = BinaryData,
> =
  M extends Procedure<any, any, infer TInput, any, any>
    ? InferPayloadBody<TInput, B>
    : undefined

export type InferMethodInputEncoding<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
> =
  M extends Procedure<any, any, infer TInput, any, any>
    ? InferPayloadEncoding<TInput>
    : undefined

export type InferMethodOutput<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
  B = BinaryData,
> =
  M extends Procedure<any, any, any, infer TOutput, any>
    ? InferPayload<TOutput, B>
    : M extends Query<any, any, infer TOutput, any>
      ? InferPayload<TOutput, B>
      : undefined

export type InferMethodOutputBody<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
  B = BinaryData,
> =
  M extends Procedure<any, any, any, infer TOutput, any>
    ? InferPayloadBody<TOutput, B>
    : M extends Query<any, any, infer TOutput, any>
      ? InferPayloadBody<TOutput, B>
      : undefined

export type InferMethodOutputEncoding<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
> =
  M extends Procedure<any, any, any, infer TOutput, any>
    ? InferPayloadEncoding<TOutput>
    : M extends Query<any, any, infer TOutput, any>
      ? InferPayloadEncoding<TOutput>
      : undefined

export type InferMethodMessage<
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
> =
  M extends Subscription<any, any, infer TMessage, any>
    ? InferOutput<TMessage>
    : undefined

export type InferMethodError<
  //
  M extends Procedure | Query | Subscription = Procedure | Query | Subscription,
> = M extends { errors: readonly (infer E extends string)[] } ? E : never

/**
 * @see {@link https://atproto.com/specs/xrpc#error-responses}
 */
export const lexErrorDataSchema = object({
  // type name of the error (generic ASCII constant, no whitespace)
  error: regexp(/^[\w_-]+$/, 'Expected ASCII constant with no whitespace'),
  // description of the error, appropriate for display to humans
  message: optional(string()),
}) satisfies Schema<LexErrorData>

/**
 * Helper function to construct AT Protocol URIs with compile-time & runtime
 * validation of their components. This function supports different use cases,
 * including constructing URIs from raw strings or from RecordSchema instances,
 * ensuring that the resulting URI adheres to the expected format.
 *
 * @throws {TypeError} If the arguments do not match the interface
 * @throws {Error} If AT-URI components are invalid
 *
 * @example
 * ```typescript
 * import { atUri } from '@atproto/lex'
 * import { app } from '#/lexicons/index.js'
 *
 * // Constructing a URI from raw components
 * const uri1 = atUri('did:example:123', 'app.bsky.feed.post', 'my-post')
 *
 * // Constructing a URI from a RecordSchema instance
 * const uri2 = atUri('did:example:123', app.bsky.feed.post, 'my-post')
 *
 * // Literal rkey can be omitted
 * const uri3 = atUri('did:example:123', app.bsky.actor.profile) // rkey 'self' is implied
 *
 * // Invalid URIs will throw errors
 * atUri('invalid authority', 'app.bsky.feed.post', 'my-post') // throws
 * atUri('did:example:123', 'invalid collection', 'my-post') // throws
 * atUri('did:example:123', 'app.bsky.feed.post', '..') // throws
 * ```
 */
export function atUri<const TAuthority extends AtIdentifierString>(
  authority: TAuthority,
): `at://${TAuthority}`
export function atUri<
  const TAuthority extends AtIdentifierString,
  const TCollection extends NsidString,
  const TRecordKey extends RecordKeyValue,
>(
  authority: TAuthority,
  nsid: TCollection,
  rkey: TRecordKey extends '..' | '.' ? never : TRecordKey,
): `at://${TAuthority}/${TCollection}/${TRecordKey}`
export function atUri<
  const TAuthority extends AtIdentifierString,
  const TRecord extends RecordSchema,
>(
  authority: TAuthority,
  record: TRecord['key'] extends `literal:${string}` ? Main<TRecord> : never,
): `at://${TAuthority}/${TRecord['$type']}/${InferRecordKey<TRecord>}`
export function atUri<
  const TAuthority extends AtIdentifierString,
  const TRecord extends RecordSchema,
  const TRecordKey extends InferRecordKey<TRecord>,
>(
  authority: TAuthority,
  record: Main<TRecord>,
  rkey: TRecordKey extends '..' | '.' ? never : TRecordKey,
): `at://${TAuthority}/${TRecord['$type']}/${TRecordKey}`
export function atUri(
  authority: AtIdentifierString,
  record?: string | Main<RecordSchema>,
  rkey?: string,
) {
  /**
   * @NOTE because we are encoding potentially untrusted input into a URI, we
   * validate the input against the AT Protocol constraints, ensuring that no
   * invalid URIs can be generated.
   */
  switch (typeof record) {
    case 'undefined': {
      assertAtIdentifierString(authority)
      return `at://${authority}`
    }

    case 'string': {
      if (!rkey) {
        throw new TypeError('Record key is required when record is a string')
      }
      assertAtIdentifierString(authority)
      assertStringFormat(record, 'nsid')
      assertStringFormat(rkey, 'record-key')
      return `at://${authority}/${record}/${rkey}`
    }

    default: {
      // @NOTE The use of a schema assumes that the collection ($type) is a
      // valid NSID that can safely be included in the URI without additional
      // checks.
      assertAtIdentifierString(authority)
      const schema = getMain(record)
      // @NOTE parsing will apply defaults, so that literal keys will be
      // properly validated and included in the URI.
      return `at://${authority}/${schema.$type}/${schema.keySchema.parse(rkey)}`
    }
  }
}
