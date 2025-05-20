import { Fn, Transformer } from './type.js'

type PipelineArgs<T> = T extends [
  Fn<infer A extends readonly unknown[], any>,
  ...any[],
]
  ? A
  : never

type PipelineOutput<T> = T extends [...any[], Fn<any, infer O>] ? O : never

type PipelineRecursive<
  F extends readonly Transformer<any>[],
  Acc extends any[],
> = F extends readonly [Transformer<infer I, infer O>]
  ? [...Acc, Transformer<I, O>]
  : F extends readonly [Transformer<infer A, any>, ...infer Tail]
    ? Tail extends readonly [Transformer<infer B, any>, ...any[]]
      ? PipelineRecursive<Tail, [...Acc, Transformer<A, B>]>
      : never
    : never

type Pipeline<F extends readonly [Fn<any, any>, ...Transformer<any>[]]> =
  F extends readonly [Fn<infer A, infer O>]
    ? [Fn<A, O>]
    : F extends readonly [Fn<infer A, any>, ...infer Tail]
      ? Tail extends readonly [Transformer<infer B, any>, ...any[]]
        ? PipelineRecursive<Tail, [Fn<A, B>]>
        : never
      : never

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
export function pipe<T extends readonly [Fn<any, any>, ...Transformer<any>[]]>(
  ...pipeline: Pipeline<T> extends T ? T : Pipeline<T>
) {
  return pipeline.reduce(pipeTwo) as (
    ...args: PipelineArgs<T>
  ) => Promise<PipelineOutput<T>>
}

export function pipeTwo<A extends readonly unknown[], O, X = unknown>(
  first: Fn<A, X>,
  second: Transformer<X, O>,
): (...args: A) => Promise<O> {
  return async (...args) => second(await first(...args))
}
