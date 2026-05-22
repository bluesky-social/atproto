export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: undefined | Json }

type Awaitable<T> = T | PromiseLike<T>

export type Options = {
  signal?: AbortSignal
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
      json: Endpoints[Path] extends { output: infer Output } ? Output : never
      method: string
      input: Endpoints[Path] extends { method: 'GET'; params: infer Params }
        ? Params
        : Endpoints[Path] extends { method: 'POST'; input: infer Input }
          ? Input
          : undefined
      options?: Options
    }) => void
  }
  headers?: () => Awaitable<Record<string, string | undefined>>
}

export class JsonClient<Endpoints extends EndpointDefinitions> {
  constructor(
    protected readonly baseUrl: string,
    protected readonly options?: JsonClientOptions<Endpoints>,
  ) {}

  public async fetch<Path extends EndpointPath & keyof Endpoints>(
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

      const headersEntries = await this.options?.headers?.()
      const headers = new Headers(
        headersEntries
          ? Object.entries(headersEntries).filter(
              (entry): entry is [string, string] => entry[1] != null,
            )
          : undefined,
      )

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

      const json = await response.json()

      if (response.ok) {
        this.options?.onFetchSuccess?.[path]?.call(null, {
          json,
          method,
          input,
          options,
        } as any)
        return json as Endpoints[Path]['output']
      } else throw this.parseError(response, json)
    } catch (err) {
      const context = { method, path, input, options }
      console.warn('API request failed', err, context)
      this.options?.onFetchError?.call(null, err, context)
      throw err
    }
  }

  protected parseError(response: Response, json: Json): Error {
    const Class = this.constructor as typeof JsonClient
    const error = Class.parseError(json)
    if (error) return error

    return new Error('Invalid JSON response', { cause: response })
  }

  public static parseError(json: unknown): undefined | JsonErrorResponse {
    if (JsonErrorResponse.is(json)) {
      return new JsonErrorResponse(json)
    }
  }
}

export type JsonErrorPayload<E extends string = string> = {
  error: E
  error_description?: string
}

export class JsonErrorResponse<
  P extends JsonErrorPayload = JsonErrorPayload,
> extends Error {
  name = 'JsonErrorResponse'

  constructor(
    public readonly payload: P,
    message = payload.error_description,
    options?: ErrorOptions,
  ) {
    super(message || `Error "${payload.error}"`, options)
  }

  get error(): string {
    return this.payload.error
  }

  get description(): string | undefined {
    return this.payload.error_description
  }

  static is(json: unknown): json is JsonErrorPayload {
    return (
      json != null &&
      typeof json === 'object' &&
      typeof json['error'] === 'string' &&
      (json['error_description'] === undefined ||
        typeof json['error_description'] === 'string')
    )
  }
}
