import { z } from 'zod'

export type QueryParams = Record<string, any>
export type Headers = Record<string, string>

export interface CallOptions {
  encoding?: string
  headers?: Headers
}

export const methodSchemaBody = z.object({
  encoding: z.union([z.string(), z.string().array()]),
  schema: z.any().optional(),
})
export type MethodSchemaBody = z.infer<typeof methodSchemaBody>

export const methodSchemaParam = z.object({
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  description: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
})
export type MethodSchemaParam = z.infer<typeof methodSchemaParam>

export const methodSchema = z.object({
  xrpc: z.literal(1),
  id: z.string(),
  type: z.enum(['query', 'procedure']),
  description: z.string().optional(),
  parameters: z.record(methodSchemaParam).optional(),
  input: methodSchemaBody.optional(),
  output: methodSchemaBody.optional(),
})
export type MethodSchema = z.infer<typeof methodSchema>

export function isValidMethodSchema(v: unknown): v is MethodSchema {
  return methodSchema.safeParse(v).success
}

export const errorResponseBody = z.object({
  message: z.string().optional(),
})
export type ErrorResponseBody = z.infer<typeof errorResponseBody>

export enum ResponseType {
  Unknown = 1,
  InvalidResponse = 2,
  Success = 200,
  InvalidRequest = 400,
  AuthRequired = 401,
  Forbidden = 403,
  XRPCNotSupported = 404,
  PayloadTooLarge = 413,
  RateLimitExceeded = 429,
  InternalServerError = 500,
  MethodNotImplemented = 501,
  UpstreamFailure = 502,
  NotEnoughResouces = 503,
  UpstreamTimeout = 504,
}

export const ResponseTypeStrings = {
  [ResponseType.InvalidResponse]: 'Invalid Response',
  [ResponseType.Success]: 'Success',
  [ResponseType.InvalidRequest]: 'Invalid Request',
  [ResponseType.AuthRequired]: 'Authentication Required',
  [ResponseType.Forbidden]: 'Forbidden',
  [ResponseType.XRPCNotSupported]: 'XRPC Not Supported',
  [ResponseType.PayloadTooLarge]: 'Payload Too Large',
  [ResponseType.RateLimitExceeded]: 'Rate Limit Exceeded',
  [ResponseType.InternalServerError]: 'Internal Server Error',
  [ResponseType.MethodNotImplemented]: 'Method Not Implemented',
  [ResponseType.UpstreamFailure]: 'Upstream Failure',
  [ResponseType.NotEnoughResouces]: 'Not Enough Resouces',
  [ResponseType.UpstreamTimeout]: 'Upstream Timeout',
}

export class XRPCResponse {
  success = true
  error = false

  constructor(public data: any, public headers: Headers) {}
}

export class XRPCError extends Error {
  success = false
  error = true

  constructor(public code: ResponseType, message?: string) {
    super(
      message
        ? `${ResponseTypeStrings[code]}: ${message}`
        : ResponseTypeStrings[code],
    )
  }
}
