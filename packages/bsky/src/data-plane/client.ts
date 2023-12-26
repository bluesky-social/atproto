import { Service } from './gen/bsky_connect'
import { PromiseClient, createPromiseClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-node'

export type DataPlaneClient = PromiseClient<typeof Service>
type HttpVersion = '1.1' | '2'

export const createDataPlaneClient = (
  baseUrl: string,
  opts: { httpVersion?: HttpVersion; rejectUnauthorized?: boolean },
) => {
  const { httpVersion = '2', rejectUnauthorized = false } = opts
  const transport = createConnectTransport({
    baseUrl,
    httpVersion,
    nodeOptions: { rejectUnauthorized },
  })
  return createPromiseClient(Service, transport)
}
