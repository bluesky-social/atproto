import { describe, expect, it } from 'vitest'
import { buildXrpcRequestHeaders } from './headers.js'

describe(buildXrpcRequestHeaders, () => {
  it('returns empty headers when no options are set', async () => {
    const headers = await buildXrpcRequestHeaders({})
    expect([...headers.entries()]).toEqual([])
  })

  it('sets atproto-proxy header from service option', async () => {
    const headers = await buildXrpcRequestHeaders({
      service: 'did:plc:1234#atproto_labeler',
    })
    expect(headers.get('atproto-proxy')).toBe('did:plc:1234#atproto_labeler')
  })

  it('overrides atproto-proxy header if service option is set', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { 'atproto-proxy': 'did:plc:existing#service' },
      service: 'did:plc:new#service',
    })
    expect(headers.get('atproto-proxy')).toBe('did:plc:new#service')
  })

  it('leaves atproto-proxy header if service option is not set', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { 'atproto-proxy': 'did:plc:existing#service' },
    })
    expect(headers.has('atproto-proxy')).toBe(true)
  })

  it('strips atproto-proxy header if service option is null', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { 'atproto-proxy': 'did:plc:existing#service' },
      service: null,
    })
    expect(headers.has('atproto-proxy')).toBe(false)
  })

  it('sets atproto-accept-labelers from labelers option', async () => {
    const headers = await buildXrpcRequestHeaders({
      labelers: ['did:plc:labeler1', 'did:plc:labeler2'] as const,
    })
    expect(headers.get('atproto-accept-labelers')).toBe(
      'did:plc:labeler1, did:plc:labeler2',
    )
  })

  it('strips atproto-accept-labelers header if labelers option is null', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { 'atproto-accept-labelers': 'did:plc:existing' },
      labelers: null,
    })
    expect(headers.get('atproto-accept-labelers')).toBe(null)
  })

  it('leaves atproto-accept-labelers header if labelers option is not set', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { 'atproto-accept-labelers': 'did:plc:existing' },
    })
    expect(headers.get('atproto-accept-labelers')).toBe('did:plc:existing')
  })

  it('merges atproto-accept-labelers header if labelers option is an empty array', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { 'atproto-accept-labelers': 'did:plc:foo' },
      labelers: ['did:plc:bar'] as const,
    })
    expect(headers.get('atproto-accept-labelers')).toBe(
      'did:plc:bar, did:plc:foo',
    )
  })

  it('passes through base headers', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: { Authorization: 'Bearer token123' },
    })
    expect(headers.get('Authorization')).toBe('Bearer token123')
  })

  it('accepts Headers instance as base headers', async () => {
    const base = new Headers({ 'X-Custom': 'value' })
    const headers = await buildXrpcRequestHeaders({ headers: base })
    expect(headers.get('X-Custom')).toBe('value')
  })

  it('does not set the atproto-accept-labelers header if labelers option is an empty array', async () => {
    const headers = await buildXrpcRequestHeaders({ labelers: [] })
    expect(headers.has('atproto-accept-labelers')).toBe(false)
  })

  it('accepts a function returning the base headers', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: () => ({ 'X-Custom': 'value' }),
    })
    expect(headers.get('X-Custom')).toBe('value')
  })

  it('accepts an async function returning the base headers', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: async () => new Headers({ 'X-Custom': 'value' }),
    })
    expect(headers.get('X-Custom')).toBe('value')
  })

  it('applies the service option over headers returned by a function', async () => {
    const headers = await buildXrpcRequestHeaders({
      headers: () => ({ 'atproto-proxy': 'did:plc:existing#service' }),
      service: null,
    })
    expect(headers.has('atproto-proxy')).toBe(false)
  })
})
