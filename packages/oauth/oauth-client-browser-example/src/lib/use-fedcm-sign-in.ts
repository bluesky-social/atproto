import { useCallback, useEffect, useRef, useState } from 'react'
import type { DidString } from '@atproto/lex'
import { type FedcmSelection, requestFedcmSelection } from './fedcm.ts'

type PendingFedcmRequest = {
  controller: AbortController
}

export function useFedcmSignIn(
  providerConfigUrls: readonly string[],
  onSelection: (did: DidString, signal: AbortSignal) => void | Promise<void>,
  auto: boolean,
) {
  const pendingRef = useRef<PendingFedcmRequest | undefined>(undefined)
  const timeoutRef = useRef<number | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>()

  const cancel = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    const request = pendingRef.current
    if (request) {
      request.controller.abort()
      pendingRef.current = undefined
    }
    setPending(false)
    setError(undefined)
  }, [])

  const requestSelection = useCallback(
    (mode: 'active' | 'passive') => {
      cancel()

      const request: PendingFedcmRequest = {
        controller: new AbortController(),
      }
      pendingRef.current = request

      let selection: Promise<FedcmSelection | null>
      try {
        // @NOTE requestFedcmSelection calls navigator.credentials.get
        // synchronously, before this user-initiated flow does async work.
        selection = requestFedcmSelection(
          providerConfigUrls,
          request.controller.signal,
          mode,
        )
      } catch (err) {
        selection = Promise.reject(err)
      }

      setPending(true)
      void selection
        .then((selected) => {
          if (!selected) return
          request.controller.signal.throwIfAborted()
          return onSelection(selected.did, request.controller.signal)
        })
        .catch((err) => {
          if (request.controller.signal.aborted) return
          setError(err)
          console.warn('FedCM sign-in failed:', err)
        })
        .finally(() => {
          // @NOTE Keep the controller through OAuth/PAR so manual sign-in can
          // still abort a redirect that finishes after cancellation.
          if (pendingRef.current === request) setPending(false)
        })
    },
    [cancel, onSelection, providerConfigUrls],
  )

  const requestActiveSelection = useCallback(
    () => requestSelection('active'),
    [requestSelection],
  )

  useEffect(() => {
    if (!auto || !providerConfigUrls.length) return

    // @NOTE StrictMode cleans up the first effect setup before this timer runs,
    // so replaying the effect does not open two passive FedCM prompts.
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = undefined
      requestSelection('passive')
    }, 0)

    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
      cancel()
    }
  }, [auto, cancel, providerConfigUrls, requestSelection])

  useEffect(() => cancel, [cancel])

  return { cancel, error, pending, requestActiveSelection }
}
