import { Fetch } from './fetch.js'

export const loggedFetchWrap =
  ({ fetch = globalThis.fetch as Fetch, prefix = '' } = {}): Fetch =>
  async (request) => {
    await logRequest(request, prefix)
    try {
      const response = await fetch(request)
      await logResponse(response, prefix)
      return response
    } catch (error) {
      await logError(error, prefix)
      throw error
    }
  }

const logRequest = async (request: Request, prefix = '') =>
  console.info(
    `${prefix}> ${request.method} ${request.url}\n` +
      stringifyPayload(request.headers, await request.clone().text()),
  )

const logResponse = async (response: Response, prefix = '') =>
  console.info(
    `${prefix}< HTTP/1.1 ${response.status} ${response.statusText}\n` +
      stringifyPayload(response.headers, await response.clone().text()),
  )

const logError = async (error: unknown, prefix = '') =>
  console.error(`${prefix} error:`, error)

const stringifyPayload = (headers: Headers, body: string) =>
  [stringifyHeaders(headers), stringifyBody(body)]
    .filter(Boolean)
    .join('\n  ') + '\n  '

const stringifyHeaders = (headers: Headers) =>
  Array.from(headers)
    .map(([name, value]) => `  ${name}: ${value}\n`)
    .join('')

const stringifyBody = (body: string) =>
  body ? `\n  ${body.replace(/\r?\n/g, '\\n')}` : ''
