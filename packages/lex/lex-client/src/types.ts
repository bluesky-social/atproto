import { DidString, UnknownString } from '@atproto/lex-schema'

export type { DidString, UnknownString }

export type DidServiceIdentifier = 'atproto_labeler' | UnknownString
export type Service = `${DidString}#${DidServiceIdentifier}`

export type CallOptions = {
  labelers?: Iterable<DidString>
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
