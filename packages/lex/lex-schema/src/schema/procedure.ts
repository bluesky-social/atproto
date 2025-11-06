import { Nsid } from '../core.js'
import { Infer } from '../validation.js'
import { ParamsSchema } from './params.js'
import { InferPayloadBody, Payload } from './payload.js'

export type InferProcedureParameters<Q extends Procedure> =
  Q extends Procedure<any, infer P extends ParamsSchema, any> ? Infer<P> : never

export type InferProcedureInputBody<Q extends Procedure> =
  Q extends Procedure<any, any, infer I extends Payload, any>
    ? InferPayloadBody<I>
    : never

export type InferProcedureOutputBody<Q extends Procedure> =
  Q extends Procedure<any, any, any, infer O extends Payload>
    ? InferPayloadBody<O>
    : never

export class Procedure<
  N extends Nsid = Nsid,
  P extends ParamsSchema = ParamsSchema,
  I extends Payload = Payload,
  O extends Payload = Payload,
> {
  readonly lexiconType = 'procedure' as const

  constructor(
    readonly nsid: N,
    readonly parameters: P,
    readonly input: I,
    readonly output: O,
  ) {}
}
