import express from 'express'
import zod from 'zod'
import { ResponseType, ResponseTypeStrings } from '@atproto/xrpc'

export type Params = Record<string, string | number | boolean>

export const handlerInput = zod.object({
  encoding: zod.string(),
  body: zod.any(),
})
export type HandlerInput = zod.infer<typeof handlerInput>

export const handlerSuccess = zod.object({
  encoding: zod.string(),
  body: zod.any(),
})
export type HandlerSuccess = zod.infer<typeof handlerSuccess>

export const handlerError = zod.object({
  status: zod.number(),
  error: zod.string().optional(),
  message: zod.string().optional(),
})
export type HandlerError = zod.infer<typeof handlerError>

export type HandlerOutput = HandlerSuccess | HandlerError

export type XRPCHandler = (
  params: Params,
  input: HandlerInput | undefined,
  req: express.Request,
  res: express.Response,
) => Promise<HandlerOutput> | HandlerOutput | undefined

export class XRPCError extends Error {
  constructor(
    public type: ResponseType,
    public errorMessage?: string,
    public customErrorName?: string,
  ) {
    super(errorMessage)
  }

  get typeStr() {
    return ResponseTypeStrings[this.type]
  }
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

export class NotEnoughResoucesError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.NotEnoughResouces, errorMessage, customErrorName)
  }
}

export class UpstreamTimeoutError extends XRPCError {
  constructor(errorMessage?: string, customErrorName?: string) {
    super(ResponseType.UpstreamTimeout, errorMessage, customErrorName)
  }
}
