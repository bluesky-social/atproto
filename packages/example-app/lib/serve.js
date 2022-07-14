const { join } = require('path')
const handler = require('serve-handler')
const http = require('http')

const parts = __dirname.split('/packages/')
const BUILD_DIR = join(parts[0], 'packages', 'example-app', 'dist')

const runServer = (port) => {
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

module.exports = runServer