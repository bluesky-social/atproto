import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getPreferences from './getPreferences'
import putPreferences from './putPreferences'

export default function (server: Server, ctx: AppContext) {
  getPreferences(server, ctx)
  putPreferences(server, ctx)
}
