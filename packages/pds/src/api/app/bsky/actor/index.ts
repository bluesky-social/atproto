import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import getPreferences from './getPreferences.js'
import getProfile from './getProfile.js'
import getProfiles from './getProfiles.js'
import putPreferences from './putPreferences.js'

export default function (server: Server, ctx: AppContext) {
  getPreferences(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  putPreferences(server, ctx)
}
