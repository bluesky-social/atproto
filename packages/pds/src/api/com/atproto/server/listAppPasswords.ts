import assert from 'node:assert'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { resultPassthru } from '../../../proxy'
import { forwardIp } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.listAppPasswords({
    auth: ctx.authVerifier.accessStandard(),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.listAppPasswords(
            undefined,
            await ctx
              .serviceAuthHeaders(
                auth.credentials.did,
                ctx.cfg.entryway.did,
                ids.ComAtprotoServerListAppPasswords,
              )
              .then((x) => forwardIp(req, x)),
          ),
        )
      }

      const passwords = await ctx.accountManager.listAppPasswords(
        auth.credentials.did,
      )
      return {
        encoding: 'application/json',
        body: { passwords },
      }
    },
  })
}
