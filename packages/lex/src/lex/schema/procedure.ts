import { InferLexPayloadBody, LexPayload } from './payload.js'

export type InferLexProcedureInput<Q extends LexProcedure> =
  Q extends LexProcedure<any, infer I extends LexPayload, any>
    ? InferLexPayloadBody<I>
    : never

export type InferLexProcedureOutput<Q extends LexProcedure> =
  Q extends LexProcedure<any, any, infer O extends LexPayload>
    ? InferLexPayloadBody<O>
    : never

export class LexProcedure<
  N extends string = any,
  I extends LexPayload = any,
  O extends LexPayload = any,
> {
  constructor(
    readonly $nsid: N,
    readonly $input: I,
    readonly $output: O,
  ) {}
}
