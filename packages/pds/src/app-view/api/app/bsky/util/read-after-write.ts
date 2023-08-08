import { Headers } from '@atproto/xrpc'

export type ApiRes<T> = {
  headers: Headers
  data: T
}

export const getRepoRev = (headers: Headers): string | undefined => {
  return headers['atproto-repo-rev']
}
