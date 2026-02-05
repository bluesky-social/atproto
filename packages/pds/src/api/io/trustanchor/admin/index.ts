import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import listInvitations from './listInvitations'
import getInvitationStats from './getInvitationStats'
import deleteInvitation from './deleteInvitation'
import purgeInvitations from './purgeInvitations'

export default function (server: Server, ctx: AppContext) {
  listInvitations(server, ctx)
  getInvitationStats(server, ctx)
  deleteInvitation(server, ctx)
  purgeInvitations(server, ctx)
}
