import { IncomingMessage, ServerResponse } from 'node:http'

import { html } from '@atproto/html'

import { getAsset } from '../assets'
import { buildErrorPayload, buildErrorStatus } from './build-error-payload'
import { declareBrowserGlobalVar, sendWebApp } from './send-web-app'

export async function sendErrorPage(
  req: IncomingMessage,
  res: ServerResponse,
  err: unknown,
): Promise<void> {
  return sendWebApp(req, res, {
    status: buildErrorStatus(err),
    scripts: [
      declareBrowserGlobalVar('__backendData', buildErrorPayload(err)),
      await getAsset('main.js'),
    ],
    styles: [await getAsset('main.css')],
    title: 'Error',
    body: html`<div id="root"></div>`,
  })
}
