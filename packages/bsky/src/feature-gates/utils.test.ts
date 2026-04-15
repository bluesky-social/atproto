/// <reference types="jest" />
import { mergeUserContexts, normalizeUserContext } from './utils'

describe('normalizeUserContext', () => {
  it('defaults', () => {
    const ctx = normalizeUserContext({})
    expect(ctx.did).toBeUndefined()
    expect(ctx.deviceId).toMatch(/^anon-/)
    expect(ctx.sessionId).toMatch(/^anon-/)
  })

  it('with did', () => {
    const ctx = normalizeUserContext({
      did: 'did:example:123',
    })
    expect(ctx.did).toBe('did:example:123')
    expect(ctx.deviceId).toBe('did:example:123')
    expect(ctx.sessionId).toMatch(/^anon-/)
  })

  it('with did and deviceId', () => {
    const ctx = normalizeUserContext({
      did: 'did:example:123',
      deviceId: 'device-456',
    })
    expect(ctx.did).toBe('did:example:123')
    expect(ctx.deviceId).toBe('device-456')
    expect(ctx.sessionId).toMatch(/^anon-/)
  })

  it('with only deviceId and sessionId', () => {
    const ctx = normalizeUserContext({
      deviceId: 'device-456',
      sessionId: 'session-789',
    })
    expect(ctx.did).toBeUndefined()
    expect(ctx.deviceId).toBe('device-456')
    expect(ctx.sessionId).toBe('session-789')
  })
})

describe('mergeUserContexts', () => {
  it('anonymous base context, override with did', () => {
    const base = normalizeUserContext({})
    const merged = mergeUserContexts(base, { did: 'did:example:123' })
    expect(merged.did).toBe('did:example:123')
    expect(merged.deviceId).toBe('did:example:123')
    expect(merged.sessionId).toBe(base.sessionId)
  })

  it('base context with did, override with different did', () => {
    const base = normalizeUserContext({ did: 'did:example:123' })
    const merged = mergeUserContexts(base, { did: 'did:example:456' })
    expect(merged.did).toBe('did:example:456')
    expect(merged.deviceId).toBe('did:example:456')
    expect(merged.sessionId).toMatch(/^anon-/)
  })

  it('base context with did, override with same did', () => {
    const base = normalizeUserContext({ did: 'did:example:123' })
    const merged = mergeUserContexts(base, { did: 'did:example:123' })
    expect(merged.did).toBe('did:example:123')
    expect(merged.deviceId).toBe('did:example:123')
    expect(merged.sessionId).toBe(base.sessionId)
  })
})
