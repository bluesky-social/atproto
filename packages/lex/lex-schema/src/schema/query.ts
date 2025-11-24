import { Nsid } from '../core.js'
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
  N extends Nsid = any,
  P extends ParamsSchema = any,
  O extends Payload = any,
  E extends undefined | readonly string[] = any,
> {
  readonly lexiconType = 'query' as const

  constructor(
    readonly nsid: N,
    readonly parameters: P,
    readonly output: O,
    readonly errors: E,
  ) {}
}
