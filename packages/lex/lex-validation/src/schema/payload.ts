import { Lex } from '@atproto/lex-core'
import { Validator } from '../validation.js'

export type LexBody<E extends string = any> = E extends `text/${string}`
  ? string // Text encodings always yield string bodies
  : E extends 'application/json'
    ? Lex
    : Uint8Array

export type InferPayloadEncoding<P extends Payload> =
  P extends Payload<infer E, any> ? E : never

export type InferPayloadBody<P extends Payload> =
  P extends Payload<any, infer S>
    ? S extends Validator<infer V>
      ? V
      : P extends Payload<infer E extends string>
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

export type PayloadBody<E extends string | undefined> = E extends undefined
  ? undefined
  : Validator | undefined

export class Payload<
  const Encoding extends string | undefined = string | undefined,
  const Body extends PayloadBody<Encoding> = PayloadBody<Encoding>,
> {
  constructor(
    readonly encoding: Encoding,
    readonly schema: Body,
  ) {
    if (encoding === undefined && schema !== undefined) {
      throw new TypeError('schema cannot be defined when encoding is undefined')
    }
  }
}
