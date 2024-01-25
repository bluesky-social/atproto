import { Service } from './proto/courier_connect'
import {
  Code,
  ConnectError,
  PromiseClient,
  createPromiseClient,
  Interceptor,
} from '@connectrpc/connect'
import {
  createConnectTransport,
  ConnectTransportOptions,
} from '@connectrpc/connect-node'

export type CourierClient = PromiseClient<typeof Service>

export const createCourierClient = (
  opts: ConnectTransportOptions,
): CourierClient => {
  const transport = createConnectTransport(opts)
  return createPromiseClient(Service, transport)
}

export { Code }

export const isCourierError = (
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
