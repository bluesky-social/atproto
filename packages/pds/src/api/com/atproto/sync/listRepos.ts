import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Cursor, GenericKeyset, paginate } from '../../../../db/pagination'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.listRepos(async ({ params }) => {
    const { limit, cursor } = params
    const { ref } = ctx.db.db.dynamic
    let builder = ctx.db.db
      .selectFrom('user_account')
      .innerJoin('repo_root', 'repo_root.did', 'user_account.did')
      .where(notSoftDeletedClause(ref('repo_root')))
      .select([
        'user_account.did as did',
        'repo_root.root as head',
        'user_account.createdAt as createdAt',
      ])
    const keyset = new TimeDidKeyset(
      ref('user_account.createdAt'),
      ref('user_account.did'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      direction: 'asc',
      tryIndex: true,
    })
    const res = await builder.execute()
    const repos = res.map((row) => ({ did: row.did, head: row.head }))
    return {
      encoding: 'application/json',
      body: {
        cursor: keyset.packFromResult(res),
        repos,
      },
    }
  })
}

type TimeDidResult = { createdAt: string; did: string }

export class TimeDidKeyset extends GenericKeyset<TimeDidResult, Cursor> {
  labelResult(result: TimeDidResult): Cursor {
    return { primary: result.createdAt, secondary: result.did }
  }
  labeledResultToCursor(labeled: Cursor) {
    return {
      primary: new Date(labeled.primary).getTime().toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    const primaryDate = new Date(parseInt(cursor.primary, 10))
    if (isNaN(primaryDate.getTime())) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: primaryDate.toISOString(),
      secondary: cursor.secondary,
    }
  }
}
