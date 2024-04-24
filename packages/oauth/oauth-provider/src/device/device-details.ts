import { IncomingMessage } from 'node:http'

import { z } from 'zod'

export const deviceDetailsSchema = z.object({
  userAgent: z.string().nullable(),
  ipAddress: z.string(),
})
export type DeviceDetails = z.infer<typeof deviceDetailsSchema>

export function extractDeviceDetails(
  req: IncomingMessage,
  trustProxy: boolean,
): DeviceDetails {
  const userAgent = req.headers['user-agent'] || null
  const ipAddress = extractIpAddress(req, trustProxy) || null

  if (!ipAddress) {
    throw new Error('Could not determine IP address')
  }

  return { userAgent, ipAddress }
}

export function extractIpAddress(
  req: IncomingMessage,
  trustProxy: boolean,
): string | undefined {
  // Express app compatibility
  if ('ip' in req && typeof req.ip === 'string') {
    return req.ip
  }

  if (trustProxy) {
    const forwardedFor = req.headers['x-forwarded-for']
    if (typeof forwardedFor === 'string') {
      const firstForward = forwardedFor.split(',')[0]!.trim()
      if (firstForward) return firstForward
    }
  }

  return req.socket.remoteAddress
}
