import { NsidString } from '../core.js'
import { Infer } from '../validation.js'
import { ParamsSchema } from './params.js'
import { InferPayloadData, Payload } from './payload.js'

export type InferQueryParameters<Q extends Query> = Infer<Q['parameters']>
export type InferQueryOutputBody<Q extends Query> = InferPayloadData<
  Q['output']
>

export class Query<
  TNsid extends NsidString = NsidString,
  TParameters extends ParamsSchema = ParamsSchema,
  TOutputPayload extends Payload = Payload,
  TErrors extends undefined | readonly string[] = undefined | readonly string[],
> {
  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
