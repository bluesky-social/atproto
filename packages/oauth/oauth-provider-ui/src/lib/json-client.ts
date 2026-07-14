import { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: undefined | Json }

type Awaitable<T> = T | PromiseLike<T>

export type Options = {
  signal?: AbortSignal
  parseError?: (response: Response, payload: Json) => undefined | Error
}

export type EndpointPath = `/${string}`
export type EndpointDefinition =
  | {
      method: 'POST'
      input: Json
      output: Json | void
    }
  | {
      method: 'GET'
      params?: Record<string, string | undefined>
      output: Json | void
    }
export type EndpointDefinitions = { [path: EndpointPath]: EndpointDefinition }

export type JsonClientOptions<Endpoints extends EndpointDefinitions> = {
  onFetchError?: (
    err: unknown,
    context: {
      method: string
      path: string
      input: unknown
      options?: Options
    },
  ) => void
  onFetchSuccess?: {
    [Path in keyof Endpoints & string]?: (data: {
      method: string
      input: Endpoints[Path] extends { method: 'GET'; params: infer Params }
        ? Params
        : Endpoints[Path] extends { method: 'POST'; input: infer Input }
          ? Input
          : undefined
      output: Endpoints[Path] extends { output: infer Output } ? Output : never
      options?: Options
    }) => void
  }
  headers?: () => Awaitable<HeadersInit>
}

export class JsonClient<Endpoints extends EndpointDefinitions> {
  constructor(
    protected readonly baseUrl: string,
    protected readonly options?: JsonClientOptions<Endpoints>,
  ) {}

  protected async fetch<Path extends EndpointPath & keyof Endpoints>(
    method: Endpoints[Path]['method'],
    path: Path,
    input: Endpoints[Path] extends { method: 'GET' }
      ? Endpoints[Path]['params']
      : Endpoints[Path] extends { method: 'POST' }
        ? Endpoints[Path]['input']
        : undefined,
    options?: Options,
  ): Promise<Endpoints[Path]['output']> {
    try {
      const url = new URL(`${this.baseUrl}${path}`)
      if (method === 'GET') {
        if (input) {
          for (const [key, value] of Object.entries(input)) {
            url.searchParams.set(key, value)
          }
        }
      }

      const body = method === 'POST' ? JSON.stringify(input) : undefined

      const headers = new Headers(await this.options?.headers?.())

      if (body && !headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }

      const response = await fetch(url, {
        method,
        headers,
        mode: 'same-origin',
        body,
        signal: options?.signal,
      })

      if (response.status === 204) {
        return undefined
      }

      const responseType = response.headers.get('content-type')
      if (responseType !== 'application/json') {
        await response.body?.cancel()
        throw new Error(`Invalid content type "${responseType}"`, {
          cause: response,
        })
      }

      const output = await response.json()

      if (!response.ok) {
        const error =
          options?.parseError?.(response, output) ||
          this.parseError(response, output)
        throw error
      }

      this.options?.onFetchSuccess?.[path]?.call(null, {
        output,
        method,
        input,
        options,
      } as any)

      return output as Endpoints[Path]['output']
    } catch (err) {
      const context = { method, path, input, options }
      console.warn('API request failed', err, context)
      this.options?.onFetchError?.call(null, err, context)
      throw err
    }
  }

  protected parseError(response: Response, payload: Json): Error {
    return new JsonErrorResponse(payload)
  }
}

export class JsonErrorResponse<P = unknown> extends Error {
  name = 'JsonErrorResponse'

  msg: MessageDescriptor = msg`Unexpected server response`

  constructor(
    public readonly payload: P,
    message: string = 'Unknown JSON error response',
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
