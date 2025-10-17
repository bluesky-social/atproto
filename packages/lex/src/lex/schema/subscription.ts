import { Infer } from '../core.js'
import { LexObject } from './object.js'
import { LexParams } from './params.js'
import { LexRef } from './ref.js'
import { LexTypedUnion } from './typed-union.js'

export type InferLexSubscriptionMessage<S extends LexSubscription> =
  S extends LexSubscription<
    any,
    any,
    infer M extends LexRef | LexTypedUnion | LexObject
  >
    ? Infer<M>
    : unknown

export type InferLexSubscriptionParameters<S extends LexSubscription> =
  S extends LexSubscription<any, infer P extends LexParams, any>
    ? Infer<P>
    : never

export class LexSubscription<
  N extends string = any,
  P extends LexParams = any,
  M extends undefined | LexRef | LexTypedUnion | LexObject = any,
> {
  constructor(
    readonly $nsid: N,
    readonly $parameters: P,
    readonly $message: M,
  ) {}
}
