import { once } from 'node:events'
import { type Server, createServer } from 'node:http'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'

export type DisposableServer = Server & {
  terminate: () => Promise<void>
  [Symbol.asyncDispose]: () => Promise<void>
}

export async function createHeaderEchoServer(port: number = 0) {
  const server = createServer((req, res) => {
    res.writeHead(200, undefined, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        ...req.headers,
        did: 'did:web:fake.com',
        availableUserDomains: [],
      }),
    )
  })

  server.listen(port)

  const terminator = httpTerminator.createHttpTerminator({ server })
  await once(server, 'listening')

  Object.defineProperty(server, 'terminate', {
    value: () => terminator.terminate(),
  })

  Object.defineProperty(server, Symbol.asyncDispose, {
    value: () => terminator.terminate(),
  })

  return server as DisposableServer
}
