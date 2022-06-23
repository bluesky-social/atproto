import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import handler from 'serve-handler'
import http from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILD_DIR = join(__dirname, '..', 'build')

export default function runServer(port) {
  const server = http.createServer((request, response) => {
    return handler(request, response, {
      public: BUILD_DIR,
      cleanUrls: true,
      directoryListing: false,
    })
  })
  server.listen(port)
  return server
}
