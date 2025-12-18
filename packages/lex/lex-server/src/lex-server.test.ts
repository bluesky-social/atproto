import { buildAgent, xrpc } from '@atproto/lex-client'
import { l } from '@atproto/lex-schema'
import { LexRouter } from './lex-server.js'

const echoProcedure = l.procedure(
  'com.example.echo',
  l.params(),
  l.payload('*/*'),
  l.payload('*/*'),
)

describe('LexRouter', () => {
  const router = new LexRouter().add(
    echoProcedure,
    async ({ input: { encoding, body }, request }) => {
      const url = new URL(request.url)
      expect(url.origin).toBe('https://example.com')
      return { encoding, body: body.body! }
    },
  )

  const agent = buildAgent({
    fetch: async (input, init) => router.fetch(input, init),
    service: 'https://example.com',
  })

  it('returns 404 for unknown route', async () => {
    const response = await router.fetch(
      'https://example.com/xrpc/com.example.unknown',
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'MethodNotImplemented' })
  })

  it('handles an xrpc request', async () => {
    const message = 'Hello, LexRouter!'
    const response = await xrpc(agent, echoProcedure, {
      body: message,
      encoding: 'text/plain',
    })
    const responseText = new TextDecoder().decode(response.body)
    expect(responseText).toBe(message)
    expect(response.encoding).toBe('text/plain')
  })

  it('streams payloads', async () => {
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
})
