import { XrpcDispatcher } from '@atproto/xrpc'

export abstract class AtpDispatcher extends XrpcDispatcher {
  abstract getDid(): string | PromiseLike<string>
  abstract getServiceUrl(): URL | PromiseLike<URL>
}
