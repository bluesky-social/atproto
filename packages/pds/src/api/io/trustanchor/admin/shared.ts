import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'

/**
 * Validate admin authentication via X-API-Key header or Basic Auth
 */
export function validateAdminAuth(req: any, ctx: AppContext): void {
  const adminPassword = process.env.PDS_ADMIN_PASSWORD

  if (!adminPassword) {
    throw new AuthRequiredError('Admin authentication not configured')
  }

  // Check X-API-Key header
  const apiKey = req.headers['x-api-key']
  if (apiKey === adminPassword) {
    return
  }

  // Check Basic Auth
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Basic ')) {
    const credentials = Buffer.from(
      authHeader.slice('Basic '.length),
      'base64',
    ).toString('utf-8')
    const [username, password] = credentials.split(':')

    if (username === 'admin' && password === adminPassword) {
      return
    }
  }

  throw new AuthRequiredError('Invalid admin credentials')
}
