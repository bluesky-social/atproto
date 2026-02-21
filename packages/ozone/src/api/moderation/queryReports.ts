import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { queryReports } from '../../mod-service/report'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfos } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.queryReports({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth, req }) => {
      const db = ctx.db
      const modService = ctx.modService(db)
      const labelers = ctx.reqLabelers(req)

      // Query reports using the service
      const { reports: reportsToReturn, cursor } = await queryReports(
        db,
        params,
      )

      // Collect all unique DIDs and URIs for subject details
      const dids = new Set<string>()
      const uris = new Set<string>()

      for (const report of reportsToReturn) {
        dids.add(report.subjectDid)
        dids.add(report.reportedBy)
        if (report.subjectUri) {
          uris.add(report.subjectUri)
        }
      }

      const didsArray = Array.from(dids)

      // Fetch subject details (similar to getSubjects.ts)
      const [partialRepos, accountInfo, recordInfo, profiles] =
        await Promise.all([
          modService.views.repoDetails(didsArray, labelers),
          getPdsAccountInfos(ctx, didsArray),
          modService.views.recordDetails(
            Array.from(uris).map((uri) => ({ uri })),
            labelers,
          ),
          modService.views.getProfiles(didsArray),
        ])

      // Format report views
      const reportViews = reportsToReturn.map((report) => {
        const isRecord = !!report.subjectUri
        const did = report.subjectDid
        const partialRepo = partialRepos.get(did)
        const repo = partialRepo
          ? addAccountInfoToRepoViewDetail(
              partialRepo,
              accountInfo.get(did) || null,
              auth.credentials.isModerator,
            )
          : undefined
        const profile = profiles.get(did)
        const record = isRecord ? recordInfo.get(report.subjectUri!) : undefined
        const status = isRecord
          ? record?.moderation.subjectStatus
          : repo?.moderation.subjectStatus

        const reportType = report.meta?.reportType as string

        // Build subject view (following getSubjects.ts pattern)
        // For accounts, subject should be { did: string }, for records it should be { uri: string, cid: string }
        const subject = isRecord
          ? {
              $type: 'com.atproto.repo.strongRef' as const,
              uri: report.subjectUri!,
              cid: report.subjectCid!,
            }
          : {
              $type: 'com.atproto.admin.defs#repoRef' as const,
              did: report.subjectDid,
            }
        const subjectView = {
          type: (isRecord ? 'record' : 'account') as 'record' | 'account',
          subject,
          repo,
          record,
          profile: profile
            ? {
                $type: 'app.bsky.actor.defs#profileViewDetailed' as const,
                ...profile,
              }
            : undefined,
          status,
        }

        // Build reporter view (always an account, never a record)
        const reporterDid = report.reportedBy
        const reporterPartialRepo = partialRepos.get(reporterDid)
        const reporterRepo = reporterPartialRepo
          ? addAccountInfoToRepoViewDetail(
              reporterPartialRepo,
              accountInfo.get(reporterDid) || null,
              auth.credentials.isModerator,
            )
          : undefined
        const reporterProfile = profiles.get(reporterDid)
        const reporterStatus = reporterRepo?.moderation.subjectStatus

        const reporterView = {
          type: 'account' as const,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef' as const,
            did: reporterDid,
          },
          repo: reporterRepo,
          profile: reporterProfile
            ? {
                $type: 'app.bsky.actor.defs#profileViewDetailed' as const,
                ...reporterProfile,
              }
            : undefined,
          status: reporterStatus,
        }

        return {
          id: report.id,
          eventId: report.eventId,
          queueId: report.queueId ?? undefined,
          queueName: undefined, // Will be populated when queue feature is implemented
          status: report.status,
          subject: subjectView,
          reportType,
          reportedBy: report.reportedBy,
          reporter: reporterView,
          comment: report.comment ?? undefined,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          queuedAt: report.queuedAt ?? undefined,
          actionEventIds:
            report.actionEventIds && Array.isArray(report.actionEventIds)
              ? (report.actionEventIds as number[])
              : undefined,
          actionNote: report.actionNote ?? undefined,
        }
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          reports: reportViews,
        },
      }
    },
  })
}
