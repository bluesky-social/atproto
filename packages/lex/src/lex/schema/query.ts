import { Infer } from '../core.js'
import { ParamsSchema } from './params.js'
import { InferPayloadSchemaBody, PayloadSchema } from './payload.js'

export type InferQueryParameters<Q extends Query> =
  Q extends Query<any, infer P extends ParamsSchema, any> ? Infer<P> : never

export type InferQueryOutput<Q extends Query> =
  Q extends Query<any, any, infer O extends PayloadSchema>
    ? InferPayloadSchemaBody<O>
    : never

export class Query<
  N extends string = any,
  P extends ParamsSchema = any,
  O extends PayloadSchema = any,
> {
  constructor(
    readonly nsid: N,
    readonly parameters: P,
    readonly output: O,
  ) {}
}
