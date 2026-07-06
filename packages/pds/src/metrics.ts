import { ValueType, metrics } from '@opentelemetry/api'

export const accountCreated = metrics.getMeter('@atproto/pds').createCounter<{
  deactivated: boolean
  source: 'xrpc' | 'oauth'
}>('pds.account.created', {
  description: 'Number of accounts created on this PDS',
  valueType: ValueType.INT,
})
