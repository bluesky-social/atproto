import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import getPreferences from './getPreferences'
import getPrivacySettings from './getPrivacySettings'
import getProfile from './getProfile'
import getProfiles from './getProfiles'
import putPreferences from './putPreferences'
import setPrivacySettings from './setPrivacySettings'

export default function (server: Server, ctx: AppContext) {
  getPreferences(server, ctx)
  getPrivacySettings(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  putPreferences(server, ctx)
  setPrivacySettings(server, ctx)
}
