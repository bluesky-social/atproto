import { useCallback, useEffect, useRef } from 'react'
import type { DidString } from '@atproto/lex'
import { requestFedcmSelection } from './fedcm.ts'

type PendingFedcmRequest = {
  controller: AbortController
  timeout?: number
}

export function useFedcmAutoSignIn(
  providerConfigUrls: readonly string[],
  onSelection: (did: DidString, signal: AbortSignal) => void | Promise<void>,
) {
  const pendingRef = useRef<PendingFedcmRequest | undefined>(undefined)

  const cancel = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return

    if (pending.timeout != null) window.clearTimeout(pending.timeout)
    pending.controller.abort()
    pendingRef.current = undefined
  }, [])

  useEffect(() => {
    if (!providerConfigUrls.length) return

    const pending: PendingFedcmRequest = {
      controller: new AbortController(),
    }
    pendingRef.current = pending

    // @NOTE StrictMode cleans up the first effect setup before this timer runs,
    // so replaying the effect does not open two FedCM prompts.
    pending.timeout = window.setTimeout(() => {
      pending.timeout = undefined
      void requestFedcmSelection(providerConfigUrls, pending.controller.signal)
        .then((selection) => {
          if (!selection) return
          pending.controller.signal.throwIfAborted()
          return onSelection(selection.did, pending.controller.signal)
        })
        .catch((err) => {
          if (!pending.controller.signal.aborted) {
            console.warn('FedCM sign-in failed:', err)
          }
        })
    }, 0)

    return () => {
      if (pending.timeout != null) window.clearTimeout(pending.timeout)
      pending.controller.abort()
      if (pendingRef.current === pending) pendingRef.current = undefined
    }
  }, [onSelection, providerConfigUrls])

  return cancel
}
