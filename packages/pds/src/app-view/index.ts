import api from './api'
import AppContext from '../context'
import { Server } from '../lexicon'
import { RepoSubscription } from './subscription/repo'
import * as dispatcherConsumers from './event-stream/consumers'
import { appViewLogger } from './logger'

export class AppView {
  api = (server: Server) => api(server, this.ctx)
  services = this.ctx.services.appView
  repoSubscription?: RepoSubscription

  constructor(public ctx: AppContext) {
    if (ctx.cfg.appViewRepoProvider) {
      this.repoSubscription = new RepoSubscription(
        ctx,
        ctx.cfg.appViewRepoProvider,
      )
    }
  }

  start() {
    if (this.repoSubscription) {
      this.repoSubscription.run()
    } else {
      dispatcherConsumers.listen(this.ctx)
      appViewLogger.info('repo subscription disabled')
    }
    return this
  }

  destroy() {
    if (this.repoSubscription) {
      this.repoSubscription.destroy()
    }
  }
}
