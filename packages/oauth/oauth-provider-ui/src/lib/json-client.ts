// Using a type import to avoid bundling this lib
import type { Json } from '@atproto-labs/fetch'

export { type Json }
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

export class JsonClient<
  Endpoints extends { [Path: EndpointPath]: EndpointDefinition },
> {
  constructor(
    protected readonly baseUrl: string,
    protected readonly getHeaders: () => Awaitable<
      Record<string, string | undefined>
    >,
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
    const url = new URL(`${this.baseUrl}${path}`)
    if (method === 'GET') {
      if (input) {
        for (const [key, value] of Object.entries(input)) {
          url.searchParams.set(key, value)
        }
      }
    }

    const body = method === 'POST' ? JSON.stringify(input) : undefined

    const headers = await this.getHeaders.call(null)

    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      mode: 'same-origin',
      body,
      signal: options?.signal,
    })

    if (response.status === 204) {
      return undefined
    }

    return response.json().then((json: Json) => {
      if (response.ok) return json as Endpoints[Path]['output']
      else throw this.parseError(response, json)
    })
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
  constructor(
    public readonly payload: P,
    message = payload.error_description,
  ) {
    super(message || `Error "${payload.error}"`)
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
