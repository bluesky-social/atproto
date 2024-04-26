import { SessionManager } from './session-manager'

export type StatelessSessionManagerOptions = {
  service: string | URL
  headers?: { [_ in string]?: null | string }
  fetch?: typeof globalThis.fetch
}

export class StatelessSessionManager extends SessionManager {
  private fetch: typeof globalThis.fetch

  readonly serviceUrl: URL
  readonly headers: Map<string, string>

  constructor({
    service,
    headers,
    fetch = globalThis.fetch,
  }: StatelessSessionManagerOptions) {
    super()

    this.fetch = fetch

    this.serviceUrl = new URL(service)
    this.headers = new Map(
      headers
        ? Object.entries(headers).filter(
            <T extends [string, unknown]>(
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

    for (const [key, value] of this.headers) {
      if (value != null) headers.set(key, value)
    }

    return (0, this.fetch)(fullUrl.toString(), { ...reqInit, headers })
  }
}
