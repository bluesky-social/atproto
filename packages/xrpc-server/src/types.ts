import { IncomingMessage } from 'http'
import express from 'express'
import { isHttpError } from 'http-errors'
import zod from 'zod'
import {
  ResponseType,
  ResponseTypeStrings,
  ResponseTypeNames,
} from '@atproto/xrpc'

export type Options = {
  validateResponse?: boolean
  payload?: {
    jsonLimit?: number
    blobLimit?: number
    textLimit?: number
  }
}

export type UndecodedParams = typeof express.request['query']

export type Primitive = string | number | boolean
export type Params = Record<string, Primitive | Primitive[] | undefined>

export const handlerInput = zod.object({
  encoding: zod.string(),
  body: zod.any(),
})
export type HandlerInput = zod.infer<typeof handlerInput>

export const handlerAuth = zod.object({
  credentials: zod.any(),
  artifacts: zod.any(),
})
export type HandlerAuth = zod.infer<typeof handlerAuth>

export const handlerSuccess = zod.object({
  encoding: zod.string(),
  body: zod.any(),
  headers: zod.record(zod.string()).optional(),
})
export type HandlerSuccess = zod.infer<typeof handlerSuccess>

export const handlerError = zod.object({
  status: zod.number(),
  error: zod.string().optional(),
  message: zod.string().optional(),
})
export type HandlerError = zod.infer<typeof handlerError>

export type HandlerOutput = HandlerSuccess | HandlerError

export type XRPCHandler = (ctx: {
  auth: HandlerAuth | undefined
  params: Params
  input: HandlerInput | undefined
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput | undefined

export type XRPCStreamHandler = (ctx: {
  auth: HandlerAuth | undefined
  params: Params
  req: IncomingMessage
  signal: AbortSignal
}) => AsyncIterable<unknown>

export type AuthOutput = HandlerAuth | HandlerError

export type AuthVerifier = (ctx: {
  req: express.Request
  res: express.Response
}) => Promise<AuthOutput> | AuthOutput

export type StreamAuthVerifier = (ctx: {
  req: IncomingMessage
}) => Promise<AuthOutput> | AuthOutput

export type XRPCHandlerConfig = {
  auth?: AuthVerifier
  handler: XRPCHandler
}

export type XRPCStreamHandlerConfig = {
  auth?: StreamAuthVerifier
  handler: XRPCStreamHandler
}

export class XRPCError extends Error {
  constructor(
    public type: ResponseType,
    public errorMessage?: string,
    public customErrorName?: string,
  ) {
    super(errorMessage)
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
    return ResponseTypeNames[this.type]
  }

  get typeStr(): string | undefined {
    return ResponseTypeStrings[this.type]
  }

  static fromError(error: unknown) {
    if (error instanceof XRPCError) {
      return error
    }
    let resultErr: XRPCError
    if (isHttpError(error)) {
      resultErr = new XRPCError(error.status, error.message, error.name)
    } else if (isHandlerError(error)) {
      resultErr = new XRPCError(error.status, error.message, error.error)
    } else if (error instanceof Error) {
      resultErr = new InternalServerError(error.message)
    } else {
      resultErr = new InternalServerError('Unexpected internal server error')
    }
    resultErr.cause = error
    return resultErr
  }
}

export function isHandlerError(v: unknown): v is HandlerError {
  return handlerError.safeParse(v).success
}

export class InvalidRequestError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.InvalidRequest, errorMessage, customErrorName)
  }
}

export class AuthRequiredError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.AuthRequired, errorMessage, customErrorName)
  }
}

export class ForbiddenError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.Forbidden, errorMessage, customErrorName)
  }
}

export class InternalServerError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.InternalServerError, errorMessage, customErrorName)
  }
}

export class UpstreamFailureError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.UpstreamFailure, errorMessage, customErrorName)
  }
}

export class NotEnoughResourcesError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.NotEnoughResources, errorMessage, customErrorName)
  }
}

export class UpstreamTimeoutError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.UpstreamTimeout, errorMessage, customErrorName)
  }
}

export class MethodNotImplementedError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.MethodNotImplemented, errorMessage, customErrorName)
  }
}
