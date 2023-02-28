import api from './api'
import AppContext from '../context'
import { Server } from '../lexicon'
import { RepoSubscription } from './subscription/repo'
import * as dispatcherConsumers from './event-stream/consumers'

export class AppView {
  api = (server: Server) => api(server, this.ctx)
  services = this.ctx.services.appView
  repoSubscription = new RepoSubscription(this.ctx)
  constructor(public ctx: AppContext) {}
  start() {
    dispatcherConsumers.listen(this.ctx)
    this.repoSubscription.run()
    return this
  }
  destroy() {
    this.repoSubscription.destroy()
  }
}
