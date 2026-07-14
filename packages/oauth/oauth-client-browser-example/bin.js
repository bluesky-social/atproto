import console from 'node:console'
import { once } from 'node:events'
import { createServer } from 'node:http'
import process, { argv, env } from 'node:process'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { middleware } from './server.js'

// Parse config
const port = Number(argv[2] || env.PORT || 0)
if (isNaN(port) || port < 0 || port > 65535) {
  console.error(`Invalid port: ${argv[2] || env.PORT}`)
  process.exit(1)
}

// eslint-disable-next-line no-undef
const abortController = new AbortController()

process.on('SIGINT', () => abortController.abort())
process.on('SIGTERM', () => abortController.abort())

const server = createServer(middleware)
const terminator = httpTerminator.createHttpTerminator({ server })

server.listen(port)

once(server, 'listening').then(async () => {
  const address = server.address()
  const port = typeof address === 'string' ? address : address?.port

  if (!abortController.signal.aborted) {
    console.log(`Listening on http://127.0.0.1:${port}/`)
    console.log('Press Ctrl+C to stop the server')
    await once(abortController.signal, 'abort')
  }

  console.log('Shutting down...')
  await terminator.terminate()
})
