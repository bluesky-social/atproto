import { FetchHandlerObject } from '@atproto/xrpc'

export interface SessionManager extends FetchHandlerObject {
  readonly did?: string
}
