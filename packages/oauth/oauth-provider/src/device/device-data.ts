import { z } from 'zod'
import { deviceDetailsSchema } from './device-details.js'
import { sessionIdSchema } from './session-id.js'

export const deviceDataSchema = deviceDetailsSchema
  // @NOTE we won't be rotating the session id if the port number changed but
  // the ip address didn't. This is because the remote port can change from
  // request to request as the user agent opens new connections to the server.
  // Because of this, we don't need the DeviceStore to return the port, which is
  // why it's omitted here.
  .omit({ port: true })
  .extend({
    sessionId: sessionIdSchema,
    lastSeenAt: z.date(),
  })

export type DeviceData = z.infer<typeof deviceDataSchema>
