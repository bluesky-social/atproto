import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getServices from './getServices'

export default function (server: Server, ctx: AppContext) {
  getServices(server, ctx)
}
