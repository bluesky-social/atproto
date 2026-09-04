import {
  type Interceptor,
  type PromiseClient,
  createPromiseClient,
} from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { Service } from './proto/dataplane_connect.js'
import { createRpcClientInterceptor } from './telemetry/rpc.js'

export type DataplaneClient = PromiseClient<typeof Service>

export function createDataplaneClient(opts: {
  baseUrl: string
  authToken: string
  rejectUnauthorized: boolean
}): DataplaneClient {
  const endpoint = new URL(opts.baseUrl)
  const port = Number(
    endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
  )
  const transport = createGrpcTransport({
    baseUrl: opts.baseUrl,
    httpVersion: '2',
    interceptors: [
      createRpcClientInterceptor(() => ({
        'server.address': endpoint.hostname,
        'server.port': port,
      })),
      authWithToken(opts.authToken),
    ],
    nodeOptions: {
      rejectUnauthorized: opts.rejectUnauthorized,
    },
  })
  return createPromiseClient(Service, transport)
}

const authWithToken =
  (token: string): Interceptor =>
  (next) =>
  (req) => {
    req.header.set('authorization', `Bearer ${token}`)
    return next(req)
  }
