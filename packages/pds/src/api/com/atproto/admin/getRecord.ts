import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mergeRepoViewPdsDetails } from './util'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getRecord({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params, auth }) => {
      const access = auth.credentials
      const { db, services } = ctx
      const { uri: uriStr, cid } = params
      const uri = new AtUri(uriStr)

      if (ctx.cfg.bskyAppView.proxyModeration) {
        try {
          const [{ data: recordDetailAppview }, account] = await Promise.all([
            ctx.appViewAgent.com.atproto.admin.getRecord(
              params,
              authPassthru(req),
            ),
            services.account(db).getAccount(uri.host, true),
          ])
          const localRepoView =
            account &&
            (await services.moderation(db).views.repo(account, {
              includeEmails: access.moderator,
            }))
          if (localRepoView) {
            recordDetailAppview.repo = mergeRepoViewPdsDetails(
              recordDetailAppview.repo,
              localRepoView,
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

      // @TODO when proxying fetch repo info directly rather than via record
      const result = await services.record(db).getRecord(uri, cid ?? null, true)
      const recordDetail =
        result &&
        (await services.moderation(db).views.recordDetail(result, {
          includeEmails: access.moderator,
        }))

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
