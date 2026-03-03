import { randomUUID } from 'node:crypto'
import { DAY, HOUR } from '@atproto/common'
import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../auth-scope'
import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.server.requestAccountDeleteWID({
    rateLimit: [
      {
        durationMs: DAY,
        points: 15,
        calcKey: ({ auth }) => auth.credentials.did,
      },
      {
        durationMs: HOUR,
        points: 5,
        calcKey: ({ auth }) => auth.credentials.did,
      },
    ],
    // Mirror requestAccountDelete: require full access scope, block OAuth tokens
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      scopes: ACCESS_FULL,
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: async ({ req, auth }) => {
      if (!ctx.cfg.quicklogin) {
        throw new InvalidRequestError(
          'QuickLogin is not configured on this server.',
        )
      }

      const did = auth.credentials.did

      // Verify this is a WID-linked account
      const link = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select(['did'])
        .where('did', '=', did)
        .executeTakeFirst()

      if (!link) {
        throw new InvalidRequestError(
          'No linked WID identity found for this account.',
        )
      }

      const account = await ctx.accountManager.getAccount(did)

      // Step 1: Register session with Neuro provider
      const callbackUrl = `${ctx.cfg.service.publicUrl}/xrpc/io.trustanchor.quicklogin.callback`
      const tempSessionId = randomUUID()

      const providerResponse = await fetch(
        new URL('/QuickLogin', ctx.cfg.quicklogin.apiBaseUrl).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: callbackUrl,
            sessionId: tempSessionId,
          }),
        },
      )

      if (!providerResponse.ok) {
        const errorText = await providerResponse.text()
        req.log.error(
          { status: providerResponse.status, error: errorText },
          'Provider registration failed for WID deletion',
        )
        throw new InvalidRequestError(
          'Failed to reach WID service. Please try again.',
        )
      }

      const providerData = await providerResponse.json()
      const serviceId = (providerData as any).serviceId

      if (!serviceId) {
        req.log.error({ providerData }, 'Provider response missing serviceId')
        throw new InvalidRequestError('Invalid provider response')
      }

      // Create approval session in the store
      const session = ctx.quickloginStore.createSession(
        false,
        serviceId,
        'delete_account',
        did,
      )

      // Step 2: Fetch QR code image from provider
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
            purpose: `Confirm deletion of account @${account?.handle ?? did}`,
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

      if (!(qrData as any).src || !(qrData as any).signUrl) {
        req.log.error({ qrData }, 'QR data missing src or signUrl')
        throw new InvalidRequestError('Invalid QR response from WID service')
      }

      const signUrl = (qrData as any).signUrl as string
      const signKey = signUrl.split(',')[1]
      if (!signKey) {
        req.log.error({ signUrl }, 'Could not extract key from signUrl')
        throw new InvalidRequestError('Invalid signUrl format from WID service')
      }

      ctx.quickloginStore.updateSessionKey(session.sessionId, signKey)

      req.log.info(
        { did, sessionId: session.sessionId },
        'QuickLogin approval session started for account deletion',
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
