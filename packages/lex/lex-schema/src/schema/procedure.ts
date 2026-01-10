import { NsidString } from '../core.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'

export class Procedure<
  TNsid extends NsidString = NsidString,
  TParameters extends ParamsSchema = ParamsSchema,
  TInputPayload extends Payload = Payload,
  TOutputPayload extends Payload = Payload,
  TErrors extends undefined | readonly string[] = undefined | readonly string[],
> {
  readonly type = 'procedure' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly input: TInputPayload,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
