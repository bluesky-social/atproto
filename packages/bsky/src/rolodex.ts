import {
  Code,
  ConnectError,
  Interceptor,
  PromiseClient,
  createPromiseClient,
} from '@connectrpc/connect'
import {
  ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { RolodexService } from './proto/rolodex_connect'

// Rolodex is the service that does contact imports following https://docs.bsky.app/blog/contact-import-rfc.
export type RolodexClient = PromiseClient<typeof RolodexService>

export const createRolodexClient = (
  opts: ConnectTransportOptions,
): RolodexClient => {
  const transport = createConnectTransport(opts)
  return createPromiseClient(RolodexService, transport)
}

export { Code }

export const isRolodexError = (
  err: unknown,
  code?: Code,
): err is ConnectError => {
  if (err instanceof ConnectError) {
    return !code || err.code === code
  }
  return false
}

export const authWithApiKey =
  (apiKey: string): Interceptor =>
  (next) =>
  (req) => {
    req.header.set('authorization', `Bearer ${apiKey}`)
    return next(req)
  }
