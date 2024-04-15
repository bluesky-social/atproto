import { z } from 'zod'

import { SESSION_ID_BYTES_LENGTH, SESSION_ID_PREFIX } from '../constants.js'
import { randomHexId } from '../util/crypto.js'
import { devideDetailsSchema } from './device-details.js'

export const sessionIdSchema = z
  .string()
  .length(
    SESSION_ID_PREFIX.length + SESSION_ID_BYTES_LENGTH * 2, // hex encoding
  )
  .refine(
    (v): v is `${typeof SESSION_ID_PREFIX}${string}` =>
      v.startsWith(SESSION_ID_PREFIX),
    {
      message: `Invalid session ID format`,
    },
  )
export type SessionId = z.infer<typeof sessionIdSchema>
export const generateSessionId = async (): Promise<SessionId> => {
  return `${SESSION_ID_PREFIX}${await randomHexId(SESSION_ID_BYTES_LENGTH)}`
}

export const deviceDataSchema = devideDetailsSchema.extend({
  sessionId: sessionIdSchema,
  lastSeenAt: z.date(),
})

export type DeviceData = z.infer<typeof deviceDataSchema>
