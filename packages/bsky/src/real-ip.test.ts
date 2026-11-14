import type { UnaryRequest, UnaryResponse } from '@connectrpc/connect'
import type express from 'express'
import { describe, expect, it } from 'vitest'
import {
  type RealIpState,
  markRequestAuthenticated,
  realIpFromHeaders,
  realIpInterceptor,
  realIpMiddleware,
  realIpStore,
} from './real-ip.js'

describe('realIpFromHeaders', () => {
  it('accepts a valid ipv4 address', () => {
    expect(realIpFromHeaders({ 'x-real-ip': '203.0.113.7' })).toBe(
      '203.0.113.7',
    )
  })

  it('accepts a valid ipv6 address', () => {
    expect(realIpFromHeaders({ 'x-real-ip': '2001:db8::1' })).toBe(
      '2001:db8::1',
    )
  })

  it('trims surrounding whitespace', () => {
    expect(realIpFromHeaders({ 'x-real-ip': '  203.0.113.7\t' })).toBe(
      '203.0.113.7',
    )
  })

  it('omits a missing value', () => {
    expect(realIpFromHeaders({})).toBeUndefined()
  })

  it('omits an empty value', () => {
    expect(realIpFromHeaders({ 'x-real-ip': '' })).toBeUndefined()
  })

  it('omits a duplicated header, which is ambiguous', () => {
    expect(
      realIpFromHeaders({ 'x-real-ip': ['203.0.113.7', '203.0.113.8'] }),
    ).toBeUndefined()
  })

  it('omits a comma-separated list', () => {
    expect(
      realIpFromHeaders({ 'x-real-ip': '203.0.113.7, 203.0.113.8' }),
    ).toBeUndefined()
  })

  it('omits values that are not a bare address', () => {
    const values = [
      'not-an-ip',
      '203.0.113.7:443',
      '[2001:db8::1]',
      '203.0.113.256',
    ]
    for (const value of values) {
      expect(realIpFromHeaders({ 'x-real-ip': value }), value).toBeUndefined()
    }
  })
})

describe('realIpMiddleware', () => {
  const call = (headers: express.Request['headers']) => {
    const captured: { store?: unknown } = {}
    realIpMiddleware(
      { headers } as express.Request,
      {} as express.Response,
      () => {
        captured.store = realIpStore.getStore()
      },
    )
    return captured.store
  }

  it('exposes the request address to handlers', () => {
    expect(call({ 'x-real-ip': '203.0.113.7' })).toEqual({
      ip: '203.0.113.7',
    })
  })

  it('exposes a missing address as undefined', () => {
    expect(call({})).toEqual({ ip: undefined })
  })
})

describe('markRequestAuthenticated', () => {
  it('marks the enclosing request as authenticated', () => {
    realIpStore.run({}, () => {
      markRequestAuthenticated()
      expect(realIpStore.getStore()).toEqual({ authenticated: true })
    })
  })

  it('does nothing outside a request', () => {
    expect(() => markRequestAuthenticated()).not.toThrow()
  })
})

describe('realIpInterceptor', () => {
  const next = async () => ({}) as UnaryResponse

  const run = async (state: RealIpState, preexistingHeader?: string) => {
    const header = new Headers()
    if (preexistingHeader !== undefined) {
      header.set('x-real-ip', preexistingHeader)
    }
    const req = { header } as UnaryRequest
    await realIpStore.run(state, () => realIpInterceptor(next)(req))
    return req.header
  }

  it('sets the x-real-ip header for unauthenticated requests', async () => {
    const headers = await run({ ip: '203.0.113.7' })
    expect(headers.get('x-real-ip')).toBe('203.0.113.7')
  })

  it('overwrites a pre-existing value for unauthenticated requests', async () => {
    const headers = await run({ ip: '203.0.113.7' }, '203.0.113.8')
    expect(headers.get('x-real-ip')).toBe('203.0.113.7')
  })

  it('omits the header for authenticated requests', async () => {
    const headers = await run({ ip: '203.0.113.7', authenticated: true })
    expect(headers.has('x-real-ip')).toBe(false)
  })

  it('removes a pre-existing header for authenticated requests', async () => {
    const headers = await run(
      { ip: '203.0.113.7', authenticated: true },
      '203.0.113.8',
    )
    expect(headers.has('x-real-ip')).toBe(false)
  })

  it('omits the header when the request has no address', async () => {
    const headers = await run({})
    expect(headers.has('x-real-ip')).toBe(false)
  })

  it('removes a pre-existing header when the request has no address', async () => {
    const headers = await run({}, '203.0.113.8')
    expect(headers.has('x-real-ip')).toBe(false)
  })

  it('omits the header outside a request', async () => {
    const header = new Headers()
    header.set('x-real-ip', '203.0.113.8')
    const req = { header } as UnaryRequest
    await realIpInterceptor(next)(req)
    expect(req.header.has('x-real-ip')).toBe(false)
  })
})
