import { SessionManager } from './session-manager'

export type StatelessSessionManagerOptions = {
  service: string | URL
  headers?: { [_ in string]?: null | string }
}

export class StatelessSessionManager implements SessionManager {
  readonly serviceUrl: URL
  readonly headers: Map<string, string>

  constructor({ service, headers }: StatelessSessionManagerOptions) {
    this.headers = new Map(
      headers
        ? Object.entries(headers).filter(
            <T extends [string, unknown]>(
              e: T,
            ): e is T & [T[0], NonNullable<T[1]>] => e[1] != null,
          )
        : headers,
    )
    this.serviceUrl = new URL(service)
  }

  async getServiceUrl(): Promise<URL> {
    return this.serviceUrl
  }

  async getDid(): Promise<string> {
    throw new Error('Not logged in')
  }

  async fetchHandler(url: string, reqInit: RequestInit): Promise<Response> {
    const fullUrl = new URL(url, this.serviceUrl)
    const headers = new Headers(reqInit.headers)

    for (const [key, value] of this.headers) {
      if (value != null) headers.set(key, value)
    }

    return globalThis.fetch(fullUrl.toString(), { ...reqInit, headers })
  }
}
