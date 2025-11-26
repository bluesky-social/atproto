import { NsidString } from '../core.js'
import { Infer } from '../validation.js'
import { ObjectSchema } from './object.js'
import { ParamsSchema } from './params.js'
import { RefSchema } from './ref.js'
import { TypedUnionSchema } from './typed-union.js'

export type InferSubscriptionParameters<S extends Subscription> =
  S extends Subscription<any, infer P extends ParamsSchema, any>
    ? Infer<P>
    : never

export type InferSubscriptionMessage<S extends Subscription> =
  S extends Subscription<
    any,
    any,
    infer M extends RefSchema | TypedUnionSchema | ObjectSchema
  >
    ? Infer<M>
    : unknown

export class Subscription<
  TNsid extends NsidString = any,
  TParameters extends ParamsSchema = any,
  TMessage extends
    | undefined
    | RefSchema
    | TypedUnionSchema
    | ObjectSchema = any,
  TErrors extends undefined | readonly string[] = any,
> {
  readonly type = 'subscription' as const

  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly message: TMessage,
    readonly errors: TErrors,
  ) {}
}
