// Using a type import to avoid bundling this lib
import type { Json } from '@atproto-labs/fetch'

export { type Json }

export type Options = {
  signal?: AbortSignal
}

export type EndpointPath = `/${string}`
export type EndpointDefinition = {
  input: Json
  output: Json | void
}

export class JsonClient<
  Endpoints extends { [Path: EndpointPath]: EndpointDefinition },
> {
  constructor(
    protected readonly baseUrl: string,
    protected readonly csrfToken: string,
  ) {}

  public async fetch<Path extends EndpointPath & keyof Endpoints>(
    path: Path,
    payload: Endpoints[Path]['input'],
    options?: Options,
  ): Promise<Endpoints[Path]['output']> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      mode: 'same-origin',
      body: JSON.stringify(payload),
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
