import { type LexValue, l } from '@atproto/lex'
import { XRPCError } from '@atproto/xrpc'
import { type AuthResult, InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import type { Server } from '../../../../lexicon/index.js'
import { ids } from '../../../../lexicon/lexicons.js'

const getPreferences = l.query(
  ids.AppBskyActorGetPreferences,
  l.params({ did: l.string({ format: 'did' }) }),
  l.jsonPayload({ preferences: l.array(l.lexValue()) }),
)

export default function (server: Server, ctx: AppContext) {
  server.xrpc.add(getPreferences, {
    auth: async (authCtx): Promise<AuthResult> =>
      ctx.authVerifier.modOrAdminToken(authCtx),
    handler: async ({ params }) => {
      if (!ctx.pdsAgent || !ctx.cfg.pds) {
        throw new InvalidRequestError('PDS not configured')
      }

      // @NOTE `did` is an internal moderator parameter omitted from the public
      // Lexicon, so the generated client rejects it before sending.
      const url = new URL(
        '/xrpc/app.bsky.actor.getPreferences',
        ctx.cfg.pds.url,
      )
      url.searchParams.set('did', params.did)
      const auth = await ctx.pdsAuth(ids.AppBskyActorGetPreferences)
      const res = await fetch(url, {
        headers: auth?.headers,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        await res.body?.cancel()
        throw new XRPCError(res.status, undefined, 'Failed to get preferences')
      }
      const body = (await res.json()) as { preferences: LexValue[] }
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
