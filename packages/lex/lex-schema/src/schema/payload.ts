import { LexValue } from '@atproto/lex-data'
import { Infer, Schema } from '../validation.js'

export type InferPayload<P extends Payload> =
  P['encoding'] extends infer E extends string
    ? {
        encoding: SchemaEncodingToDataEncoding<E>
        body: InferPayloadData<P>
        data vs body
      }
    : undefined

export type SchemaEncodingToDataEncoding<E extends string> = E extends '*/*'
  ? string
  : E extends `${infer T extends string}/*`
    ? `${T}/${string}`
    : E

export type InferPayloadEncoding<P extends Payload> =
  P['encoding'] extends string
    ? SchemaEncodingToDataEncoding<P['encoding']>
    : undefined

export type InferPayloadData<P extends Payload> =
  P['encoding'] extends undefined
    ? undefined
    : P['encoding'] extends `*/*`
      ? Uint8Array // encoding/decoding is disabled
      : P['schema'] extends Schema
        ? Infer<P['schema']>
        : P['encoding'] extends `text/${string}`
          ? string
          : LexValue

export type PayloadSchema<E extends string | undefined> = E extends undefined
  ? undefined
  : Schema | undefined

export class Payload<
  const Encoding extends string | undefined = string | undefined,
  const Schema extends PayloadSchema<Encoding> = PayloadSchema<Encoding>,
> {
  constructor(
    readonly encoding: Encoding,
    readonly schema: Schema,
  ) {
    if (encoding === undefined && schema !== undefined) {
      throw new TypeError('schema cannot be defined when encoding is undefined')
    }
  }
}
