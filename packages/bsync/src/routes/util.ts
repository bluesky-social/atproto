import { Code, ConnectError } from '@connectrpc/connect'
import {
  InvalidDidError,
  ensureValidAtUri,
  ensureValidDid,
} from '@atproto/syntax'

export const validCursor = (cursor: string): number | null => {
  if (cursor === '') return null
  const int = parseInt(cursor, 10)
  if (isNaN(int) || int < 0) {
    throw new ConnectError('invalid cursor', Code.InvalidArgument)
  }
  return int
}

export const combineSignals = (a: AbortSignal, b: AbortSignal) => {
  const controller = new AbortController()
  for (const signal of [a, b]) {
    if (signal.aborted) {
      controller.abort()
      return signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      // @ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/pull/68625
      signal: controller.signal,
    })
  }
  return controller.signal
}

export const isValidDid = (did: string) => {
  try {
    ensureValidDid(did)
    return true
  } catch (err) {
    if (err instanceof InvalidDidError) {
      return false
    }
    throw err
  }
}

export const isValidAtUri = (uri: string) => {
  try {
    ensureValidAtUri(uri)
    return true
  } catch {
    return false
  }
}
