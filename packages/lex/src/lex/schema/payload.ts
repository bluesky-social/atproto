import {
  ValidationContext,
  ValidationResult,
  Validator,
  coerceToString,
  isPureObject,
} from '../core.js'
import { TypedJsonBlobRef } from './_blob-ref.js'
import { Lex } from './_serialize.js'

export type { TypedJsonBlobRef }

export type LexBody<E extends string = any> = E extends `text/${string}`
  ? string // Text encodings always yield string bodies
  : E extends 'application/json'
    ? Lex
    : Uint8Array

export type InferPayloadSchemaEncoding<P extends PayloadSchema> =
  P extends PayloadSchema<infer E, any> ? E : never

export type InferPayloadSchemaBody<P extends PayloadSchema> =
  P extends PayloadSchema<any, infer S>
    ? S extends Validator<infer V>
      ? V
      : P extends PayloadSchema<infer E extends string>
        ? LexBody<E>
        : never
    : never

export type PayloadOutput<
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
        body: LexBody<E>
      }
  : void

export class PayloadSchema<
  const Encoding extends string | undefined = any,
  const Schema extends Validator | undefined = any,
> extends Validator<PayloadOutput<Encoding, Schema>> {
  constructor(
    readonly encoding: Encoding,
    readonly schema: Schema,
  ) {
    if (encoding === undefined && schema !== undefined) {
      throw new TypeError('schema cannot be defined when encoding is undefined')
    }

    super()
  }

  protected override validateInContext(
    input: unknown,
    ctx: ValidationContext,
  ): ValidationResult<PayloadOutput<Encoding, Schema>> {
    if (this.encoding == null) {
      if (input !== undefined && !isPureObject(input)) {
        return ctx.issueInvalidType(input, ['object', 'undefined'])
      }

      if (input?.encoding != null) {
        return ctx.issueInvalidPropertyValue(input, 'encoding', [undefined])
      }

      if (input?.body != null) {
        return ctx.issueInvalidPropertyValue(input, 'body', [undefined])
      }

      return ctx.success(undefined as PayloadOutput<Encoding, Schema>)
    }

    // this.encoding is defined beyond this point, a payload is expected

    if (!isPureObject(input)) {
      return ctx.issueInvalidType(input, 'object')
    }

    if (this.encoding !== input.encoding) {
      return ctx.issueInvalidPropertyValue(input, 'encoding', [this.encoding])
    }

    if (this.schema) {
      const result = ctx.validateChild(input, 'body', this.schema)
      if (!result.success) return result

      // Create a new output only if the validation transformed the body
      const output =
        result.value === input.body
          ? input
          : { ...input, encoding: this.encoding, body: result.value }

      return ctx.success(output as PayloadOutput<Encoding, Schema>)
    }

    if (this.encoding.startsWith('text/') && typeof input.body !== 'string') {
      const body = coerceToString(input.body)
      if (body != null) {
        const output = { ...input, encoding: this.encoding, body }
        return ctx.success(output as PayloadOutput<Encoding, Schema>)
      }

      return ctx.issueInvalidType(input.body, 'string')
    }

    if (input.body instanceof ArrayBuffer) {
      const body = new Uint8Array(input.body)
      const output = { ...input, encoding: this.encoding, body }
      return ctx.success(output as PayloadOutput<Encoding, Schema>)
    }

    // Note we assume that input.body is a valid Lex value at this point (though
    // we don't verify it)

    return ctx.success(input as PayloadOutput<Encoding, Schema>)
  }
}
