import type { AtUriString, DidString, Unknown$TypedObject } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfos } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getSubjects, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const { subjects } = params
      const db = ctx.db
      const labelers = ctx.reqLabelers(req)
      const uris = new Set<string>()
      const dids = new Set<string>()

      for (const subject of subjects) {
        if (subject.startsWith('did:')) {
          dids.add(subject)
        }
        if (subject.startsWith('at://')) {
          uris.add(subject)
          dids.add(new AtUri(subject).host)
        }
      }

      const didsArray = Array.from(dids) as DidString[]
      const modViews = ctx.modService(db).views
      const [partialRepos, accountInfo, recordInfo, profiles] =
        await Promise.all([
          modViews.repoDetails(didsArray, labelers),
          getPdsAccountInfos(ctx, didsArray),
          modViews.recordDetails(
            Array.from(uris).map((uri) => ({ uri: uri as AtUriString })),
            labelers,
          ),
          modViews.getProfiles(didsArray),
        ])

      const missingSubjects: string[] = []
      const subjectWithDetails = new Map<
        string,
        tools.ozone.moderation.defs.SubjectView
      >()

      for (const subject of subjects) {
        const type = subject.startsWith('did:') ? 'account' : 'record'
        const did = type === 'account' ? subject : new AtUri(subject).host
        const partialRepo = partialRepos.get(did)
        const repo = partialRepo
          ? addAccountInfoToRepoViewDetail(
              partialRepo,
              accountInfo.get(did) || null,
              auth.credentials.isModerator,
            )
          : undefined
        const profile = profiles.get(did)
        const record = type === 'record' ? recordInfo.get(subject) : undefined
        const status =
          type === 'record'
            ? record?.moderation.subjectStatus
            : repo?.moderation.subjectStatus

        subjectWithDetails.set(subject, {
          type,
          repo,
          record,
          profile:
            profile &&
            ({
              $type: 'app.bsky.actor.defs#profileViewDetailed',
              ...profile,
            } as unknown as Unknown$TypedObject),
          status,
          subject,
        })

        if ((type === 'record' && !record) || (type === 'account' && !repo)) {
          missingSubjects.push(subject)
        }
      }

      // When a subject is repo or record but the repo/record was deleted, we still want to attach moderation status if any exists
      const missingSubjectStatuses =
        await modViews.getSubjectStatus(missingSubjects)

      for (const [subject, status] of missingSubjectStatuses) {
        const subjectView = subjectWithDetails.get(subject)
        if (subjectView)
          subjectView.status = modViews.formatSubjectStatus(status)
      }

      const allSubjects: tools.ozone.moderation.defs.SubjectView[] = []
      for (const subject of subjects) {
        const subjectView = subjectWithDetails.get(subject)
        if (subjectView) allSubjects.push(subjectView)
      }

      return {
        encoding: 'application/json',
        body: { subjects: allSubjects },
      }
    },
  })
}
