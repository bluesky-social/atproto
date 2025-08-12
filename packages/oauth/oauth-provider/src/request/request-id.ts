import { z } from 'zod'
import { REQUEST_ID_BYTES_LENGTH, REQUEST_ID_PREFIX } from '../constants.js'
import { randomHexId } from '../lib/util/crypto.js'

export const REQUEST_ID_LENGTH =
  REQUEST_ID_PREFIX.length + REQUEST_ID_BYTES_LENGTH * 2 // hex encoding

export const requestIdSchema = z
  .string()
  .length(REQUEST_ID_LENGTH)
  .transform((input, ctx) => {
    if (!input.startsWith(REQUEST_ID_PREFIX)) {
      ctx.addIssue({
        code: 'custom',
        message: `Request ID must start with "${REQUEST_ID_PREFIX}"`,
      })
    }
    return input as `${typeof REQUEST_ID_PREFIX}${string}`
  })

export type RequestId = z.infer<typeof requestIdSchema>
export const generateRequestId = async (): Promise<RequestId> => {
  return `${REQUEST_ID_PREFIX}${await randomHexId(REQUEST_ID_BYTES_LENGTH)}`
}
