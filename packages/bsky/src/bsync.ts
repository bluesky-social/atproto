import {
  Code,
  ConnectError,
  type Interceptor,
  type PromiseClient,
  createPromiseClient,
} from '@connectrpc/connect'
import {
  type ConnectTransportOptions,
  createConnectTransport,
} from '@connectrpc/connect-node'
import { Service } from './proto/bsync_connect.js'
import { Method, type PutOperationRequest } from './proto/bsync_pb.js'
import { createRpcClientInterceptor } from './telemetry/rpc.js'

export type BsyncClient = PromiseClient<typeof Service>

export const createBsyncClient = (
  opts: ConnectTransportOptions,
): BsyncClient => {
  const transport = createConnectTransport({
    ...opts,
    interceptors: [
      // @NOTE These attribute keys must match the ones bsync sets on its own
      // handler metrics (see `withRpcServerTelemetry` in @atproto/bsync), so
      // that both sides of a call can be plotted on the same dimensions.
      createRpcClientInterceptor((req) => {
        if (req.method.name !== Service.methods.putOperation.name) return {}
        const { namespace, method } = req.message as PutOperationRequest
        return {
          'bsync.namespace': namespace,
          'bsync.operation': Method[method]?.toLowerCase() ?? 'unknown',
        }
      }),
      ...(opts.interceptors ?? []),
    ],
  })
  return createPromiseClient(Service, transport)
}

export { Code }

export const isBsyncError = (
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
