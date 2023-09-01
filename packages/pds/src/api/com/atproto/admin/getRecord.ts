import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, mergeRepoViewPdsDetails } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.roleVerifier,
    handler: async ({ req, params, auth }) => {
      const access = auth.credentials
      const { db, services } = ctx
      const { uri, cid } = params
      const result = await services
        .record(db)
        .getRecord(new AtUri(uri), cid ?? null, true)
      const recordDetail =
        result &&
        (await services.moderation(db).views.recordDetail(result, {
          includeEmails: access.moderator,
        }))

      if (ctx.shouldProxyModeration()) {
        try {
          const { data: recordDetailAppview } =
            await ctx.appviewAgent.com.atproto.admin.getRecord(
              params,
              authPassthru(req),
            )
          if (recordDetail) {
            recordDetailAppview.repo = mergeRepoViewPdsDetails(
              recordDetailAppview.repo,
              recordDetail.repo,
            )
          }
          return {
            encoding: 'application/json',
            body: recordDetailAppview,
          }
        } catch (err) {
          if (err && err['error'] === 'RecordNotFound') {
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
