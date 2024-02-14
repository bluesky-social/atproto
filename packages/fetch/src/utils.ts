// BodyInit not made available by @types/node
export type BodyInit = Exclude<
  ConstructorParameters<typeof Response>[0],
  undefined
>

export function overrideResponseBody(
  response: Response,
  body: BodyInit,
): Response {
  const newResponse = new Response(body, response)

  /**
   * Some props do not get copied by the Response constructor (e.g. url)
   */
  for (const key of ['url', 'redirected', 'type', 'statusText'] as const) {
    const value = response[key]
    if (value !== newResponse[key]) {
      Object.defineProperty(newResponse, key, {
        get: () => value,
        enumerable: true,
        configurable: true,
      })
    }
  }

  return newResponse
}
