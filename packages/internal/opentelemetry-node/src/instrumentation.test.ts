import { describeHttpServerInstrumentation } from '../tests/http-server-harness.js'
import { UNKNOWN_XRPC_ROUTE } from './instrumentation.js'

describeHttpServerInstrumentation({
  name: 'with xrpcMethods',
  xrpcMethods: ['com.example.knownMethod', 'COM.Example.otherMethod'],
  // Express' catchall middlewares clobber the route with "/"
  expressRoute: () => '/',
  expectedMetricRoutes: [
    // Non-XRPC requests keep whatever route express set
    '/',
    '/xrpc/com.example.knownMethod',
    '/xrpc/com.example.otherMethod',
    UNKNOWN_XRPC_ROUTE,
  ],
})
