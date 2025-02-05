import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import getPreferences from './getPreferences'
import getProfile from './getProfile'
import getProfiles from './getProfiles'
import putPreferences from './putPreferences'

export default function (server: Server, ctx: AppContext) {
  getPreferences(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  putPreferences(server, ctx)
}
