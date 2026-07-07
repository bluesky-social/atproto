import { z } from 'zod'
import { type SessionId, sessionIdSchema } from './session-id.js'

export const deviceDataSchema = z.object({
  sessionId: sessionIdSchema,
  lastSeenAt: z.date(),
  userAgent: z.string().nullable(),
  ipAddress: z.string(),
})

export type { SessionId }
export type DeviceData = z.infer<typeof deviceDataSchema>
