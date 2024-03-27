export type Transformer<I, O = I> = (input: I) => O | PromiseLike<O>
