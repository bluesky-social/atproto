import { Infer, NsidString, Schema } from '../core.js'
import { ParamsSchema } from './params.js'

export type InferSubscriptionParameters<S extends Subscription> = Infer<
  S['parameters']
>

export type InferSubscriptionMessage<S extends Subscription> = Infer<
  S['message']
>

export class Subscription<
  const TNsid extends NsidString = NsidString,
  const TParameters extends ParamsSchema = ParamsSchema,
  const TMessage extends Schema = Schema,
  const TErrors extends undefined | readonly string[] =
    | undefined
    | readonly string[],
> {
  readonly type = 'subscription' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly message: TMessage,
    readonly errors: TErrors,
  ) {}
}
