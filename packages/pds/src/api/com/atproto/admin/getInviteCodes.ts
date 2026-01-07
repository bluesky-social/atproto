import { DatetimeString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import {
  CodeDetail,
  selectInviteCodesQb,
} from '../../../../account-manager/helpers/invite'
import { AppContext } from '../../../../context'
import {
  Cursor,
  GenericKeyset,
  LabeledResult,
  paginate,
} from '../../../../db/pagination'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  if (ctx.cfg.entryway) {
    server.add(com.atproto.admin.getInviteCodes, () => {
      throw new InvalidRequestError(
        'Account invites are managed by the entryway service',
      )
    })
    return
  }

  server.add(com.atproto.admin.getInviteCodes, {
    auth: ctx.authVerifier.moderator,
    handler: async ({
      params,
    }): Promise<com.atproto.admin.getInviteCodes.Output> => {
      const { sort, limit, cursor } = params
      const db = ctx.accountManager.db
      const keyset = createKeyset(ctx, sort)

      const builder = selectInviteCodesQb(db)

      const res = await paginate(builder, {
        limit,
        cursor,
        keyset,
      }).execute()

      const codes = res.map((row) => row.code)
      const uses = await ctx.accountManager.getInviteCodesUses(codes)

      const resultCursor = keyset.packFromResult(res)
      const codeDetails = res.map(
        ({ disabled, createdAt, ...row }): CodeDetail => ({
          ...row,
          createdAt: createdAt as DatetimeString,
          disabled: disabled === 1,
          uses: uses[row.code] ?? [],
        }),
      )

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: resultCursor,
          codes: codeDetails,
        },
      }
    },
  })
}

function createKeyset(ctx: AppContext, sort?: string): GenericKeyset<any, any> {
  const { ref } = ctx.accountManager.db.db.dynamic

  if (sort === 'recent') {
    return new TimeCodeKeyset(ref('createdAt'), ref('code'))
  }

  if (sort === 'usage') {
    return new UseCodeKeyset(ref('uses'), ref('code'))
  }

  throw new InvalidRequestError(`unknown sort method: ${sort}`)
}

type TimeCodeResult = { createdAt: string; code: string }

export class TimeCodeKeyset extends GenericKeyset<TimeCodeResult, Cursor> {
  labelResult(result: TimeCodeResult): Cursor {
    return { primary: result.createdAt, secondary: result.code }
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

type UseCodeResult = { uses: number; code: string }

export class UseCodeKeyset extends GenericKeyset<UseCodeResult, LabeledResult> {
  labelResult(result: UseCodeResult): LabeledResult {
    return { primary: result.uses, secondary: result.code }
  }
  labeledResultToCursor(labeled: Cursor) {
    return {
      primary: labeled.primary.toString(),
      secondary: labeled.secondary,
    }
  }
  cursorToLabeledResult(cursor: Cursor) {
    const primaryCode = parseInt(cursor.primary, 10)
    if (isNaN(primaryCode)) {
      throw new InvalidRequestError('Malformed cursor')
    }
    return {
      primary: primaryCode,
      secondary: cursor.secondary,
    }
  }
}
