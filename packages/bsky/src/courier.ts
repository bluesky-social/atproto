import {
  Client,
  Code,
  ConnectError,
  Interceptor,
  createClient,
} from '@connectrpc/connect'
import {
  ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { Service } from './proto/courier_pb.js'

export type CourierClient = Client<typeof Service>

export const createCourierClient = (
  opts: ConnectTransportOptions,
): CourierClient => {
  const transport = createConnectTransport(opts)
  return createClient(Service, transport)
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
