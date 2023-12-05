import { Service } from './gen/bsky_connect'
import { createPromiseClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'

export const createDataPlaneClient = (baseUrl: string) => {
  const transport = createConnectTransport({
    baseUrl,
    httpVersion: '2',
  })
  return createPromiseClient(Service, transport)
}
