import { IncomingMessage, ServerResponse } from 'node:http'
import files from '@atproto/oauth-client-browser-example' with { type: 'json' }

export function oauthClientAssetsMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
): void {
  const path = req.url?.split('?')[0].slice(1) || 'index.html'
  const file = Object.hasOwn(files, path) ? files[path] : null

  if (file) {
    res
      .writeHead(200, 'OK', { 'content-type': file.mime })
      .end(Buffer.from(file.data, 'base64'))
  } else if (next) {
    next()
  } else {
    res
      .writeHead(404, 'Not Found', { 'content-type': 'text/plain' })
      .end('Page not found')
  }
}
