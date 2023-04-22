import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  LabeledResult,
  Cursor,
  GenericKeyset,
  paginate,
} from '../../../../db/pagination'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getInviteCodes({
    auth: ctx.moderatorVerifier,
    handler: async ({ params }) => {
      const { sort, limit, cursor } = params
      const ref = ctx.db.db.dynamic.ref
      let keyset
      if (sort === 'recent') {
        keyset = new TimeCodeKeyset(ref('createdAt'), ref('code'))
      } else if (sort === 'usage') {
        keyset = new UseCodeKeyset(ref('uses'), ref('code'))
      } else {
        throw new InvalidRequestError(`unknown sort method: ${sort}`)
      }

      const accntSrvc = ctx.services.account(ctx.db)

      let builder = accntSrvc.selectInviteCodesQb()
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const res = await builder.execute()

      const codes = res.map((row) => row.code)
      const uses = await accntSrvc.getInviteCodesUses(codes)

      const resultCursor = keyset.packFromResult(res)
      const codeDetails = res.map((row) => ({
        ...row,
        disabled: row.disabled === 1,
        uses: uses[row.code] ?? [],
      }))

      return {
        encoding: 'application/json',
        body: {
          cursor: resultCursor,
          codes: codeDetails,
        },
      }
    },
  })
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
