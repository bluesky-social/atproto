import { Validator } from '../core.js'
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
  S extends Validator | undefined,
> = E extends string
  ? Body<E> & (S extends Validator<infer V> ? V : unknown)
  : never // No encoding means no payload

export type Payload<
  E extends string | undefined = any,
  S extends Validator | undefined = any,
> = E extends string
  ? S extends Validator<infer V>
    ? {
        encoding: E
        body: V
      }
    : {
        encoding: E
        body: Body<E>
      }
  : void

export type InferPayloadSchemaEncoding<P extends PayloadSchema> =
  P extends PayloadSchema<infer E, any> ? E : never

export type InferPayloadSchemaBody<P extends PayloadSchema> =
  P extends PayloadSchema<any, infer S>
    ? S extends Validator<infer V>
      ? V
      : P extends PayloadSchema<infer E extends string>
        ? Body<E>
        : P extends PayloadSchema<undefined>
          ? void
          : never
    : never

export class PayloadSchema<
  const Encoding extends string | undefined = any,
  const Schema extends Validator | undefined = any,
  Output extends ParsedBody<Encoding, Schema> = ParsedBody<Encoding, Schema>,
> {
  constructor(
    readonly encoding: Encoding,
    readonly schema: Schema,
  ) {}

  async parseResponseBody(response: Response): Promise<Output> {
    const encoding = response.headers.get('content-type')?.split(';')[0].trim()

    if (!this.encoding) {
      if (encoding || response.body) {
        await response.body?.cancel()
        // @TODO Errors
        throw new Error(
          `Expected empty response with no content, got ${response.status}`,
        )
      }

      return undefined as Output
    }

    if (encoding !== this.encoding) {
      await response.body?.cancel()

      // @TODO Errors
      throw new Error(
        `Expected response with content-type ${this.encoding}, got ${encoding}`,
      )
    }

    if (this.encoding === 'application/json') {
      if (this.schema) {
        // @NOTE JSON will automatically be coerced into IPLD/Lex structures
        return this.schema.$parse(await response.json())
      }

      // @NOTE Using stringToLex (instead of `jsonToLex(await response.json())`)
      // here as it should be more efficient than parsing to JSON first then
      // converting to Lex (fewer intermediate objects created, fewer need to
      // check to typeof)
      return jsonStringToLex(await response.text()) as Output
    }

    if (this.encoding.startsWith('text/')) {
      const text = await response.text()
      return this.schema ? this.schema.$parse(text) : (text as Output)
    }

    const data = response.body
      ? await response.arrayBuffer()
      : new ArrayBuffer(0)
    return this.schema ? this.schema.$parse(data) : (data as Output)
  }
}
