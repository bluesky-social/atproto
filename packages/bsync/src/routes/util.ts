import { Code, ConnectError } from '@connectrpc/connect'
import {
  InvalidDidError,
  ensureValidAtUri,
  ensureValidDid,
  ensureValidNsid,
} from '@atproto/syntax'

export const validCursor = (cursor: string): number | null => {
  if (cursor === '') return null
  const int = parseInt(cursor, 10)
  if (isNaN(int) || int < 0) {
    throw new ConnectError('invalid cursor', Code.InvalidArgument)
  }
  return int
}

export function combineSignals(
  ...signals: readonly (AbortSignal | undefined)[]
): AbortController & Disposable {
  const controller = new DisposableAbortController()

  const onAbort = function (this: AbortSignal, _event: Event) {
    const reason = new Error('This operation was aborted', {
      cause: this.reason,
    })

    controller.abort(reason)
  }

  try {
    for (const sig of signals) {
      if (sig) {
        sig.throwIfAborted()
        sig.addEventListener('abort', onAbort, { signal: controller.signal })
      }
    }

    return controller
  } catch (err) {
    controller.abort(err)
    throw err
  }
}

export function combinedSignals(
  ...signals: readonly (AbortSignal | undefined)[]
): AbortSignal & Disposable {
  const controller = combineSignals(...signals)
  return Object.defineProperty(controller.signal, Symbol.dispose, {
    value: controller[Symbol.dispose].bind(controller),
  }) as AbortSignal & Disposable
}

/**
 * Allows using {@link AbortController} with the `using` keyword, in order to
 * automatically abort them once the execution block ends.
 */
class DisposableAbortController extends AbortController implements Disposable {
  [Symbol.dispose]() {
    this.abort(new Error('AbortController was disposed'))
  }
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

export const validateNamespace = (namespace: string): void => {
  const parts = namespace.split('#')

  if (parts.length !== 1 && parts.length !== 2) {
    throw new Error('namespace must be in the format "nsid[#fragment]"')
  }

  const [nsid, fragment] = parts

  ensureValidNsid(nsid)
  if (fragment && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(fragment)) {
    throw new Error('namespace fragment must be a valid identifier')
  }
}
