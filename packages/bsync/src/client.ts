import { PromiseClient, createPromiseClient } from '@connectrpc/connect'
import {
  ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { Service } from './gen/bsky_sync_connect'

export type BsyncClient = PromiseClient<typeof Service>

export const createClient = (opts: ConnectTransportOptions): BsyncClient => {
  const transport = createConnectTransport(opts)
  return createPromiseClient(Service, transport)
}

export const authWithApiKey = (apiKey: string) => (next) => async (req) => {
  req.header.set('authorization', `Bearer ${apiKey}`)
  return next(req)
}
