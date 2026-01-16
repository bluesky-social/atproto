import { NsidString } from '../core.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'

export class Query<
  const TNsid extends NsidString = NsidString,
  const TParameters extends ParamsSchema = ParamsSchema,
  const TOutputPayload extends Payload = Payload,
  const TErrors extends undefined | readonly string[] =
    | undefined
    | readonly string[],
> {
  readonly type = 'query' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
