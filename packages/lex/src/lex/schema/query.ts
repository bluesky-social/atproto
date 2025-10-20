import { Infer } from '../core.js'
import { ParamsSchema } from './params.js'
import { InferPayloadSchemaBody, PayloadSchema } from './payload.js'

export type InferQueryParams<Q extends Query> =
  Q extends Query<any, any, infer P extends ParamsSchema> ? Infer<P> : never

export type InferQueryOutput<Q extends Query> =
  Q extends Query<any, infer O extends PayloadSchema, any>
    ? InferPayloadSchemaBody<O>
    : never

export class Query<
  N extends string = any,
  O extends PayloadSchema = any,
  P extends ParamsSchema = any,
> {
  constructor(
    readonly nsid: N,
    readonly outputSchema: O,
    readonly parametersSchema: P,
  ) {}
}
