import { HOUR } from '@atproto/common'
import { BackgroundQueue, PeriodicBackgroundTask } from '../background'
import { TeamService } from '../team'

export class TeamProfileSynchronizer extends PeriodicBackgroundTask {
  constructor(
    backgroundQueue: BackgroundQueue,
    teamService: TeamService,
    interval = 24 * HOUR,
  ) {
    super(backgroundQueue, interval, async () => {
      await teamService.syncMemberProfiles()
    })
  }
}
