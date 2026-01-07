import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
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
