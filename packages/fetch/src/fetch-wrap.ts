import { Fetch } from './fetch.js'
import { TransformedResponse } from './transformed-response.js'

export const loggedFetchWrap = ({
  fetch = globalThis.fetch as Fetch,
} = {}): Fetch => {
  return async function (request) {
    return fetchLog.call(this, request, fetch)
  }
}

async function fetchLog(
  this: ThisParameterType<Fetch>,
  request: Request,
  fetch: Fetch = globalThis.fetch,
) {
  console.info(
    `> ${request.method} ${request.url}\n` +
      stringifyPayload(request.headers, await request.clone().text()),
  )

  try {
    const response = await fetch(request)

    console.info(
      `< HTTP/1.1 ${response.status} ${response.statusText}\n` +
        stringifyPayload(response.headers, await response.clone().text()),
    )

    return response
  } catch (error) {
    console.error(`< Error:`, error)

    throw error
  }
}

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

export const timeoutFetchWrap = ({
  fetch = globalThis.fetch as Fetch,
  timeout = 60e3,
} = {}): Fetch => {
  if (timeout === Infinity) return fetch
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('Timeout must be positive')
  }
  return async function (request) {
    return fetchTimeout.call(this, request, timeout, fetch)
  }
}

export async function fetchTimeout(
  this: ThisParameterType<Fetch>,
  request: Request,
  timeout = 30e3,
  fetch: Fetch = globalThis.fetch,
): Promise<Response> {
  if (timeout === Infinity) return fetch(request)
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('Timeout must be positive')
  }

  const controller = new AbortController()
  const signal = controller.signal

  const abort = () => {
    controller.abort()
  }
  const cleanup = () => {
    clearTimeout(timeoutId)
    request.signal?.removeEventListener('abort', abort)
  }

  const timeoutId = setTimeout(abort, timeout).unref()
  request.signal?.addEventListener('abort', abort)

  signal.addEventListener('abort', cleanup)

  const response = await fetch(new Request(request, { signal }))

  if (!response.body) {
    cleanup()
    return response
  } else {
    // Cleanup the timer & event listeners when the body stream is closed
    const transform = new TransformStream({ flush: cleanup })
    return new TransformedResponse(response, transform)
  }
}
