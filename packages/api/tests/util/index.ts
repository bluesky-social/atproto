import { AtpAgentFetchHandlerResponse } from '../../src'

export async function fetchHandler(
  httpUri: string,
  httpMethod: string,
  httpHeaders: Record<string, string>,
  httpReqBody: unknown,
): Promise<AtpAgentFetchHandlerResponse> {
  // The duplex field is now required for streaming bodies, but not yet reflected
  // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
  const reqInit: RequestInit & { duplex: string } = {
    method: httpMethod,
    headers: httpHeaders,
    body: httpReqBody
      ? new TextEncoder().encode(JSON.stringify(httpReqBody))
      : undefined,
    duplex: 'half',
  }
  const res = await fetch(httpUri, reqInit)
  const resBody = await res.arrayBuffer()
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: resBody ? JSON.parse(new TextDecoder().decode(resBody)) : undefined,
  }
}
