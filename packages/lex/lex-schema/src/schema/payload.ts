import { LexValue } from '@atproto/lex-data'
import { Infer, Schema } from '../core.js'
import { ObjectSchema, ObjectSchemaShape, object } from './object.js'

export type InferPayload<TPayload extends Payload, TBinary> =
  TPayload extends Payload<infer TEncoding, infer TBody>
    ? TEncoding extends string
      ? {
          encoding: SchemaEncodingToDataEncoding<TEncoding>
          body: TBody extends Schema
            ? Infer<TBody>
            : TEncoding extends `application/json`
              ? LexValue
              : TBinary
        }
      : undefined
    : never

export type SchemaEncodingToDataEncoding<E extends string> = E extends '*/*'
  ? `${string}/${string}`
  : E extends `${infer T extends string}/*`
    ? `${T}/${string}`
    : E

export type InferPayloadEncoding<TPayload extends Payload> =
  TPayload['encoding'] extends string
    ? SchemaEncodingToDataEncoding<TPayload['encoding']>
    : undefined

export type InferPayloadBody<TPayload extends Payload, TBody> =
  InferPayload<TPayload, TBody> extends { body: infer B } ? B : undefined

export type PayloadShape<E extends string | undefined> = E extends undefined
  ? undefined
  : Schema | undefined

export class Payload<
  const TEncoding extends string | undefined = string | undefined,
  const TBody extends PayloadShape<TEncoding> = PayloadShape<TEncoding>,
> {
  constructor(
    readonly encoding: TEncoding,
    readonly schema: TBody,
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

/*@__NO_SIDE_EFFECTS__*/
export function payload<
  const E extends string | undefined = undefined,
  const S extends PayloadShape<E> = undefined,
>(encoding: E = undefined as E, validator: S = undefined as S) {
  return new Payload<E, S>(encoding, validator)
}

/*@__NO_SIDE_EFFECTS__*/
export function jsonPayload<const P extends ObjectSchemaShape>(
  properties: P,
): Payload<'application/json', ObjectSchema<P>> {
  return payload('application/json', object(properties))
}
