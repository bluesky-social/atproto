import { parseRepoSeqRows } from '../../sequencer'
import { rebuildRepo } from '../rebuild-repo'
import { RecovererContext, processSeqEvt } from './recoverer'

export const repairRepos = async (ctx: RecovererContext) => {
  const repairRes = await ctx.recoveryDb.db
    .selectFrom('failed')
    .select('did')
    .where('failed.fixed', '=', 0)
    .execute()
  const dids = repairRes.map((row) => row.did)
  let fixed = 0
  for (const did of dids) {
    await rebuildRepo(ctx, did, false)
    await recoverFromSequencer(ctx, did)
    fixed++
    console.log(`${fixed}/${dids.length}`)
  }
}

const recoverFromSequencer = async (ctx: RecovererContext, did: string) => {
  const didEvts = await ctx.sequencer.db.db
    .selectFrom('repo_seq')
    .selectAll()
    .where('did', '=', did)
    .orderBy('seq', 'asc')
    .execute()
  const seqEvts = parseRepoSeqRows(didEvts)
  for (const evt of seqEvts) {
    await processSeqEvt(ctx, evt)
  }
  await ctx.recoveryDb.db
    .updateTable('failed')
    .set({
      fixed: 1,
      error: null,
    })
    .where('did', '=', did)
    .execute()
}
