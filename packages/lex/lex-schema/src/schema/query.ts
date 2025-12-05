import { NsidString } from '../core.js'
import { Infer } from '../validation.js'
import { ParamsSchema } from './params.js'
import { InferPayloadBody, Payload } from './payload.js'

export type InferQueryParameters<Q extends Query> =
  Q extends Query<any, infer P extends ParamsSchema, any> ? Infer<P> : never

export type InferQueryOutputBody<Q extends Query> =
  Q extends Query<any, any, infer O extends Payload>
    ? InferPayloadBody<O>
    : never

export class Query<
  TNsid extends NsidString = any,
  TParameters extends ParamsSchema = any,
  TOutputPayload extends Payload = any,
  TErrors extends undefined | readonly string[] = any,
> {
  constructor(
    readonly nsid: TNsid,
    readonly parameters: TParameters,
    readonly output: TOutputPayload,
    readonly errors: TErrors,
  ) {}
}
