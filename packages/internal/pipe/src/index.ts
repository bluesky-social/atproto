export type Transformer<I, O = I> = (input: I) => O | PromiseLike<O>

type FirstPipelineInput<T extends Transformer<any>[]> = T extends [
  Transformer<infer I, any>,
  ...any[],
]
  ? I
  : T extends Transformer<infer I, any>[]
    ? I
    : never

type LastPipelineOutput<T extends Transformer<any>[]> = T extends [
  ...any[],
  Transformer<any, infer O>,
]
  ? O
  : T extends Transformer<any, infer O>[]
    ? O
    : never

type Pipeline<
  F extends Transformer<any>[],
  Acc extends Transformer<any>[] = [],
> = F extends [Transformer<infer I, infer O>]
  ? [...Acc, Transformer<I, O>]
  : F extends [Transformer<infer A, any>, ...infer Tail]
    ? Tail extends [Transformer<infer B, any>, ...any[]]
      ? Pipeline<Tail, [...Acc, Transformer<A, B>]>
      : Acc
    : Acc

export function pipe(): <V>(v: V) => Promise<V>
export function pipe<T extends Transformer<any>[]>(
  ...pipeline: Pipeline<T> extends T ? T : Pipeline<T>
): (input: FirstPipelineInput<T>) => Promise<LastPipelineOutput<T>>
export function pipe<T extends Transformer<any>[]>(
  ...pipeline: Pipeline<T> extends T ? T : Pipeline<T>
): (input: FirstPipelineInput<T>) => Promise<LastPipelineOutput<T>> {
  const { length, 0: a, 1: b, 2: c, 3: d } = pipeline
  switch (length) {
    case 0:
      throw new TypeError('pipe requires at least one argument')
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
          v = await pipeline[i]!.call(null, v)
        }
        return v
      }
    }
  }
}
