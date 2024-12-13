import { Server } from '../../lexicon'
import AppContext from '../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { SubjectBasicView } from '../../lexicon/types/tools/ozone/history/defs'
import * as ActorDefs from '../../lexicon/types/app/bsky/actor/defs'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getAccountActions({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, account, sortDirection } = params
      const db = ctx.db

      // Allow admins to check mod history for any reporter
      let viewerDid: string | null
      if (access.type === 'admin_token') {
        if (!account) {
          throw new Error('Admins must provide an account param')
        }
        viewerDid = account
      } else if (access.iss) {
        viewerDid = access.iss
      } else {
        throw new InvalidRequestError('unauthorized')
      }

      const modHistoryService = ctx.modStatusHistoryService(db)
      const modService = ctx.modService(db)
      const results = await modHistoryService.getStatuses({
        viewerDid,
        forAuthor: true,
        limit,
        cursor,
        sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      })

      const subjects: SubjectBasicView[] = []
      const uris = new Set<string>()

      for (const item of results.statuses) {
        uris.add(modHistoryService.atUriFromStatus(item))
      }

      const [accountInfos, labels] = await Promise.all([
        modService.views.getAccoutInfosByDid([viewerDid]),
        modService.views.labels(Array.from(uris)),
      ])

      for (const item of results.statuses) {
        const view = modHistoryService.basicView(item)
        const accountInfo = accountInfos.get(item.did)
        const subjectProfile = accountInfo?.relatedRecords?.find(
          ActorDefs.isProfileViewBasic,
        )

        subjects.push({
          ...view,
          subjectProfile,
          labels: labels.get(view.subject),
          status: accountInfo
            ? accountInfo?.deactivatedAt
              ? 'deactivated'
              : 'active'
            : 'deleted',
        })
      }

      return {
        encoding: 'application/json',
        body: {
          subjects,
          cursor: results.cursor,
        },
      }
    },
  })
}
