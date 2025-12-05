import { NsidString } from '../core.js'
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
  TNsid extends NsidString = any,
  TParameters extends ParamsSchema = any,
  TInputPayload extends Payload = any,
  TOutputPayload extends Payload = any,
  TErrors extends undefined | readonly string[] = any,
> {
  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly input: TInputPayload,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
