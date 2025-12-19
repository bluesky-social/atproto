import { buildAgent, xrpc } from '@atproto/lex-client'
import { parseCid } from '@atproto/lex-data'
import { l } from '@atproto/lex-schema'
import { LexRouter, LexRouterHandler } from './lex-server.js'

const com = {
  example: {
    echo: l.procedure(
      'com.example.echo',
      l.params(),
      l.payload('*/*'),
      l.payload('*/*'),
    ),
    status: l.query(
      'com.example.status',
      l.params(),
      l.payload('application/json', l.object({ status: l.string() })),
    ),
    ipld: l.procedure(
      'com.example.ipld',
      l.params(),
      l.payload(
        'application/json',
        l.object({
          cid: l.cidLink(),
          bytes: l.bytes(),
        }),
      ),
      l.payload(
        'application/json',
        l.object({
          cid: l.cidLink(),
          bytes: l.bytes(),
        }),
      ),
    ),
    paramsToBody: l.query(
      'com.example.paramsToBody',
      l.params({
        name: l.string(),
        pronouns: l.array(l.string()),
      }),
      l.payload(
        'application/json',
        l.object({
          params: l.object({
            name: l.string(),
            pronouns: l.array(l.string()),
          }),
        }),
      ),
    ),
  },
}

const handlers: {
  [K in keyof typeof com.example]: LexRouterHandler<(typeof com.example)[K]>
} = {
  echo: async ({ input }) => ({
    encoding: input.encoding,
    body: input.body.body!,
  }),
  status: async () => ({ body: { status: 'ok' } }),
  ipld: async ({ input }) => ({ body: input.body! }),
  paramsToBody: async ({ params }) => ({ body: { params } }),
}

describe('LexRouter', () => {
  it('returns 404 when the route is not found', async () => {
    const router = new LexRouter()
    const response = await router.fetch(`https://example.com/xrpc/foo.bar.baz`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'MethodNotImplemented' })
  })

  it('streams payloads', async () => {
    const router = new LexRouter().add(com.example.echo, handlers.echo)
    const response = await router.fetch(
      'https://example.com/xrpc/com.example.echo',
      {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        // @ts-expect-error
        duplex: 'half',
        body: new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(new TextEncoder().encode('aaa'))
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('bbb'))
                setTimeout(() => {
                  controller.error(new Error('Stream closed'))
                }, 50)
              }, 50)
            }, 50)
          },
        }),
      },
    )

    const reader = response.body!.getReader()
    const chunks: string[] = []
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(new TextDecoder().decode(value))
      }
    } catch (err) {
      expect((err as Error).message).toBe('Stream closed')
    }
    expect(chunks).toEqual(['aaa', 'bbb'])
  })

  it('maps params to body', async () => {
    const router = new LexRouter().add(
      com.example.paramsToBody,
      handlers.paramsToBody,
    )

    const response = await router.fetch(
      'https://example.com/xrpc/com.example.paramsToBody?name=Alice&pronouns=she%2Fher&pronouns=they%2Fthem',
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      params: {
        name: 'Alice',
        pronouns: ['she/her', 'they/them'],
      },
    })
  })
})

describe('lex-client integration', () => {
  const router = new LexRouter()
    .add(com.example.echo, handlers.echo)
    .add(com.example.status, handlers.status)

  it('echoes text', async () => {
    const agent = buildAgent({
      fetch: async (input, init) => router.fetch(input, init),
      service: 'https://example.com',
    })
    const message = 'Hello, LexRouter!'
    const response = await xrpc(agent, com.example.echo, {
      body: message,
      encoding: 'text/plain',
    })
    const responseText = new TextDecoder().decode(response.body)
    expect(responseText).toBe(message)
    expect(response.encoding).toBe('text/plain')
  })

  it('streams text', async () => {
    const agent = buildAgent({
      fetch: async (input, init) => router.fetch(input, init),
      service: 'https://example.com',
    })
    const message = 'Hello, LexRouter Stream!'
    const response = await xrpc(agent, com.example.echo, {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(message))
          controller.close()
        },
      }),
      encoding: 'text/plain',
    })
    const responseText = new TextDecoder().decode(response.body)
    expect(responseText).toBe(message)
    expect(response.encoding).toBe('text/plain')
  })

  it('performs simple query', async () => {
    const agent = buildAgent({
      fetch: async (input, init) => router.fetch(input, init),
      service: 'https://example.com',
    })
    const response = await xrpc(agent, com.example.status)
    expect(response.success).toBe(true)
    expect(response.status).toBe(200)
    expect(response.encoding).toBe('application/json')
    expect(response.body.status).toBe('ok')
  })
})

describe('IPLD values', () => {
  it('can send and receive ipld vals', async () => {
    const ipldHandler: LexRouterHandler<typeof com.example.ipld> = jest.fn(
      async ({ input }) => {
        return { body: input.body! }
      },
    )

    const router = new LexRouter().add(com.example.ipld, ipldHandler)

    const agent = buildAgent({
      fetch: async (input, init) => router.fetch(input, init),
      service: 'https://example.com',
    })

    const cid = parseCid(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    )

    const bytes = new Uint8Array([0, 1, 2, 3])

    const response = await xrpc(agent, com.example.ipld, {
      body: { cid, bytes },
    })

    expect(ipldHandler).toHaveBeenCalledTimes(1)
    expect(response.success).toBe(true)
    expect(response.encoding).toBe('application/json')
    expect(response.body.cid.equals(cid)).toBe(true)
    expect(response.body.bytes).toEqual(bytes)
  })
})
