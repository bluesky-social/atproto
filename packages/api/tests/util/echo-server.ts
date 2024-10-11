import { once } from 'node:events'
import { createServer } from 'node:http'

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

  await once(server, 'listening')

  return server
}
