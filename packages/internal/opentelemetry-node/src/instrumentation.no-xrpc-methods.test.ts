import { describeHttpServerInstrumentation } from '../tests/http-server-harness.js'
import { extractUrlXrpcMethodName } from './util.js'

const ROUTED = new Set(['com.example.knownMethod', 'com.example.otherMethod'])

describeHttpServerInstrumentation({
  name: 'without xrpcMethods',
  xrpcMethods: undefined,
  // Express registers one route per XRPC method; other URLs hit a catchall
  expressRoute: (url) => {
    const lxm = extractUrlXrpcMethodName(url)
    return lxm && ROUTED.has(lxm) ? `/xrpc/${lxm}` : '/'
  },
  // The route express recorded is left untouched (never "unknown")
  expectedMetricRoutes: [
    '/',
    '/xrpc/com.example.knownMethod',
    '/xrpc/com.example.otherMethod',
  ],
})
