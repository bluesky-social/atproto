import { Infer } from '../core.js'
import { ParamsSchema } from './params.js'
import { InferPayloadSchemaBody, PayloadSchema } from './payload.js'

export type InferProcedureParameters<Q extends Procedure> =
  Q extends Procedure<any, infer P extends ParamsSchema, any> ? Infer<P> : never

export type InferProcedureInput<Q extends Procedure> =
  Q extends Procedure<any, any, infer I extends PayloadSchema, any>
    ? InferPayloadSchemaBody<I>
    : never

export type InferProcedureOutput<Q extends Procedure> =
  Q extends Procedure<any, any, any, infer O extends PayloadSchema>
    ? InferPayloadSchemaBody<O>
    : never

export class Procedure<
  N extends string = any,
  P extends ParamsSchema = any,
  I extends PayloadSchema = any,
  O extends PayloadSchema = any,
> {
  constructor(
    readonly nsid: N,
    readonly parameters: P,
    readonly input: I,
    readonly output: O,
  ) {}
}
