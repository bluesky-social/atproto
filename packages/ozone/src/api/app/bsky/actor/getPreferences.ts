import { type LexValue, l } from '@atproto/lex'
import {
  type AuthResult,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { UpstreamHttpError } from '../../../../util.js'

const getPreferences = l.query(
  app.bsky.actor.getPreferences.$lxm,
  l.params({ did: l.string({ format: 'did' }) }),
  l.jsonPayload({ preferences: l.array(l.lexValue()) }),
)

export default function (server: Server, ctx: AppContext) {
  server.add(getPreferences, {
    auth: async (authCtx): Promise<AuthResult> =>
      ctx.authVerifier.modOrAdminToken(authCtx),
    handler: async ({ params }) => {
      if (!ctx.pdsClient || !ctx.cfg.pds) {
        throw new InvalidRequestError('PDS not configured')
      }

      // @NOTE `did` is an internal moderator parameter omitted from the public
      // Lexicon, so the generated client rejects it before sending.
      const url = new URL(
        '/xrpc/app.bsky.actor.getPreferences',
        ctx.cfg.pds.url,
      )
      url.searchParams.set('did', params.did)
      const auth = await ctx.pdsAuth(app.bsky.actor.getPreferences.$lxm)
      const res = await fetch(url, {
        headers: auth?.headers,
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        await res.body?.cancel()
        throw new UpstreamHttpError(res.status, 'Failed to get preferences')
      }
      const body = (await res.json()) as { preferences: LexValue[] }
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
