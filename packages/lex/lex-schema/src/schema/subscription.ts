import { NsidString } from '../core.js'
import { Infer, Schema } from '../validation.js'
import { ParamsSchema } from './params.js'

export type InferSubscriptionParameters<S extends Subscription> =
  S extends Subscription<any, infer P extends ParamsSchema, any>
    ? Infer<P>
    : never

export type InferSubscriptionMessage<S extends Subscription> =
  S extends Subscription<any, any, infer M extends Schema> ? Infer<M> : unknown

export class Subscription<
  TNsid extends NsidString = NsidString,
  TParameters extends ParamsSchema = ParamsSchema,
  TMessage extends Schema = Schema,
  TErrors extends undefined | readonly string[] = undefined | readonly string[],
> {
  readonly type = 'subscription' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly message: TMessage,
    readonly errors: TErrors,
  ) {}
}
