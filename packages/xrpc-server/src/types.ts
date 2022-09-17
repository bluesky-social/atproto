import express from 'express'
import zod from 'zod'
import { ResponseType, ResponseTypeStrings } from '@adxp/xrpc'

export type Params = Record<string, string | number | boolean>

export const handlerInput = zod.object({
  encoding: zod.string(),
  body: zod.any(),
})
export type HandlerInput = zod.infer<typeof handlerInput>

export const handlerOutput = zod.object({
  encoding: zod.string(),
  body: zod.any(),
})
export type HandlerOutput = zod.infer<typeof handlerOutput>

export type XRPCHandler = (
  params: Params,
  input: HandlerInput | undefined,
  req: express.Request,
  res: express.Response,
) => Promise<HandlerOutput> | HandlerOutput | undefined

export class XRPCError extends Error {
  constructor(public type: ResponseType, message?: string) {
    super(message)
  }

  get typeStr() {
    return ResponseTypeStrings[this.type]
  }
}

export class InvalidRequestError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.InvalidRequest, message)
  }
}

export class AuthRequiredError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.AuthRequired, message)
  }
}

export class ForbiddenError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.Forbidden, message)
  }
}

export class InternalServerError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.InternalServerError, message)
  }
}

export class UpstreamFailureError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.UpstreamFailure, message)
  }
}

export class NotEnoughResoucesError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.NotEnoughResouces, message)
  }
}

export class UpstreamTimeoutError extends XRPCError {
  constructor(message?: string) {
    super(ResponseType.UpstreamTimeout, message)
  }
}
