import { LexValue } from '@atproto/lex-data'
import {
  KnownError,
  LexRpcErrorBody,
  LexRpcErrorName,
  LexRpcResponse,
  LexRpcResponseFailure,
} from './response.js'

export class LexRpcError<
  N extends LexRpcErrorName = LexRpcErrorName,
> extends Error {
  constructor(
    public readonly name: N,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? `XRPC ${name} Error`, options)
  }

  static from(cause: unknown, message?: string): LexRpcError {
    if (cause instanceof LexRpcError) {
      return cause
    }
    return new LexRpcError(
      'Unknown',
      message ?? (cause instanceof Error ? cause.message : undefined),
      { cause },
    )
  }
}

export class LexRpcInvalidError<
  N extends LexRpcErrorName = KnownError.InvalidRequest,
> extends LexRpcError<N> {
  constructor(
    public readonly status: number,
    public readonly headers: Headers,
    public readonly body: undefined | LexValue,
    message = `Invalid XRPC request error response`,
    name: N = KnownError.InvalidRequest as N,
    options?: ErrorOptions,
  ) {
    super(name, message, options)
  }
}

export class LexRpcResponseError<
  N extends LexRpcErrorName = LexRpcErrorName,
> extends LexRpcError<N> {
  constructor(
    public readonly status: number,
    public readonly headers: Headers,
    public readonly body: LexRpcErrorBody & { error: N },
    options?: ErrorOptions,
  ) {
    super(body.error, body.message, options)
  }

  toResponseFailure(): LexRpcResponseFailure {
    return {
      success: false as const,
      status: this.status,
      headers: this.headers,
      encoding: 'application/json' as const,
      body: this.body,
    }
  }

  static fromResponseFailure(
    response: LexRpcResponseFailure,
  ): LexRpcResponseError {
    return new LexRpcResponseError(
      response.status,
      response.headers,
      response.body,
    )
  }

  static parseResponseSuccess<T extends LexRpcResponse>(response: T) {
    LexRpcResponseError.assertResponseSuccess(response)
    return response
  }

  static assertResponseSuccess<T extends LexRpcResponse>(
    response: T,
  ): asserts response is Extract<T, { success: true }> {
    if (response.success !== true) {
      throw LexRpcResponseError.fromResponseFailure(response)
    }
  }

  static toResponseFailure(err: unknown): LexRpcResponseFailure {
    if (err instanceof LexRpcResponseError) {
      return err.toResponseFailure()
    }

    throw err
  }
}
