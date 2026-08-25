import {
  type AtUriString,
  type DidString,
  asUnknown$TypedObject,
  isDidString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { app, tools } from '../../lexicons/index.js'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfos } from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.getSubjects, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const parsedSubjects = params.subjects.map(parseSubject)

      const db = ctx.db
      const labelers = ctx.reqLabelers(req)
      const uris = new Set<AtUriString>()
      const dids = new Set<DidString>()

      for (const { type, subject, did } of parsedSubjects) {
        dids.add(did)
        if (type === 'record') uris.add(subject)
      }

      const didsArray = Array.from(dids)
      const modViews = ctx.modService(db).views
      const [partialRepos, accountInfo, recordInfo, profiles] =
        await Promise.all([
          modViews.repoDetails(didsArray, labelers),
          getPdsAccountInfos(ctx, didsArray),
          modViews.recordDetails(
            Array.from(uris).map((uri) => ({ uri })),
            labelers,
          ),
          modViews.getProfiles(didsArray),
        ])

      const missingSubjects: (AtUriString | DidString)[] = []
      const subjectWithDetails = new Map<
        string,
        tools.ozone.moderation.defs.SubjectView
      >()

      for (const { type, subject, did } of parsedSubjects) {
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

          profile: profile
            ? asUnknown$TypedObject(
                app.bsky.actor.defs.profileViewDetailed.$build(profile),
              )
            : undefined,
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
      for (const { subject } of parsedSubjects) {
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

function parseSubject(subject: string) {
  try {
    if (isDidString(subject)) {
      return {
        type: 'account' as const,
        subject,
        did: subject,
      }
    } else {
      const uri = new AtUri(subject)
      if (uri.href !== subject) {
        throw new InvalidRequestError(`Invalid subject: ${subject}`)
      }
      return {
        type: 'record' as const,
        subject: uri.href,
        did: uri.did,
      }
    }
  } catch (cause) {
    if (cause instanceof InvalidRequestError) throw cause
    // Convert AtUri parsing errors into InvalidRequestError
    throw new InvalidRequestError(`Invalid subject: ${subject}`, undefined, {
      cause,
    })
  }
}
