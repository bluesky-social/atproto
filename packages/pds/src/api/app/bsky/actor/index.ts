import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getPreferences from './getPreferences'
import getProfile from './getProfile'
import getProfiles from './getProfiles'
import getSuggestions from './getSuggestions'
import putPreferences from './putPreferences'
import searchActors from './searchActors'
import searchActorsTypeahead from './searchActorsTypeahead'

export default function (server: Server, ctx: AppContext) {
  getPreferences(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getSuggestions(server, ctx)
  putPreferences(server, ctx)
  searchActors(server, ctx)
  searchActorsTypeahead(server, ctx)
}
