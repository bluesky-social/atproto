import { NsidString } from '../core.js'
import { Infer } from '../validation.js'
import { ParamsSchema } from './params.js'
import { InferPayloadData, Payload } from './payload.js'

export type InferProcedureParameters<Q extends Procedure> = Infer<
  Q['parameters']
>
export type InferProcedureInputBody<Q extends Procedure> = InferPayloadData<
  Q['input']
>
export type InferProcedureOutputBody<Q extends Procedure> = InferPayloadData<
  Q['output']
>

export class Procedure<
  TNsid extends NsidString = NsidString,
  TParameters extends ParamsSchema = ParamsSchema,
  TInputPayload extends Payload = Payload,
  TOutputPayload extends Payload = Payload,
  TErrors extends undefined | readonly string[] = undefined | readonly string[],
> {
  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly input: TInputPayload,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
