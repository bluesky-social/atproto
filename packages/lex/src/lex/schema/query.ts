import { Infer } from '../core.js'
import { LexParams } from './params.js'
import { InferLexPayloadBody, LexPayload } from './payload.js'

export type InferLexQueryParams<Q extends LexQuery> =
  Q extends LexQuery<any, any, infer P extends LexParams> ? Infer<P> : never

export type InferLexQueryOutput<Q extends LexQuery> =
  Q extends LexQuery<any, infer O extends LexPayload, any>
    ? InferLexPayloadBody<O>
    : never

export class LexQuery<
  N extends string = any,
  O extends LexPayload = any,
  P extends LexParams = any,
> {
  constructor(
    readonly $nsid: N,
    readonly $output: O,
    readonly $parameters: P,
  ) {}
}
