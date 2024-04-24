import { Transformer } from './transformer.js'

export type FirstTransformerInput<T extends Transformer<any>[]> = T extends [
  Transformer<infer I, any>,
  ...any[],
]
  ? I
  : T extends Transformer<infer I, any>[]
    ? I
    : never

export type LastTransformerOutput<T extends Transformer<any>[]> = T extends [
  ...any[],
  Transformer<any, infer O>,
]
  ? O
  : T extends Transformer<any, infer O>[]
    ? O
    : never

export type TansformerCompose<
  F extends Transformer<any>[],
  Acc extends Transformer<any>[] = [],
> = F extends [Transformer<infer I, infer O>]
  ? [...Acc, Transformer<I, O>]
  : F extends [Transformer<infer A, any>, ...infer Tail]
    ? Tail extends [Transformer<infer B, any>, ...any[]]
      ? TansformerCompose<Tail, [...Acc, Transformer<A, B>]>
      : Acc
    : Acc

export function compose(): <V>(v: V) => Promise<V>
export function compose<T extends Transformer<any>[]>(
  ...transformers: TansformerCompose<T> extends T ? T : TansformerCompose<T>
): (input: FirstTransformerInput<T>) => Promise<LastTransformerOutput<T>>
export function compose<T extends Transformer<any>[]>(
  ...transformers: TansformerCompose<T> extends T ? T : TansformerCompose<T>
): (input: FirstTransformerInput<T>) => Promise<LastTransformerOutput<T>> {
  const { length, 0: a, 1: b, 2: c, 3: d } = transformers
  switch (length) {
    case 0:
      return async (v) => v as any
    case 1:
      return async (v) => a!(v)
    case 2:
      return async (v) => b!(await a!(v))
    case 3:
      return async (v) => c!(await b!(await a!(v)))
    case 4:
      return async (v) => d!(await c!(await b!(await a!(v))))
    default: {
      return async (v: any) => {
        for (let i = 0; i < length; i++) {
          v = await transformers[i]!.call(null, v)
        }
        return v
      }
    }
  }
}
