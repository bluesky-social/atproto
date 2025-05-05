import { z } from 'zod'
import { sessionIdSchema } from './session-id.js'

export const deviceDataSchema = z.object({
  sessionId: sessionIdSchema,
  lastSeenAt: z.date(),
  userAgent: z.string().nullable(),
  ipAddress: z.string(),
})

export type DeviceData = z.infer<typeof deviceDataSchema>
