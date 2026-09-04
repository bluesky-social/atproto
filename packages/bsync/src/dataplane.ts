import {
  type Interceptor,
  type PromiseClient,
  createPromiseClient,
} from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { Service } from './proto/dataplane_connect.js'

export type DataplaneClient = PromiseClient<typeof Service>

export function createDataplaneClient(opts: {
  baseUrl: string
  authToken: string
  rejectUnauthorized: boolean
}): DataplaneClient {
  const transport = createGrpcTransport({
    baseUrl: opts.baseUrl,
    httpVersion: '2',
    interceptors: [authWithToken(opts.authToken)],
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
