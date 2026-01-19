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

/*@__NO_SIDE_EFFECTS__*/
export function query<
  const N extends NsidString,
  const P extends ParamsSchema,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, output: O, errors: E = undefined as E) {
  return new Query<N, P, O, E>(nsid, parameters, output, errors)
}
