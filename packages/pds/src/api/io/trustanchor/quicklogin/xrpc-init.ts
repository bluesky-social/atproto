import { randomUUID } from 'node:crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.quicklogin.init({
    handler: async ({ input, req }) => {
      if (!ctx.cfg.quicklogin) {
        throw new InvalidRequestError('QuickLogin not enabled')
      }

      const allowCreate = input.body?.allowCreate ?? true

      // Call provider to register session
      const providerUrl = `${ctx.cfg.quicklogin.apiBaseUrl}/QuickLogin`
      // Use XRPC endpoint for callback when called via XRPC
      const callbackUrl = `${ctx.cfg.service.publicUrl}/xrpc/io.trustanchor.quicklogin.callback`

      // Create temporary session ID for provider registration
      const tempSessionId = randomUUID()

      const providerResponse = await fetch(providerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: callbackUrl,
          sessionId: tempSessionId,
        }),
      })

      if (!providerResponse.ok) {
        const errorText = await providerResponse.text()
        req.log.error(
          { status: providerResponse.status, error: errorText },
          'Provider registration failed',
        )
        throw new InvalidRequestError('Failed to initialize QuickLogin session')
      }

      const providerData = await providerResponse.json()
      const serviceId = (providerData as any).serviceId

      if (!serviceId) {
        req.log.error({ providerData }, 'Provider response missing serviceId')
        throw new InvalidRequestError('Invalid provider response')
      }

      // Create session in our store
      const session = ctx.quickloginStore.createSession(allowCreate, serviceId)

      // Fetch QR code from provider
      const qrUrl = new URL(
        '/QuickLogin',
        ctx.cfg.quicklogin.apiBaseUrl,
      ).toString()
      let qrResponse
      try {
        qrResponse = await ctx.safeFetch.call(undefined, qrUrl, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: 'image',
            purpose: 'QuickLogin for PDS',
            serviceId,
            tab: session.sessionId,
          }),
        })
      } catch (err) {
        req.log.error({ err, qrUrl }, 'QR fetch request failed')
        throw new InvalidRequestError('QR code fetch failed')
      }

      if (!qrResponse.ok) {
        const body = await qrResponse.text()
        req.log.error(
          { status: qrResponse.status, body },
          'QR code fetch failed',
        )
        throw new InvalidRequestError('QR code generation failed')
      }

      const qrData = await qrResponse.json()
      req.log.info({ qrData }, 'QR code received (XRPC)')

      if (!(qrData as any).src || !(qrData as any).signUrl) {
        req.log.error({ qrData }, 'QR data missing src or signUrl')
        throw new InvalidRequestError('Invalid QR response')
      }

      // Extract the key from signUrl (format: "tagsign:provider,KEY")
      const signUrl = (qrData as any).signUrl as string
      const signKey = signUrl.split(',')[1]
      if (!signKey) {
        req.log.error({ signUrl }, 'Could not extract key from signUrl')
        throw new InvalidRequestError('Invalid signUrl format')
      }

      // Update session with the signKey for callback lookup
      ctx.quickloginStore.updateSessionKey(session.sessionId, signKey)

      req.log.info(
        { sessionId: session.sessionId, serviceId, signKey },
        'QuickLogin session initialized (XRPC)',
      )

      return {
        encoding: 'application/json',
        body: {
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
          serviceId,
          expiresAt: session.expiresAt,
          providerBaseUrl: ctx.cfg.quicklogin.apiBaseUrl,
        },
      }
    },
  })
}
