// import { IdResolver } from '@atproto/identity'
// import { AccountManager } from '../../account-manager/account-manager'
// import { ActorStore } from '../../actor-store/actor-store'
// import { BackgroundQueue } from '../../background'
// import { Crawlers } from '../../crawlers'
// import { Sequencer } from '../../sequencer'
import { parseIntArg } from '../util'
import { Recoverer, RecovererContextNoDb } from './recoverer'
import { getRecoveryDbFromSequencerLoc } from './recovery-db'

export const sequencerRecovery = async (
  ctx: RecovererContextNoDb,
  args: string[],
) => {
  const cursor = args[0] ? parseIntArg(args[0]) : 0
  const concurrency = args[1] ? parseIntArg(args[1]) : 10

  const recoveryDb = await getRecoveryDbFromSequencerLoc(
    ctx.sequencer.dbLocation,
  )

  const recover = new Recoverer(
    { ...ctx, recoveryDb },
    {
      concurrency,
    },
  )
  await recover.run(cursor)
}

// const run = async () => {
//   const backgroundQueue = new BackgroundQueue()
//   const sequencer = new Sequencer(
//     './backup/sequencer.sqlite',
//     new Crawlers('', [], backgroundQueue),
//   )
//   const actorStore = new ActorStore(
//     {
//       directory: './backup/actors',
//       cacheSize: 0,
//       disableWalAutoCheckpoint: false,
//     },
//     { blobstore: () => ({}) as any, backgroundQueue },
//   )

//   const accountManager = new AccountManager(
//     new IdResolver(),
//     {} as any, // jwtKey
//     'did:example:serviceDid',
//     [], // service handle domains
//     {
//       accountDbLoc: './backup/account.sqlite',
//       disableWalAutoCheckpoint: false,
//     },
//   )
//   const recoveryDb = await getAndMigrateRecoveryDb('./backup/recovery.sqlite')
//   const ctx = { sequencer, accountManager, actorStore, recoveryDb }
//   return sequencerRecovery(ctx, [])
// }

// run()
