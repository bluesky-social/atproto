import { NsidString } from '../core.js'
import { ParamsSchema } from './params.js'
import { Payload } from './payload.js'

export class Procedure<
  const TNsid extends NsidString = NsidString,
  const TParameters extends ParamsSchema = ParamsSchema,
  const TInputPayload extends Payload = Payload,
  const TOutputPayload extends Payload = Payload,
  const TErrors extends undefined | readonly string[] =
    | undefined
    | readonly string[],
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

/*@__NO_SIDE_EFFECTS__*/
export function procedure<
  const N extends NsidString,
  const P extends ParamsSchema,
  const I extends Payload,
  const O extends Payload,
  const E extends undefined | readonly string[] = undefined,
>(nsid: N, parameters: P, input: I, output: O, errors: E = undefined as E) {
  return new Procedure<N, P, I, O, E>(nsid, parameters, input, output, errors)
}
