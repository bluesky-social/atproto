import { jitter, wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import { PrimaryDatabase } from '.'

export const VIEW_MAINTAINER_ID = 1010
const VIEWS = ['algo_whats_hot_view']

export class ViewMaintainer {
  leader = new Leader(VIEW_MAINTAINER_ID, this.db)
  destroyed = false

  // @NOTE the db must be authed as the owner of the materialized view, per postgres.
  constructor(public db: PrimaryDatabase, public intervalSec = 60) {}

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          await this.db.maintainMaterializedViews({
            signal,
            views: VIEWS,
            intervalSec: this.intervalSec,
          })
        })
        if (ran && !this.destroyed) {
          throw new Error('View maintainer completed, but should be persistent')
        }
      } catch (err) {
        dbLogger.error(
          {
            err,
            views: VIEWS,
            intervalSec: this.intervalSec,
            lockId: VIEW_MAINTAINER_ID,
          },
          'view maintainer errored',
        )
      }
      if (!this.destroyed) {
        await wait(10000 + jitter(2000))
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy()
  }
}
