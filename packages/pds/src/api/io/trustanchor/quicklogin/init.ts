import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { AppContext } from '../../../../context'
import { dbLogger as logger } from '../../../../logger'

export function initQuickLogin(router: Router, ctx: AppContext) {
  router.post('/api/quicklogin/init', async (req, res) => {
    try {
      if (!ctx.cfg.quicklogin) {
        return res.status(400).json({ error: 'QuickLogin not enabled' })
      }

      const allowCreate = req.body?.allowCreate ?? true

      // Call provider to register session
      const providerUrl = `${ctx.cfg.quicklogin.apiBaseUrl}/QuickLogin`
      const callbackUrl = `${ctx.cfg.service.publicUrl}/api/quicklogin/callback`

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
        return res
          .status(500)
          .json({ error: 'Failed to initialize QuickLogin session' })
      }

      const providerData = await providerResponse.json()
      const serviceId = (providerData as any).serviceId

      if (!serviceId) {
        req.log.error({ providerData }, 'Provider response missing serviceId')
        return res.status(500).json({ error: 'Invalid provider response' })
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
        return res.status(500).json({ error: 'QR code fetch failed' })
      }

      if (!qrResponse.ok) {
        const body = await qrResponse.text()
        req.log.error(
          { status: qrResponse.status, body },
          'QR code fetch failed',
        )
        return res.status(500).json({ error: 'QR code generation failed' })
      }

      const qrData = await qrResponse.json()
      req.log.info({ qrData }, 'QR code received')

      if (!(qrData as any).src || !(qrData as any).signUrl) {
        req.log.error({ qrData }, 'QR data missing src or signUrl')
        return res.status(500).json({ error: 'Invalid QR response' })
      }

      // Extract the key from signUrl (format: "tagsign:provider,KEY")
      const signUrl = (qrData as any).signUrl as string
      const signKey = signUrl.split(',')[1]
      if (!signKey) {
        req.log.error({ signUrl }, 'Could not extract key from signUrl')
        return res.status(500).json({ error: 'Invalid signUrl format' })
      }

      // Update session with the signKey for callback lookup
      ctx.quickloginStore.updateSessionKey(session.sessionId, signKey)

      req.log.info(
        { sessionId: session.sessionId, serviceId, signKey },
        'QuickLogin session initialized',
      )

      return res.json({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        serviceId,
        expiresAt: session.expiresAt,
        qrCodeUrl: (qrData as any).src,
        signUrl: (qrData as any).signUrl,
      })
    } catch (error: any) {
      req.log.error(
        {
          error: error?.message || error,
          stack: error?.stack,
          cause: error?.cause,
        },
        'QuickLogin init failed',
      )
      return res.status(500).json({ error: 'Internal server error' })
    }
  })
}
