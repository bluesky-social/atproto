import { LexValidator } from '../core.js'
import { TypedJsonBlobRef } from './_blob-ref.js'
import { Lex, jsonStringToLex } from './_serialize.js'

export type { TypedJsonBlobRef }

export type Body<E extends string = any> = E extends `text/${string}`
  ? string // Text encodings always yield string bodies
  : E extends 'application/json'
    ? Lex
    : ArrayBuffer

export type ParsedBody<
  E extends string | undefined,
  S extends LexValidator | undefined,
> = E extends string
  ? Body<E> & (S extends LexValidator<infer V> ? V : unknown)
  : never // No encoding means no payload

export type Payload<
  E extends string | undefined = any,
  S extends LexValidator | undefined = any,
> = E extends string
  ? S extends LexValidator<infer V>
    ? {
        encoding: E
        body: V
      }
    : {
        encoding: E
        body: Body<E>
      }
  : void

export type InferLexPayloadEncoding<P extends LexPayload> =
  P extends LexPayload<infer E, any> ? E : never

export type InferLexPayloadBody<P extends LexPayload> =
  P extends LexPayload<any, infer S>
    ? S extends LexValidator<infer V>
      ? V
      : P extends LexPayload<infer E extends string>
        ? Body<E>
        : P extends LexPayload<undefined>
          ? void
          : never
    : never

export class LexPayload<
  const Encoding extends string | undefined = any,
  const Schema extends LexValidator | undefined = any,
  Output extends ParsedBody<Encoding, Schema> = ParsedBody<Encoding, Schema>,
> {
  constructor(
    readonly $encoding: Encoding,
    readonly $body: Schema,
  ) {}

  async $parseResponseBody(response: Response): Promise<Output> {
    const encoding = response.headers.get('content-type')?.split(';')[0].trim()

    if (!this.$encoding) {
      if (encoding || response.body) {
        await response.body?.cancel()
        // @TODO Errors
        throw new Error(
          `Expected empty response with no content, got ${response.status}`,
        )
      }

      return undefined as Output
    }

    if (encoding !== this.$encoding) {
      await response.body?.cancel()

      // @TODO Errors
      throw new Error(
        `Expected response with content-type ${this.$encoding}, got ${encoding}`,
      )
    }

    if (this.$encoding === 'application/json') {
      if (this.$body) {
        // @NOTE JSON will automatically be coerced into IPLD/Lex structures
        return this.$body.$parse(await response.json())
      }

      // @NOTE Using stringToLex (instead of `jsonToLex(await response.json())`)
      // here as it should be more efficient than parsing to JSON first then
      // converting to Lex (fewer intermediate objects created, fewer need to
      // check to typeof)
      return jsonStringToLex(await response.text()) as Output
    }

    if (this.$encoding.startsWith('text/')) {
      const text = await response.text()
      return this.$body ? this.$body.$parse(text) : (text as Output)
    }

    const data = response.body
      ? await response.arrayBuffer()
      : new ArrayBuffer(0)
    return this.$body ? this.$body.$parse(data) : (data as Output)
  }
}
