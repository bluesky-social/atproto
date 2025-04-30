/**
 * Generic, potentially async, function. Parametrized for convenience reasons.
 */
export type Fn<A extends readonly unknown[], O> = (
  ...args: A
) => O | PromiseLike<O>

/**
 * Single input, single output, potentially async transformer function.
 */
export type Transformer<I, O = I> = (...args: [I]) => O | PromiseLike<O>
