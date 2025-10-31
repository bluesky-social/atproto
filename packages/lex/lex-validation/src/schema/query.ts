import { Nsid } from '@atproto/lex-core'
import { Infer } from '../validation.js'
import { ParamsSchema } from './params.js'
import { InferPayloadBody, Payload } from './payload.js'

export type InferQueryParameters<Q extends Query> =
  Q extends Query<any, infer P extends ParamsSchema, any> ? Infer<P> : never

export type InferQueryOutputBody<Q extends Query> =
  Q extends Query<any, any, infer O extends Payload>
    ? InferPayloadBody<O>
    : never

export class Query<
  N extends Nsid = Nsid,
  P extends ParamsSchema = ParamsSchema,
  O extends Payload = Payload,
> {
  readonly lexiconType = 'query' as const

  constructor(
    readonly nsid: N,
    readonly parameters: P,
    readonly output: O,
  ) {}
}
