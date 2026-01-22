import { LexErrorData, LexValue } from '@atproto/lex-data'
import { InferOutput, Restricted, Schema } from './core.js'
import {
  InferPayload,
  InferPayloadBody,
  InferPayloadEncoding,
  ParamsSchema,
  Payload,
  object,
  optional,
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
type BinaryData = Restricted<'Binary data'>

export type InferMethodParams<M extends { parameters: ParamsSchema }> =
  InferOutput<M['parameters']>

export type InferMethodInput<
  M extends { input?: Payload },
  B = BinaryData,
> = M extends { input: Payload } ? InferPayload<M['input'], B> : undefined

export type InferMethodInputBody<
  M extends { input?: Payload },
  B = BinaryData,
> = M extends { input: Payload } ? InferPayloadBody<M['input'], B> : undefined

export type InferMethodInputEncoding<M extends { input?: Payload }> =
  M extends { input: Payload } ? InferPayloadEncoding<M['input']> : undefined

export type InferMethodOutput<
  M extends { output?: Payload },
  B = BinaryData,
> = M extends { output: Payload } ? InferPayload<M['output'], B> : undefined

export type InferMethodOutputBody<
  M extends { output?: Payload },
  B = BinaryData,
> = M extends { output: Payload } ? InferPayloadBody<M['output'], B> : undefined

export type InferMethodOutputEncoding<M extends { output?: Payload }> =
  M extends { output: Payload } ? InferPayloadEncoding<M['output']> : undefined

export type InferMethodMessage<
  //
  M extends { message?: Schema },
> = M extends { message: Schema }
  ? LexValue & InferOutput<M['message']>
  : undefined

export const lexErrorData = object({
  error: string({ minLength: 1 }),
  message: optional(string()),
}) satisfies Schema<LexErrorData>
