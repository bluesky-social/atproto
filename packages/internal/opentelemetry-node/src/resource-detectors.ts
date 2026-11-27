import { diag } from '@opentelemetry/api'
import { getStringListFromEnv } from '@opentelemetry/core'
import { containerDetector } from '@opentelemetry/resource-detector-container'
import {
  type ResourceDetector,
  hostDetector,
  osDetector,
  processDetector,
  resourceAttributesEnvDetector,
  serviceInstanceIdDetector,
  serviceNameEnvDetector,
} from '@opentelemetry/resources'

export type { ResourceDetector }

// @NOTE Ordered as "@opentelemetry/auto-instrumentations-node" does, so that
// the "env" detectors (OTEL_RESOURCE_ATTRIBUTES, then OTEL_SERVICE_NAME) come
// last and win.
const RESOURCE_DETECTORS = new Map<string, ResourceDetector[]>([
  ['container', [containerDetector]],
  ['host', [hostDetector]],
  ['os', [osDetector]],
  ['serviceinstance', [serviceInstanceIdDetector]],
  ['process', [processDetector]],
  // Replaces the deprecated "envDetector", in the same order
  ['env', [resourceAttributesEnvDetector, serviceNameEnvDetector]],
])

/**
 * Resource detectors selected by `OTEL_NODE_RESOURCE_DETECTORS`, defaulting
 * to all of them. These are `@opentelemetry/sdk-node`'s detectors plus the
 * "container" one.
 *
 * @note Unlike "@opentelemetry/auto-instrumentations-node"'s
 * `getResourceDetectors()`, the cloud provider detectors ("alibaba", "aws",
 * "azure", "gcp") are not available: by default, that one probes every cloud
 * provider's metadata endpoint at startup, logging a warning for each it
 * can't reach.
 */
export function getResourceDetectors(): ResourceDetector[] {
  const names = getStringListFromEnv('OTEL_NODE_RESOURCE_DETECTORS') ?? ['all']
  if (names.includes('all')) return [...RESOURCE_DETECTORS.values()].flat()
  if (names.includes('none')) return []

  return names.flatMap((name) => {
    const detectors = RESOURCE_DETECTORS.get(name)
    if (!detectors) {
      diag.warn(
        `Unsupported resource detector "${name}" specified in the environment variable OTEL_NODE_RESOURCE_DETECTORS`,
      )
    }
    return detectors ?? []
  })
}
