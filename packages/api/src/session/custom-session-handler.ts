import { SessionManager } from './session-manager'

export type CustomSessionManagerOptions = {
  service: string | URL
  headers?:
    | { [_ in string]?: null | string }
    | Iterable<readonly [name: string, value: null | string]>
  fetch?: typeof globalThis.fetch
}

export class CustomSessionManager extends SessionManager {
  private fetch: typeof globalThis.fetch

  readonly serviceUrl: URL
  readonly headers: Map<string, string>

  constructor({
    service,
    headers,
    fetch = globalThis.fetch,
  }: CustomSessionManagerOptions) {
    super()

    this.fetch = fetch

    this.serviceUrl = new URL(service)
    this.headers = new Map(
      headers
        ? (Symbol.iterator in headers
            ? Array.from(headers)
            : Object.entries(headers)
          ).filter(
            <T extends readonly [string, unknown]>(
              e: T,
            ): e is T & [T[0], NonNullable<T[1]>] => e[1] != null,
          )
        : headers,
    )
  }

  get did() {
    return undefined
  }

  async getServiceUrl(): Promise<URL> {
    return this.serviceUrl
  }

  async fetchHandler(url: string, reqInit: RequestInit): Promise<Response> {
    const fullUrl = new URL(url, await this.getServiceUrl())
    const headers = new Headers(reqInit.headers)

    for (const [name, value] of this.headers) {
      if (!headers.has(name)) headers.set(name, value)
    }

    return (0, this.fetch)(fullUrl.toString(), { ...reqInit, headers })
  }
}
