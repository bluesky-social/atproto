import { HOUR } from '@atproto/common'
import { BackgroundQueue, PeriodicBackgroundTask } from '../background'
import { AppviewCreator, TeamService } from '../team'

export class TeamProfileSynchronizer extends PeriodicBackgroundTask {
  constructor(
    backgroundQueue: BackgroundQueue,
    appviewCreator: AppviewCreator,
    teamService: TeamService,
    interval = 24 * HOUR,
  ) {
    super(backgroundQueue, interval, async (_, signal) => {
      if (signal.aborted) return
      await teamService.syncMemberProfiles(appviewCreator)
    })
  }
}
