import {
  Client,
  Interceptor,
  createClient as createConnectClient,
} from '@connectrpc/connect'
import {
  ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { Service } from './proto/bsync_pb.js'

export type BsyncClient = Client<typeof Service>

export const createClient = (opts: ConnectTransportOptions): BsyncClient => {
  const transport = createConnectTransport(opts)
  return createConnectClient(Service, transport)
}

export const authWithApiKey =
  (apiKey: string): Interceptor =>
  (next) =>
  (req) => {
    req.header.set('authorization', `Bearer ${apiKey}`)
    return next(req)
  }
