import { Service } from './gen/bsky_connect'
import { PromiseClient, createPromiseClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'

export type DataPlaneClient = PromiseClient<typeof Service>
type HttpVersion = '1.1' | '2'

export const createDataPlaneClient = (
  baseUrl: string,
  httpVersion: HttpVersion = '2',
) => {
  const transport = createConnectTransport({
    baseUrl,
    httpVersion,
  })
  return createPromiseClient(Service, transport)
}
