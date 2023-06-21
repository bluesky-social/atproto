import { AtUri } from '@atproto/uri'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { RecordNotFoundError } from '@atproto/api/src/client/types/com/atproto/admin/getRecord'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.moderatorVerifier,
    handler: async ({ req, params }) => {
      const { db, services } = ctx
      const { uri, cid } = params
      const result = await services
        .record(db)
        .getRecord(new AtUri(uri), cid ?? null, true)
      const recordDetail =
        result && (await services.moderation(db).views.recordDetail(result))

      if (ctx.shouldProxyModeration()) {
        try {
          const { data: recordDetailAppview } =
            await ctx.appviewAgent.com.atproto.admin.getRecord(
              params,
              authPassthru(req),
            )
          recordDetailAppview.repo.email ??= recordDetail?.repo.email
          recordDetailAppview.repo.invitedBy ??= recordDetail?.repo.invitedBy
          recordDetailAppview.repo.invitesDisabled ??=
            recordDetail?.repo.invitesDisabled
          return {
            encoding: 'application/json',
            body: recordDetailAppview,
          }
        } catch (err) {
          if (err instanceof RecordNotFoundError) {
            throw new InvalidRequestError('Record not found', 'RecordNotFound')
          } else {
            throw err
          }
        }
      }

      if (!recordDetail) {
        throw new InvalidRequestError('Record not found', 'RecordNotFound')
      }
      return {
        encoding: 'application/json',
        body: recordDetail,
      }
    },
  })
}
