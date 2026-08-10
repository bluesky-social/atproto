import console from 'node:console'
import files from '@atproto/oauth-client-browser-example' with { type: 'json' }

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {(err?: Error) => void} [next]
 * @returns {void}
 */
export function middleware(
  req,
  res,
  next = (err) => {
    if (err) console.error(err)

    const { statusCode, statusMessage } = err
      ? { statusCode: 500, statusMessage: 'Internal Server Error' }
      : { statusCode: 404, statusMessage: 'Not Found' }

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
      .end(file.data, 'base64')
  } else {
    next()
  }
}
