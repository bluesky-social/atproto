import { Code, ConnectError } from '@connectrpc/connect'

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
