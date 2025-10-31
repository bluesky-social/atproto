import { Infer } from '../core.js'
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
  N extends string = any,
  P extends ParamsSchema = any,
  S extends undefined | RefSchema | TypedUnionSchema | ObjectSchema = any,
> {
  readonly type = 'subscription' as const

  constructor(
    readonly nsid: N,
    readonly parameters: P,
    readonly message: S,
  ) {}
}
