import { LexValue } from '@atproto/lex-data'
import { Infer, Validator } from '../validation.js'

export type LexBody<E extends string = any> = E extends `text/${string}`
  ? string // Text encodings always yield string bodies
  : E extends 'application/json'
    ? LexValue
    : Uint8Array

export type InferPayloadEncoding<P extends Payload> =
  P extends Payload<infer E, any> ? E : undefined

export type InferPayloadBody<P extends Payload> =
  P extends Payload<any, infer S>
    ? S extends Validator
      ? Infer<S>
      : P extends Payload<infer E extends string>
        ? LexBody<E>
        : undefined
    : undefined

export type PayloadOutput<
  E extends string | undefined = any,
  S extends Validator | undefined = any,
> = E extends string
  ? S extends Validator
    ? {
        encoding: E
        body: Infer<S>
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
