import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationEvent({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const { id } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const event = await moderationService.getEventOrThrow(id)
      const [eventDetail, subjectStatus] = await Promise.all([
        moderationService.views.eventDetail(event),
        moderationService
          .getSubjectStatuses({
            limit: 1,
            sortDirection: 'desc',
            sortField: 'lastReportedAt',
            subject: event.subjectUri ? event.subjectUri : event.subjectDid,
          })
          .then((statuses) =>
            moderationService.views.subjectStatus(statuses[0]),
          ),
      ])
      return {
        encoding: 'application/json',
        body: { ...eventDetail, subjectStatus },
      }
    },
  })
}
