export interface SessionManager {
  fetchHandler(url: string, reqInit: RequestInit): Promise<Response>
  getDid(): string | PromiseLike<string>

  /** @deprecated only used for a very particular use-case in the official Bluesky app */
  getServiceUrl(): URL | PromiseLike<URL>
}

export function isSessionManager<T>(value: T): value is T & SessionManager {
  return (
    value !== null &&
    typeof value === 'object' &&
    'fetchHandler' in value &&
    typeof value.fetchHandler === 'function' &&
    'getDid' in value &&
    typeof value.getDid === 'function' &&
    'getServiceUrl' in value &&
    typeof value.getServiceUrl === 'function'
  )
}
