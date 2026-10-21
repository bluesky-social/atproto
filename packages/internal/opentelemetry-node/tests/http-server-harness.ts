import type * as Http from 'node:http'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { SpanKind, context, trace } from '@opentelemetry/api'
import { RPCType, getRPCMetadata } from '@opentelemetry/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { metrics, node, tracing } from '@opentelemetry/sdk-node'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ATTR_HTTP_ROUTE, ATTR_XRPC_METHOD } from '../src/conventions.js'
import {
  type DefaultAtprotoInstrumentationsOptions,
  getDefaultAtprotoInstrumentations,
} from '../src/instrumentation.js'

class TestMetricReader extends metrics.MetricReader {
  protected async onForceFlush() {}
  protected async onShutdown() {}
}

/**
 * Runs the http server instrumentation suite against a real http server.
 *
 * @note The instrumentation patches process-wide state ("node:http", OTEL
 * globals), so each call must live in its own test file (vitest isolates
 * files from one another).
 */
export function describeHttpServerInstrumentation(options: {
  name: string
  xrpcMethods: DefaultAtprotoInstrumentationsOptions['xrpcMethods']
  /** The route the (mimicked) express instrumentation leaves on the request */
  expressRoute: (url: string) => string
  expectedMetricRoutes: string[]
}) {
  const { name, xrpcMethods, expressRoute, expectedMetricRoutes } = options

  describe(`http server instrumentation ${name}`, () => {
    const reader = new TestMetricReader()
    const spanExporter = new tracing.InMemorySpanExporter()
    const tracerProvider = new node.NodeTracerProvider({
      spanProcessors: [new tracing.SimpleSpanProcessor(spanExporter)],
    })
    let instrumentations: Instrumentation[]
    let server: Http.Server
    let origin: string

    beforeAll(async () => {
      // Records both the old "http.server.duration" and the stable
      // "http.server.request.duration" metrics
      process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http/dup'

      // Also registers the context manager that carries rpcMetadata
      tracerProvider.register()

      instrumentations = getDefaultAtprotoInstrumentations({ xrpcMethods })
      const meterProvider = new metrics.MeterProvider({ readers: [reader] })
      for (const instrumentation of instrumentations) {
        instrumentation.setMeterProvider(meterProvider)
        instrumentation.enable()
      }

      // The instrumentation patches "node:http" as it gets required, so it must
      // be loaded after enabling it.
      const http: typeof Http = createRequire(import.meta.url)('node:http')
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
      for (const instrumentation of instrumentations) instrumentation.disable()
      await tracerProvider.shutdown()
      trace.disable()
      context.disable()
      delete process.env.OTEL_SEMCONV_STABILITY_OPT_IN
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
      expect(routesOf('http.server.duration')).toEqual(expectedMetricRoutes)
    })
  })
}
