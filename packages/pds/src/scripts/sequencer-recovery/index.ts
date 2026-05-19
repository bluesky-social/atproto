import { parseIntArg } from '../util.js'
import { Recoverer, RecovererContextNoDb } from './recoverer.js'
import { getRecoveryDbFromSequencerLoc } from './recovery-db.js'

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
