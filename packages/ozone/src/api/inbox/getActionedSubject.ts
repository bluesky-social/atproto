import type { AtUriString } from '@atproto/lex-schema'
import { AtUri, INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxViewerDid } from '../../inbox/access.js'
import { getSeenAt } from '../../inbox/seen.js'
import {
  findActionedSubject,
  getActionedSubjectDetail,
} from '../../inbox/subjects.js'
import { app, tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getActionedSubject, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const did = inboxViewerDid(auth, params.did)
      const subject = await findActionedSubject(ctx.db, did, params.subject)
      if (!subject)
        throw new InvalidRequestError('Subject not found', 'NotFound')
      const seenAt = await getSeenAt(ctx.db, did, 'subjects')
      const detail = await getActionedSubjectDetail(
        ctx.db,
        subject,
        ctx.cfg.service.did,
        ctx.cfg.inbox,
        seenAt,
        params,
      )
      if (!detail)
        throw new InvalidRequestError('Subject not found', 'NotFound')
      if (subject.isRecord()) {
        const records = await ctx
          .modService(ctx.db)
          .views.fetchRecords([{ uri: subject.uri, cid: subject.cid }])
        const record = records.get(subject.uri)?.value
        if (record !== undefined) {
          detail.record = record as NonNullable<typeof detail.record>
        }
      } else if (subject.isRepo()) {
        const views = ctx.modService(ctx.db).views
        const profileUri = AtUri.make(
          subject.did,
          app.bsky.actor.profile.$type,
          'self',
        ).toString() as AtUriString
        // @NOTE These lookups are optional; an unavailable profile must not
        // prevent the owner from reading or appealing a moderation action.
        const [records, accounts] = await Promise.all([
          views.fetchRecords([{ uri: profileUri }]).catch(() => undefined),
          views.getAccoutInfosByDid([subject.did]).catch(() => undefined),
        ])
        const profile = records?.get(profileUri)?.value
        const handle = accounts?.get(subject.did)?.handle
        if (profile !== undefined || (handle && handle !== INVALID_HANDLE)) {
          detail.account = {
            ...(handle && handle !== INVALID_HANDLE ? { handle } : {}),
            ...(profile !== undefined
              ? {
                  profile: profile as NonNullable<
                    tools.ozone.inbox.defs.AccountPreview['profile']
                  >,
                }
              : {}),
          }
        }
      }
      return { encoding: 'application/json', body: detail }
    },
  })
}
