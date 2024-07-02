export abstract class SessionManager {
  abstract did?: string

  abstract fetchHandler(url: string, reqInit: RequestInit): Promise<Response>

  /** @deprecated only used for a very particular use-case in the official Bluesky app */
  abstract getServiceUrl(): URL | PromiseLike<URL>
}
