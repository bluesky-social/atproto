import { sql } from 'kysely'
import PQueue from 'p-queue'
import { AppContext } from '../context'

export const forEachActorStore = async (
  ctx: AppContext,
  opts: { concurrency?: number },
  fn: (ctx: AppContext, did: string) => Promise<string>,
) => {
  const { concurrency = 1 } = opts

  const queue = new PQueue({ concurrency })
  const actorQb = ctx.accountManager.db.db
    .selectFrom('actor')
    .selectAll()
    .limit(2 * concurrency)
  let cursor: { createdAt: string; did: string } | undefined
  do {
    const actors = cursor
      ? await actorQb
          .where(
            sql`("createdAt", "did")`,
            '>',
            sql`(${cursor.createdAt}, ${cursor.did})`,
          )
          .execute()
      : await actorQb.execute()
    queue.addAll(
      actors.map(({ did }) => {
        return () => fn(ctx, did)
      }),
    )
    cursor = actors.at(-1)
    await queue.onEmpty() // wait for all remaining items to be in process, then move on to next page
  } while (cursor)

  // finalize remaining work
  await queue.onIdle()
}
