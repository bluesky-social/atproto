import {
  type Interceptor,
  type PromiseClient,
  createPromiseClient,
} from '@connectrpc/connect'
import {
  type ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { Service } from './proto/bsync_connect.js'

export type BsyncClient = PromiseClient<typeof Service>

export const createClient = (opts: ConnectTransportOptions): BsyncClient => {
  const transport = createConnectTransport(opts)
  return createPromiseClient(Service, transport)
}

export const authWithApiKey =
  (apiKey: string): Interceptor =>
  (next) =>
  (req) => {
    req.header.set('authorization', `Bearer ${apiKey}`)
    return next(req)
  }
