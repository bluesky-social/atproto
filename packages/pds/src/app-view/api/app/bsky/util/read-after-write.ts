import { Headers } from '@atproto/xrpc'

export type ApiRes<T> = {
  headers: Headers
  data: T
}

export const getClock = (headers: Headers): string | undefined => {
  return headers['atproto-clock']
}
