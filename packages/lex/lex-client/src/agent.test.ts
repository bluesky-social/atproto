import { describe, expect, it, vi } from 'vitest'
import {
  type Agent,
  type AgentConfig,
  type FetchHandler,
  buildAgent,
  isAgent,
} from './agent.js'

// ============================================================================
// isAgent
// ============================================================================

describe(isAgent, () => {
  it('returns true for a valid agent with did', () => {
    const agent: Agent = {
      did: 'did:plc:example',
      fetchHandler: async () => new Response(),
    }
    expect(isAgent(agent)).toBe(true)
  })

  it('returns true for an agent without did', () => {
    const agent = { fetchHandler: async () => new Response() }
    expect(isAgent(agent)).toBe(true)
  })

  it('returns true when did is undefined', () => {
    const agent = { did: undefined, fetchHandler: async () => new Response() }
    expect(isAgent(agent)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isAgent(null)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isAgent('string')).toBe(false)
    expect(isAgent(42)).toBe(false)
    expect(isAgent(undefined)).toBe(false)
  })

  it('returns false when fetchHandler is not a function', () => {
    expect(isAgent({ fetchHandler: 'not-a-function' })).toBe(false)
  })

  it('returns false when did is not a string', () => {
    expect(isAgent({ did: 42, fetchHandler: async () => new Response() })).toBe(
      false,
    )
  })
})

// ============================================================================
// buildAgent
// ============================================================================

describe(buildAgent, () => {
  describe('from Agent', () => {
    it('returns the same agent instance', () => {
      const agent: Agent = {
        did: 'did:plc:example',
        fetchHandler: async () => new Response(),
      }
      expect(buildAgent(agent)).toBe(agent)
    })
  })

  describe('from FetchHandler', () => {
    it('wraps a function as an agent', () => {
      const handler: FetchHandler = async () => new Response()
      const agent = buildAgent(handler)

      expect(agent.did).toBeUndefined()
      expect(typeof agent.fetchHandler).toBe('function')
    })
  })

  describe('from string URL', () => {
    it('creates an agent that prepends the service URL', async () => {
      const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
        Response.json({ ok: true }),
      )
      const agent = buildAgent({
        service: 'https://example.com',
        fetch: fetchFn,
      })

      await agent.fetchHandler('/xrpc/io.example.test', { method: 'GET' })

      expect(fetchFn).toHaveBeenCalledOnce()
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toEqual(
        new URL('/xrpc/io.example.test', 'https://example.com'),
      )
      expect(init?.method).toBe('GET')
    })

    it('has undefined did', () => {
      const agent = buildAgent('https://example.com')
      expect(agent.did).toBeUndefined()
    })
  })

  describe('from URL instance', () => {
    it('creates an agent with the URL as service', async () => {
      const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
        Response.json({ ok: true }),
      )
      const agent = buildAgent({
        service: new URL('https://example.com'),
        fetch: fetchFn,
      })

      await agent.fetchHandler('/xrpc/io.example.test', { method: 'GET' })

      expect(fetchFn).toHaveBeenCalledOnce()
      const [url] = fetchFn.mock.calls[0]
      expect(url).toEqual(
        new URL('/xrpc/io.example.test', 'https://example.com'),
      )
    })
  })

  describe('from AgentConfig', () => {
    it('exposes did from config', () => {
      const agent = buildAgent({
        did: 'did:plc:test123',
        service: 'https://example.com',
      })
      expect(agent.did).toBe('did:plc:test123')
    })

    it('reflects did changes on the config object', () => {
      const config: AgentConfig = {
        did: 'did:plc:original',
        service: 'https://example.com',
      }
      const agent = buildAgent(config)
      expect(agent.did).toBe('did:plc:original')

      config.did = 'did:plc:updated'
      expect(agent.did).toBe('did:plc:updated')
    })

    it('throws TypeError when fetch is not available', () => {
      const originalFetch = globalThis.fetch
      try {
        // @ts-expect-error removing fetch to simulate missing environment
        globalThis.fetch = undefined
        expect(() => buildAgent({ service: 'https://example.com' })).toThrow(
          TypeError,
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('headers', () => {
    it('sends config headers when no request headers', async () => {
      const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
        Response.json({}),
      )
      const agent = buildAgent({
        service: 'https://example.com',
        headers: { Authorization: 'Bearer token123' },
        fetch: fetchFn,
      })

      await agent.fetchHandler('/xrpc/test', { method: 'GET' })

      const [, init] = fetchFn.mock.calls[0]
      expect(init?.headers).toEqual({ Authorization: 'Bearer token123' })
    })

    it('sends request headers when no config headers', async () => {
      const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
        Response.json({}),
      )
      const agent = buildAgent({
        service: 'https://example.com',
        fetch: fetchFn,
      })

      await agent.fetchHandler('/xrpc/test', {
        method: 'GET',
        headers: { 'X-Custom': 'value' },
      })

      const [, init] = fetchFn.mock.calls[0]
      expect(init?.headers).toEqual({ 'X-Custom': 'value' })
    })

    it('merges config and request headers, with request taking priority', async () => {
      const fetchFn = vi.fn<typeof globalThis.fetch>(async () =>
        Response.json({}),
      )
      const agent = buildAgent({
        service: 'https://example.com',
        headers: { Authorization: 'Bearer default', 'X-Default': 'yes' },
        fetch: fetchFn,
      })

      await agent.fetchHandler('/xrpc/test', {
        method: 'GET',
        headers: { Authorization: 'Bearer override' },
      })

      const [, init] = fetchFn.mock.calls[0]
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer override')
      expect(headers.get('X-Default')).toBe('yes')
    })
  })
})
