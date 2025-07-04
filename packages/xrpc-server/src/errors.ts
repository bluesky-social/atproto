import { isHttpError } from 'http-errors'
import { z } from 'zod'
import {
  ResponseType,
  ResponseTypeStrings,
  XRPCError as XRPCClientError,
  httpResponseCodeToName,
  httpResponseCodeToString,
} from '@atproto/xrpc'

// @NOTE Do not depend (directly or indirectly) on "./types" here, as it would
// create a circular dependency.

export const errorResult = z.object({
  status: z.number(),
  error: z.string().optional(),
  message: z.string().optional(),
})
export type ErrorResult = z.infer<typeof errorResult>

export function isErrorResult(v: unknown): v is ErrorResult {
  return errorResult.safeParse(v).success
}

export function excludeErrorResult<V>(v: V) {
  if (isErrorResult(v)) throw XRPCError.fromErrorResult(v)
  return v as Exclude<V, ErrorResult>
}

export { ResponseType }

export class XRPCError extends Error {
  constructor(
    public type: ResponseType,
    public errorMessage?: string,
    public customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(errorMessage, options)
  }

  get statusCode(): number {
    const { type } = this

    // Fool-proofing. `new XRPCError(123.5 as number, '')` does not generate a TypeScript error.
    // Because of this, we can end-up with any numeric value instead of an actual `ResponseType`.
    // For legacy reasons, the `type` argument is not checked in the constructor, so we check it here.
    if (type < 400 || type >= 600 || !Number.isFinite(type)) {
      return 500
    }

    return type
  }

  get payload() {
    return {
      error: this.customErrorName ?? this.typeName,
      message:
        this.type === ResponseType.InternalServerError
          ? this.typeStr // Do not respond with error details for 500s
          : this.errorMessage || this.typeStr,
    }
  }

  get typeName(): string | undefined {
    return ResponseType[this.type]
  }

  get typeStr(): string | undefined {
    return ResponseTypeStrings[this.type]
  }

  static fromError(cause: unknown): XRPCError {
    if (cause instanceof XRPCError) {
      return cause
    }

    if (cause instanceof XRPCClientError) {
      const { error, message, type } = mapFromClientError(cause)
      return new XRPCError(type, message, error, { cause })
    }

    if (isHttpError(cause)) {
      return new XRPCError(cause.status, cause.message, cause.name, { cause })
    }

    if (isErrorResult(cause)) {
      return this.fromErrorResult(cause)
    }

    if (cause instanceof Error) {
      return new InternalServerError(cause.message, undefined, { cause })
    }

    return new InternalServerError(
      'Unexpected internal server error',
      undefined,
      { cause },
    )
  }

  static fromErrorResult(err: ErrorResult): XRPCError {
    return new XRPCError(err.status, err.message, err.error, { cause: err })
  }
}

export class InvalidRequestError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.InvalidRequest, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.InvalidRequest
    )
  }
}

export class AuthRequiredError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.AuthenticationRequired,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.AuthenticationRequired
    )
  }
}

export class ForbiddenError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.Forbidden, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError && instance.type === ResponseType.Forbidden
    )
  }
}

export class InternalServerError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.InternalServerError,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.InternalServerError
    )
  }
}

export class UpstreamFailureError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.UpstreamFailure, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.UpstreamFailure
    )
  }
}

export class NotEnoughResourcesError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.NotEnoughResources,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.NotEnoughResources
    )
  }
}

export class UpstreamTimeoutError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(ResponseType.UpstreamTimeout, errorMessage, customErrorName, options)
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.UpstreamTimeout
    )
  }
}

export class MethodNotImplementedError extends XRPCError {
  constructor(
    errorMessage?: string,
    customErrorName?: string,
    options?: ErrorOptions,
  ) {
    super(
      ResponseType.MethodNotImplemented,
      errorMessage,
      customErrorName,
      options,
    )
  }

  [Symbol.hasInstance](instance: unknown): boolean {
    return (
      instance instanceof XRPCError &&
      instance.type === ResponseType.MethodNotImplemented
    )
  }
}

/**
 * Converts an upstream XRPC {@link ResponseType} into a downstream {@link ResponseType}.
 */
function mapFromClientError(error: XRPCClientError): {
  error: string
  message: string
  type: ResponseType
} {
  switch (error.status) {
    case ResponseType.InvalidResponse:
      // Upstream server returned an XRPC response that is not compatible with our internal lexicon definitions for that XRPC method.
      // @NOTE This could be reflected as both a 500 ("we" are at fault) and 502 ("they" are at fault). Let's be gents about it.
      return {
        error: httpResponseCodeToName(ResponseType.InternalServerError),
        message: httpResponseCodeToString(ResponseType.InternalServerError),
        type: ResponseType.InternalServerError,
      }
    case ResponseType.Unknown:
      // Typically a network error / unknown host
      return {
        error: httpResponseCodeToName(ResponseType.InternalServerError),
        message: httpResponseCodeToString(ResponseType.InternalServerError),
        type: ResponseType.InternalServerError,
      }
    default:
      return {
        error: error.error,
        message: error.message,
        type: error.status,
      }
  }
}
