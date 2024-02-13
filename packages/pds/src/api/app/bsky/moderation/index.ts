import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getService from './getService'
import getServices from './getServices'

export default function (server: Server, ctx: AppContext) {
  getService(server, ctx)
  getServices(server, ctx)
}
