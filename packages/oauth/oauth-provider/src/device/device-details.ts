import { IncomingMessage } from 'node:http'
import { z } from 'zod'

export const deviceDetailsSchema = z.object({
  userAgent: z.string().nullable(),
  ipAddress: z.string(),
  port: z.number(),
})
export type DeviceDetails = z.infer<typeof deviceDetailsSchema>

export function extractDeviceDetails(
  req: IncomingMessage,
  trustProxy: boolean,
): DeviceDetails {
  const userAgent = req.headers['user-agent'] || null
  const ipAddress = extractIpAddress(req, trustProxy) || null
  const port = extractPort(req, trustProxy)

  if (!ipAddress || port == null) {
    throw new Error('Could not determine IP address')
  }

  return { userAgent, ipAddress, port }
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

export function extractPort(
  req: IncomingMessage,
  trustProxy: boolean,
): number | undefined {
  if (trustProxy) {
    const forwardedPort = req.headers['x-forwarded-port']
    if (typeof forwardedPort === 'string') {
      const port = Number(forwardedPort.trim())
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('Invalid forwarded port')
      }
      return port
    }
  }

  return req.socket.remotePort
}
