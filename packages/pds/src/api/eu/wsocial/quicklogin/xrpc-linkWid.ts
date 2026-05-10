import { randomUUID } from 'node:crypto'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.quicklogin.linkWid({
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Any authenticated user may call this.
        // We check accountType inside the handler.
      },
    }),
    handler: async ({ auth, req }: any) => {
      if (!ctx.cfg.quicklogin) {
        throw new InvalidRequestError('QuickLogin not enabled')
      }

      const did = auth.credentials.did
      if (!did) {
        throw new AuthRequiredError()
      }

      // Only unverified accounts need to link — already-personal accounts are idempotently rejected.
      const account = await ctx.accountManager.getAccount(did)
      if (!account) {
        throw new InvalidRequestError('Account not found')
      }
      if (account.accountType !== 'unverified') {
        throw new InvalidRequestError(
          'Account is already linked to W Identity.',
          'WidAlreadyAssociated',
        )
      }

      // Register callback with provider (same flow as io.trustanchor.quicklogin.init)
      const providerUrl = `${ctx.cfg.quicklogin.apiBaseUrl}/QuickLogin`
      const callbackUrl = `${ctx.cfg.service.publicUrl}/xrpc/io.trustanchor.quicklogin.callback`

      req.log.info({ did, callbackUrl }, 'linkWid: registering with provider')

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
          'linkWid: provider registration failed',
        )
        throw new InvalidRequestError('Failed to initialize W Identity session')
      }

      const providerData = await providerResponse.json()
      const serviceId = (providerData as any).serviceId
      if (!serviceId) {
        req.log.error({ providerData }, 'linkWid: provider response missing serviceId')
        throw new InvalidRequestError('Invalid provider response')
      }

      // Create session with link_wid purpose and the authenticated DID as approvalDid
      const session = ctx.quickloginStore.createSession(
        false, // allowCreate=false: no new accounts from this flow
        serviceId,
        'link_wid',
        did,
      )

      // Fetch QR code image from provider
      const qrUrl = new URL('/QuickLogin', ctx.cfg.quicklogin.apiBaseUrl).toString()
      let qrResponse
      try {
        const qrRequestBody: Record<string, unknown> = {
          mode: 'image',
          purpose: 'Link W Identity to your W Social account',
          serviceId,
          tab: session.sessionId,
        }
        if (ctx.cfg.quicklogin.propertyFilter) {
          qrRequestBody.propertyFilter = ctx.cfg.quicklogin.propertyFilter
        }
        if (ctx.cfg.quicklogin.attachmentFilter !== undefined) {
          qrRequestBody.attachmentFilter = ctx.cfg.quicklogin.attachmentFilter
        }

        qrResponse = await ctx.safeFetch.call(undefined, qrUrl, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(qrRequestBody),
        })
      } catch (err) {
        req.log.error({ err, qrUrl }, 'linkWid: QR fetch failed')
        throw new InvalidRequestError('QR code fetch failed')
      }

      if (!qrResponse.ok) {
        const body = await qrResponse.text()
        req.log.error({ status: qrResponse.status, body }, 'linkWid: QR code failed')
        throw new InvalidRequestError('QR code generation failed')
      }

      const qrData = await qrResponse.json()
      if (!(qrData as any).src || !(qrData as any).signUrl) {
        req.log.error({ qrData }, 'linkWid: QR data missing src or signUrl')
        throw new InvalidRequestError('Invalid QR response')
      }

      const signUrl = (qrData as any).signUrl as string
      const signKey = signUrl.split(',')[1]
      if (!signKey) {
        req.log.error({ signUrl }, 'linkWid: could not extract key from signUrl')
        throw new InvalidRequestError('Invalid signUrl format')
      }

      ctx.quickloginStore.updateSessionKey(session.sessionId, signKey)

      req.log.info(
        { did, sessionId: session.sessionId },
        'linkWid session initialized',
      )

      return {
        encoding: 'application/json',
        body: {
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
          qrCodeUrl: (qrData as any).src as string,
          expiresAt: session.expiresAt,
        },
      }
    },
  })
}
