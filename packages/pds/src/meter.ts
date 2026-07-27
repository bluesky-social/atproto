import { ValueType, metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('@atproto/pds')

export const accountCreatedCounter = meter.createCounter<{
  source: 'com.atproto.server.createAccount' | 'oauth'
  deactivated: boolean
}>('account.created', {
  description: 'Number of accounts created on this PDS',
  valueType: ValueType.INT,
})

export const sessionCreatedCounter = meter.createCounter<{
  source:
    | 'com.atproto.server.createAccount'
    | 'com.atproto.server.createSession'
}>('session.created', {
  description: 'Number of sessions created on this PDS',
  valueType: ValueType.INT,
})

export const oauthAuthorizationCounter = meter.createCounter<{
  clientTrusted: boolean
  clientFirstParty: boolean
  clientConfidential: boolean
}>('oauth.authorization', {
  description: 'Increased when an OAuth authorization is granted on this PDS',
  valueType: ValueType.INT,
})

export const oauthTokenIssuedCounter = meter.createCounter<{
  clientTrusted: boolean
  clientFirstParty: boolean
  clientConfidential: boolean
}>('oauth.token.issued', {
  description: 'Number of OAuth tokens issued on this PDS',
  valueType: ValueType.INT,
})
