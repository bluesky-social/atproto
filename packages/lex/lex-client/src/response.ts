import {
  InferPayloadBody,
  InferPayloadEncoding,
  Procedure,
  Query,
  ResultSuccess,
} from '@atproto/lex-schema'

export type XrpcResponseEncoding<M extends Procedure | Query> =
  InferPayloadEncoding<M['output']>

export type XrpcResponseBody<M extends Procedure | Query> = InferPayloadBody<
  M['output']
>

/**
 * Small container for XRPC response data.
 *
 * @implements {ResultSuccess<XrpcResponse<M>>} for convenience in result handling contexts.
 */
export class XrpcResponse<M extends Procedure | Query>
  implements ResultSuccess<XrpcResponse<M>>
{
  /** @see {@link ResultSuccess.success} */
  readonly success = true as const

  /** @see {@link ResultSuccess.value} */
  get value(): this {
    return this
  }

  get encoding(): XrpcResponseEncoding<M> {
    return this.method.output?.encoding
  }

  constructor(
    readonly method: M,
    readonly status: number,
    readonly headers: Headers,
    readonly body: XrpcResponseBody<M>,
  ) {}
}
