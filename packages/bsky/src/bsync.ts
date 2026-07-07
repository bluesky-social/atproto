import {
  Code,
  ConnectError,
  type Interceptor,
  type PromiseClient,
  createPromiseClient,
} from '@connectrpc/connect'
import {
  type ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { tracingInterceptor } from './otel.js'
import { Service } from './proto/bsync_connect.js'

export type BsyncClient = PromiseClient<typeof Service>

export const createBsyncClient = (
  opts: ConnectTransportOptions,
): BsyncClient => {
  const transport = createConnectTransport({
    ...opts,
    interceptors: [
      ...(opts.interceptors ?? []),
      // 'vortex' matches the remote's self-reported service.name; bsync is
      // the interface it handles.
      tracingInterceptor({ peerService: 'vortex', peerInterface: 'bsync' }),
    ],
  })
  return createPromiseClient(Service, transport)
}

export { Code }

export const isBsyncError = (
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
