import { Did, UnknownString } from '@atproto/lex-schema'

export type { Did, UnknownString }

export type DidServiceIdentifier = 'atproto_labeler' | UnknownString
export type Service = `${Did}#${DidServiceIdentifier}`

export type CallOptions = {
  labelers?: Iterable<Did>
  signal?: AbortSignal
  headers?: HeadersInit
  service?: Service
  validateRequest?: boolean
  validateResponse?: boolean
}

export type Namespace<T> = T | { main: T }

export function getMain<T extends object>(ns: Namespace<T>): T {
  return 'main' in ns ? ns.main : ns
}
