import { InferPayloadSchemaBody, PayloadSchema } from './payload.js'

export type InferProcedureInput<Q extends Procedure> =
  Q extends Procedure<any, infer I extends PayloadSchema, any>
    ? InferPayloadSchemaBody<I>
    : never

export type InferProcedureOutput<Q extends Procedure> =
  Q extends Procedure<any, any, infer O extends PayloadSchema>
    ? InferPayloadSchemaBody<O>
    : never

export class Procedure<
  N extends string = any,
  I extends PayloadSchema = any,
  O extends PayloadSchema = any,
> {
  constructor(
    readonly nsid: N,
    readonly inputSchema: I,
    readonly outputSchema: O,
  ) {}
}
