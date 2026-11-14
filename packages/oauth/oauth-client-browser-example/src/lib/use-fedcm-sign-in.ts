import { useCallback, useEffect, useRef, useState } from 'react'
import { toBase64 } from '@atproto/lex'
import { clientMetadata, oauthClient } from '../oauthClient.ts'
import {
  type FedcmIdentityResolver,
  type VerifiedFedcmIdentity,
  verifyFedcmIdToken,
} from './fedcm-id-token.ts'
import {
  type FedcmProviders,
  type FedcmSelection,
  requestFedcmSelection,
} from './fedcm.ts'

// @NOTE a real app should mint the nonce server-side; the prototype generates
// it in the browser.
function generateNonce(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)), 'base64url')
}

const resolveIdentity: FedcmIdentityResolver = async (did) => {
  const { didDoc, handle } = await oauthClient.identityResolver.resolve(did)
  return { didDoc, handle }
}

type PendingFedcmRequest = {
  controller: AbortController
}

export function useFedcmSignIn(
  providers: FedcmProviders,
  onSelection: (
    identity: VerifiedFedcmIdentity,
    signal: AbortSignal,
  ) => void | Promise<void>,
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

      const nonce = generateNonce()
      let selection: Promise<FedcmSelection | null>
      try {
        // @NOTE requestFedcmSelection calls navigator.credentials.get
        // synchronously, before this user-initiated flow does async work.
        selection = requestFedcmSelection(
          providers,
          request.controller.signal,
          mode,
          nonce,
        )
      } catch (err) {
        selection = Promise.reject(err)
      }

      setPending(true)
      void selection
        .then((selected) => {
          if (!selected) return
          request.controller.signal.throwIfAborted()
          return verifyFedcmIdToken(selected.token, {
            clientId: clientMetadata.client_id,
            nonce,
            resolve: resolveIdentity,
          }).then((identity) => {
            request.controller.signal.throwIfAborted()
            return onSelection(identity, request.controller.signal)
          })
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
    [cancel, onSelection, providers],
  )

  const requestActiveSelection = useCallback(
    () => requestSelection('active'),
    [requestSelection],
  )

  useEffect(() => {
    // @NOTE IdP registration: enabled by registered IdPs even with no URLs.
    if (!auto || (!providers.configUrls.length && !providers.idpRegistration))
      return

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
  }, [auto, cancel, providers, requestSelection])

  useEffect(() => cancel, [cancel])

  return { cancel, error, pending, requestActiveSelection }
}
