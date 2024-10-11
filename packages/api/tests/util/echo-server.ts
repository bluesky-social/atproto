import http from 'node:http'

export async function createHeaderEchoServer(port: number = 0) {
  return new Promise<http.Server>((resolve) => {
    const server = http.createServer()

    server
      .on('request', (request, response) => {
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({
            ...request.headers,
            did: 'did:web:fake.com',
            availableUserDomains: [],
          }),
        )
      })
      .once('listening', () => resolve(server))
      .listen(port)
  })
}
