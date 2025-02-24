import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import createReport from './createReport'

export default function (server: Server, ctx: AppContext) {
  createReport(server, ctx)
}
