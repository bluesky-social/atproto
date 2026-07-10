import { ValueType, metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('@atproto/pds')

export const accountCreatedCounter = meter.createCounter<{
  source: 'xrpc' | 'oauth'
  deactivated: boolean
}>('account.created', {
  description: 'Number of accounts created on this PDS',
  valueType: ValueType.INT,
})

export const sessionCreatedCounter = meter.createCounter<{
  source: 'xrpc'
}>('session.created', {
  description: 'Number of sessions created on this PDS',
  valueType: ValueType.INT,
})

export const sessionRefreshedCounter = meter.createCounter<{
  source: 'xrpc'
}>('session.refreshed', {
  description: 'Number of sessions refreshed on this PDS',
  valueType: ValueType.INT,
})

export const oauthClientAuthorizedCounter = meter.createCounter<{
  clientId: string
}>('oauth.client.authorized', {
  description: 'Number of OAuth clients authorized on this PDS',
  valueType: ValueType.INT,
})

export const oauthTokenRefreshedCounter = meter.createCounter<{
  clientId: string
}>('oauth.token.refreshed', {
  description: 'Number of OAuth tokens refreshed on this PDS',
  valueType: ValueType.INT,
})
