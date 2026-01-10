import { LexValue } from '@atproto/lex-data'
import { Infer, Schema } from '../core.js'

export type InferPayload<
  P extends Payload,
  B,
> = P['encoding'] extends infer E extends string
  ? {
      encoding: SchemaEncodingToDataEncoding<E>
      body: InferPayloadBody<P, B>
    }
  : void | undefined

export type SchemaEncodingToDataEncoding<E extends string> = E extends '*/*'
  ? `${string}/${string}`
  : E extends `${infer T extends string}/*`
    ? `${T}/${string}`
    : E

export type InferPayloadEncoding<P extends Payload> =
  P['encoding'] extends string
    ? SchemaEncodingToDataEncoding<P['encoding']>
    : undefined

export type InferPayloadBody<
  P extends Payload,
  B,
> = P['encoding'] extends undefined
  ? undefined // No encoding, no payload
  : P['schema'] extends Schema
    ? Infer<P['schema']>
    : P['encoding'] extends `application/json`
      ? LexValue
      : B

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

  /**
   * Checks whether the given content-type matches the expected payload schema's
   * encoding.
   */
  matchesEncoding(contentType: string | undefined): boolean {
    const mime = contentType?.split(';', 1)[0].trim()

    const { encoding } = this

    // Handle undefined cases
    if (encoding === undefined) {
      // Expecting no body
      return mime === undefined
    } else if (mime === undefined) {
      // Expecting a body, but got no content-type
      return false
    }

    if (encoding === '*/*') {
      return true
    }

    if (encoding.endsWith('/*')) {
      return mime.startsWith(encoding.slice(0, -1))
    }

    // Invalid: Lexicon can only specify "*/*" or "type/*" wildcards
    if (encoding.includes('*')) {
      return false
    }

    return encoding === mime
  }
}
