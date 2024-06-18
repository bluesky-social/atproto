import { Transformer } from './transformer.js'

type PipelineInput<T extends readonly Transformer<any>[]> = T extends [
  Transformer<infer I, any>,
  ...any[],
]
  ? I
  : T extends Transformer<infer I, any>[]
    ? I
    : never

type PipelineOutput<T extends readonly Transformer<any>[]> = T extends [
  ...any[],
  Transformer<any, infer O>,
]
  ? O
  : T extends Transformer<any, infer O>[]
    ? O
    : never

type Pipeline<
  F extends readonly Transformer<any>[],
  Acc extends readonly Transformer<any>[] = [],
> = F extends [Transformer<infer I, infer O>]
  ? [...Acc, Transformer<I, O>]
  : F extends [Transformer<infer A, any>, ...infer Tail]
    ? Tail extends [Transformer<infer B, any>, ...any[]]
      ? Pipeline<Tail, [...Acc, Transformer<A, B>]>
      : Acc
    : Acc

/**
 * This utility function allows to properly type a pipeline of transformers.
 *
 * @example
 * ```ts
 * // Will be typed as "(input: string) => Promise<number>"
 * const parse = pipe(
 *   async (input: string) => JSON.parse(input),
 *   async (input: unknown) => {
 *     if (typeof input === 'number') return input
 *     throw new TypeError('Invalid input')
 *   },
 *   (input: number) => input * 2,
 * )
 * ```
 */
export function pipe(): never
export function pipe<T extends readonly Transformer<any>[]>(
  ...pipeline: Pipeline<T> extends T ? T : Pipeline<T>
): (input: PipelineInput<T>) => Promise<PipelineOutput<T>>
export function pipe<T extends readonly Transformer<any>[]>(
  ...pipeline: Pipeline<T> extends T ? T : Pipeline<T>
): (input: PipelineInput<T>) => Promise<PipelineOutput<T>> {
  return pipeline.reduce(pipeTwo)
}

export function pipeTwo<I, O, X = unknown>(
  first: Transformer<I, X>,
  second: Transformer<X, O>,
): (input: I) => Promise<O> {
  return async (input) => second(await first(input))
}
