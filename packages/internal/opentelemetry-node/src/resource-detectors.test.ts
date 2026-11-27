import { diag } from '@opentelemetry/api'
import { containerDetector } from '@opentelemetry/resource-detector-container'
import {
  hostDetector,
  osDetector,
  processDetector,
  resourceAttributesEnvDetector,
  serviceInstanceIdDetector,
  serviceNameEnvDetector,
} from '@opentelemetry/resources'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { getResourceDetectors } from './resource-detectors.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe(getResourceDetectors, () => {
  const all = [
    containerDetector,
    hostDetector,
    osDetector,
    serviceInstanceIdDetector,
    processDetector,
    resourceAttributesEnvDetector,
    serviceNameEnvDetector,
  ]

  test('defaults to every local detector, without cloud provider probes', () => {
    vi.stubEnv('OTEL_NODE_RESOURCE_DETECTORS', undefined)
    expect(getResourceDetectors()).toEqual(all)
  })

  test('"all" selects every local detector', () => {
    vi.stubEnv('OTEL_NODE_RESOURCE_DETECTORS', 'host,all')
    expect(getResourceDetectors()).toEqual(all)
  })

  test('"none" disables detection', () => {
    vi.stubEnv('OTEL_NODE_RESOURCE_DETECTORS', 'env,none')
    expect(getResourceDetectors()).toEqual([])
  })

  test('selects the listed detectors, in order', () => {
    vi.stubEnv('OTEL_NODE_RESOURCE_DETECTORS', 'env, container')
    expect(getResourceDetectors()).toEqual([
      resourceAttributesEnvDetector,
      serviceNameEnvDetector,
      containerDetector,
    ])
  })

  test('skips cloud provider detectors with a warning', () => {
    using warn = vi.spyOn(diag, 'warn').mockImplementation(() => {})
    vi.stubEnv('OTEL_NODE_RESOURCE_DETECTORS', 'gcp,aws,env')
    expect(getResourceDetectors()).toEqual([
      resourceAttributesEnvDetector,
      serviceNameEnvDetector,
    ])
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
