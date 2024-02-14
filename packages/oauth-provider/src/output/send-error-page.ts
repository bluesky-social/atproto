import { IncomingMessage, ServerResponse } from 'node:http'

import { html } from '@atproto/html'
import { writeHtml } from '@atproto/http-util'

export async function sendErrorPage(
  req: IncomingMessage,
  res: ServerResponse,
  _err: unknown,
): Promise<void> {
  // TODO : actually display the error

  /* Security headers */
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Permissions-Policy', 'otp-credentials=* document-domain=()')
  res.setHeader('Strict-Transport-Security', 'max-age=63072000')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader(
    'Content-Security-Policy',
    [
      `default-src 'none'`,
      `frame-ancestors 'none'`,
      `form-action 'none'`,
      `base-uri 'none'`,

      `script-src 'self' https://cdn.jsdelivr.net https://cdn.tailwindcss.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' https:`,
      `connect-src 'self'`,
      `upgrade-insecure-requests`,
    ].join('; '),
  )

  const payload = html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <title>Authorize</title>

        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <h1>Authorization Error</h1>
      </body>
    </html>
  `

  writeHtml(res, payload.toBuffer())
}
