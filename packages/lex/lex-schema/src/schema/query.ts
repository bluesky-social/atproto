import { NsidString } from '../core.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'

export class Query<
  TNsid extends NsidString = NsidString,
  TParameters extends ParamsSchema = ParamsSchema,
  TOutputPayload extends Payload = Payload,
  TErrors extends undefined | readonly string[] = undefined | readonly string[],
> {
  readonly type = 'query' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
