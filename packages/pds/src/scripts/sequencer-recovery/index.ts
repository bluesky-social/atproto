import { AccountManager } from '../../account-manager'
import { ActorStore } from '../../actor-store'
import { BackgroundQueue } from '../../background'
import { Crawlers } from '../../crawlers'
import { Sequencer } from '../../sequencer'
import { parseIntArg } from '../util'
import { Recoverer, RecovererContext } from './recoverer'

export const sequencerRecovery = async (
  ctx: RecovererContext,
  args: string[],
) => {
  const cursor = args[0] ? parseIntArg(args[0]) : 0
  const concurrency = args[1] ? parseIntArg(args[1]) : 10

  const recover = new Recoverer(ctx, {
    cursor,
    concurrency,
  })
  await recover.run()
}

const run = async () => {
  const backgroundQueue = new BackgroundQueue()
  const sequencer = new Sequencer(
    './backup/sequencer.sqlite',
    new Crawlers('', [], backgroundQueue),
  )
  const accountManager = new AccountManager(
    backgroundQueue,
    './backup/account.sqlite',
    {} as any,
    '',
  )
  const actorStore = new ActorStore(
    {
      directory: './backup/actors',
      cacheSize: 0,
      disableWalAutoCheckpoint: false,
    },
    { blobstore: () => ({}) as any, backgroundQueue },
  )
  const ctx = { sequencer, accountManager, actorStore }
  return sequencerRecovery(ctx, [])
}

run()
