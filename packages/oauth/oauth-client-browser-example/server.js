/* eslint-env node, commonjs */

'use strict'

const { once } = require('node:events')
const { createServer } = require('node:http')
const files = require('./dist/files.json')

exports.middleware = middleware
function middleware(
  req,
  res,
  next = (err) => {
    if (err) console.error(err)

    const { statusCode, statusMessage } = err
      ? { statusCode: 404, statusMessage: 'Not Found' }
      : { statusCode: 500, statusMessage: 'Internal Server Error' }

    res
      .writeHead(statusCode, statusMessage, { 'content-type': 'text/plain' })
      .end(statusMessage)
  },
) {
  const path = req.url?.split('?')[0].slice(1) || 'index.html'
  const file = Object.hasOwn(files, path) ? files[path] : null

  if (file) {
    res
      .writeHead(200, 'OK', { 'content-type': file.mime })
      .end(Buffer.from(file.data, 'base64'))
  } else {
    next()
  }
}

exports.start = start
async function start(port = 0) {
  const server = createServer(middleware)
  server.listen(port)
  await once(server, 'listening')
  return server
}

if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT || 0)
  start(port).then((server) => {
    const address = server.address()
    const port = typeof address === 'string' ? address : address && address.port
    console.log(`Listening on http://127.0.0.1:${port}/`)
  })
}
