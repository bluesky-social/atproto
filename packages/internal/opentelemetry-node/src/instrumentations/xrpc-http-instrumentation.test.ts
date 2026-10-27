import type * as Http from 'node:http'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { SpanKind, context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { RPCType, getRPCMetadata } from '@opentelemetry/core'
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics'
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ATTR_HTTP_ROUTE, ATTR_XRPC_METHOD } from '../conventions.js'
import {
  UNKNOWN_XRPC_ROUTE,
  XrpcHttpInstrumentation,
  type XrpcHttpInstrumentationConfig,
  extractUrlXrpcMethodName,
} from './xrpc-http-instrumentation.js'

describe(extractUrlXrpcMethodName, () => {
  test.each([
    {
      note: 'simple method',
      url: '/xrpc/com.example.foo',
      lxm: 'com.example.foo',
    },
    {
      note: 'with query string',
      url: '/xrpc/com.example.foo?limit=10&cursor=abc',
      lxm: 'com.example.foo',
    },
    {
      note: 'trailing slash',
      url: '/xrpc/com.example.foo/',
      lxm: 'com.example.foo',
    },
    {
      note: 'trailing slash with query',
      url: '/xrpc/com.example.foo/?a=1',
      lxm: 'com.example.foo',
    },
    {
      note: 'authority lowercased, name segment preserved',
      url: '/xrpc/Com.Example.fooBar',
      lxm: 'com.example.fooBar',
    },
    {
      note: 'shortest valid nsid',
      url: '/xrpc/a.b.c',
      lxm: 'a.b.c',
    },
  ])('$note', ({ url, lxm }) => {
    expect(extractUrlXrpcMethodName(url)).toBe(lxm)
  })

  test.each([
    { note: 'non-string input', url: undefined },
    { note: 'null input', url: null },
    { note: 'number input', url: 42 },
    { note: 'not an xrpc path', url: '/foo/bar' },
    { note: 'too short', url: '/xrpc/' },
    { note: 'health check (underscore)', url: '/xrpc/_health' },
    { note: 'leading dot', url: '/xrpc/.foo' },
    { note: 'double slash', url: '/xrpc//foo' },
    { note: 'immediate query', url: '/xrpc/?foo=bar' },
    { note: 'extra path segment', url: '/xrpc/com.example.foo/bar' },
    { note: 'no dot in method', url: '/xrpc/foobar' },
    { note: 'trailing dot', url: '/xrpc/com.example.' },
  ])('$note → undefined', ({ url }) => {
    expect(extractUrlXrpcMethodName(url)).toBeUndefined()
  })
})

class TestMetricReader extends MetricReader {
  protected async onForceFlush() {}
  protected async onShutdown() {}
}

/**
 * Runs the http server instrumentation suite against a real http server.
 *
 * @note The instrumentation patches process-wide state ("node:http", OTEL
 * globals). Each suite restores it in its afterAll, so suites in the same file
 * must run sequentially (vitest's default).
 */
function describeHttpServerInstrumentation(options: {
  name: string
  xrpcMethods: XrpcHttpInstrumentationConfig['xrpcMethods']
  /** The route the (mimicked) express instrumentation leaves on the request */
  expressRoute: (url: string) => string
  expectedMetricRoutes: string[]
}) {
  const { name, xrpcMethods, expressRoute, expectedMetricRoutes } = options

  describe(`http server instrumentation ${name}`, () => {
    const reader = new TestMetricReader()
    const spanExporter = new InMemorySpanExporter()
    const tracerProvider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter: spanExporter })],
    })
    let unpatchHttp: () => void
    let server: Http.Server
    let origin: string

    beforeAll(async () => {
      trace.setGlobalTracerProvider(tracerProvider)
      // Carries rpcMetadata across the request lifecycle
      context.setGlobalContextManager(
        new AsyncLocalStorageContextManager().enable(),
      )

      const instrumentation = new XrpcHttpInstrumentation({
        xrpcMethods,
        enabled: false,
      })
      instrumentation.setMeterProvider(new MeterProvider({ readers: [reader] }))

      // @NOTE Patching "node:http" directly rather than through enable(): the
      // require hook it registers is shared process-wide and caches "node:http"
      // once patched, so it wouldn't patch it again for the next suite.
      const http: typeof Http = createRequire(import.meta.url)('node:http')
      unpatchHttp = patchHttp(instrumentation, http)
      server = http.createServer((req, res) => {
        // Mimic express, which gives requests a "path" getter...
        Object.defineProperty(req, 'path', {
          get: () => req.url?.split('?')[0],
        })
        // ...and its instrumentation, which sets the route to whatever layer it
        // entered last.
        const rpcMetadata = getRPCMetadata(context.active())
        if (rpcMetadata?.type === RPCType.HTTP) {
          rpcMetadata.route = expressRoute(req.url ?? '/')
        }
        res.end('ok')
      })
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const { port } = server.address() as AddressInfo
      origin = `http://localhost:${port}`
    })

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve))
      unpatchHttp()
      await tracerProvider.shutdown()
      trace.disable()
      context.disable()
    })

    beforeAll(async () => {
      for (const path of [
        '/xrpc/com.example.knownMethod',
        '/xrpc/com.example.knownMethod?foo=bar',
        '/xrpc/Com.Example.otherMethod/',
        '/xrpc/com.example.madeUp1',
        '/xrpc/com.example.madeUp2',
        '/some/raw/path',
      ]) {
        await fetch(`${origin}${path}`)
      }
      // Let the "close" listeners run
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    test('spans are named after the requested NSID', () => {
      const spans = spanExporter
        .getFinishedSpans()
        .filter((s) => s.kind === SpanKind.SERVER)
        .map((s) => [s.name, s.attributes[ATTR_XRPC_METHOD]])
        .sort()
      expect(spans).toEqual([
        // Only XRPC spans get renamed
        ['GET /', undefined],
        ['GET /xrpc/com.example.knownMethod', 'com.example.knownMethod'],
        ['GET /xrpc/com.example.knownMethod', 'com.example.knownMethod'],
        ['GET /xrpc/com.example.madeUp1', 'com.example.madeUp1'],
        ['GET /xrpc/com.example.madeUp2', 'com.example.madeUp2'],
        ['GET /xrpc/com.example.otherMethod', 'com.example.otherMethod'],
      ])
    })

    test('metric routes', async () => {
      const { resourceMetrics } = await reader.collect()
      const routesOf = (name: string) =>
        resourceMetrics.scopeMetrics
          .flatMap((s) => s.metrics)
          .find((m) => m.descriptor.name === name)
          ?.dataPoints.map((dp) => dp.attributes[ATTR_HTTP_ROUTE])
          .sort()

      expect(routesOf('http.server.request.duration')).toEqual(
        expectedMetricRoutes,
      )
    })
  })
}

function patchHttp(
  instrumentation: XrpcHttpInstrumentation,
  http: typeof Http,
) {
  const { patch, unpatch } =
    instrumentation.getModuleDefinitions().find((m) => m.name === 'http') ?? {}
  if (!patch || !unpatch) throw new Error('No "http" module definition')

  patch(http)
  return () => unpatch(http)
}

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
