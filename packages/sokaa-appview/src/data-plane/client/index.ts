import { PromiseClient, createPromiseClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'
import { Service } from '../../proto/sokaa_connect'

export type DataPlaneClient = PromiseClient<typeof Service>

export const createDataPlaneClient = (baseUrl: string): DataPlaneClient => {
  const transport = createConnectTransport({
    baseUrl,
    httpVersion: '1.1',
  })
  return createPromiseClient(Service, transport)
}
