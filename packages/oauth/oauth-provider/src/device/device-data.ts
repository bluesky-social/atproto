import { z } from 'zod'
import { deviceDetailsSchema } from './device-details.js'
import { sessionIdSchema } from './session-id.js'

export const deviceDataSchema = deviceDetailsSchema.extend({
  sessionId: sessionIdSchema,
  lastSeenAt: z.date(),
})

export type DeviceData = z.infer<typeof deviceDataSchema>
