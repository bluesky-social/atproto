import type * as Http from 'node:http'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { context, trace } from '@opentelemetry/api'
import { RPCType, getRPCMetadata } from '@opentelemetry/core'
import type { Instrumentation } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { metrics, node } from '@opentelemetry/sdk-node'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ATTR_HTTP_ROUTE } from './conventions.js'
import {
  UNKNOWN_XRPC_ROUTE,
  getDefaultAtprotoInstrumentations,
} from './instrumentation.js'

class TestMetricReader extends metrics.MetricReader {
  protected async onForceFlush() {}
  protected async onShutdown() {}
}

describe('http server metric route', () => {
  const reader = new TestMetricReader()
  const tracerProvider = new node.NodeTracerProvider()
  let instrumentations: Instrumentation[]
  let server: Http.Server
  let origin: string

  beforeAll(async () => {
    // Records both the old "http.server.duration" and the stable
    // "http.server.request.duration" metrics
    process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http/dup'

    // Registers the context manager that carries rpcMetadata
    tracerProvider.register()

    instrumentations = getDefaultAtprotoInstrumentations({
      xrpcMethods: ['com.example.knownMethod', 'COM.Example.otherMethod'],
    })
    const meterProvider = new metrics.MeterProvider({ readers: [reader] })
    for (const instrumentation of instrumentations) {
      instrumentation.setMeterProvider(meterProvider)
      instrumentation.enable()
    }

    // The instrumentation patches "node:http" as it gets required, so it must
    // be loaded after enabling it.
    const http: typeof Http = createRequire(import.meta.url)('node:http')
    server = http.createServer((_req, res) => {
      // Mimic the express instrumentation, which clobbers the route with
      // whatever layer it entered last ("/" for catchall middlewares).
      const rpcMetadata = getRPCMetadata(context.active())
      if (rpcMetadata?.type === RPCType.HTTP) rpcMetadata.route = '/'
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

  test('known methods get their own route, other NSIDs share one', async () => {
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

    const { resourceMetrics } = await reader.collect()
    const routesOf = (name: string) =>
      resourceMetrics.scopeMetrics
        .flatMap((s) => s.metrics)
        .find((m) => m.descriptor.name === name)
        ?.dataPoints.map((dp) => dp.attributes[ATTR_HTTP_ROUTE])
        .sort()

    const expected = [
      // Non-XRPC requests keep whatever route express set
      '/',
      '/xrpc/com.example.knownMethod',
      '/xrpc/com.example.otherMethod',
      UNKNOWN_XRPC_ROUTE,
    ]
    expect(routesOf('http.server.request.duration')).toEqual(expected)
    expect(routesOf('http.server.duration')).toEqual(expected)
  })
})

describe('without xrpcMethods', () => {
  test('the metric route is left to the express instrumentation', () => {
    const instrumentations = getDefaultAtprotoInstrumentations()
    try {
      const http = instrumentations.find(
        (i) => i instanceof HttpInstrumentation,
      )!
      expect(http.getConfig().responseHook).toBeUndefined()
    } finally {
      for (const instrumentation of instrumentations) instrumentation.disable()
    }
  })
})
