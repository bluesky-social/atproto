import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  LabeledResult,
  Cursor,
  GenericKeyset,
  paginate,
} from '../../../../db/pagination'
import {
  CodeDetail,
  CodeUse,
} from '../../../../lexicon/types/com/atproto/admin/getInviteCodes'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getInviteCodes({
    auth: ctx.adminVerifier,
    handler: async ({ params }) => {
      const { sort, limit, cursor } = params
      let builder = ctx.db.db
        .with('use_count', (qb) =>
          qb
            .selectFrom('invite_code_use')
            .groupBy('code')
            .select(['code', sql<number>`count(usedBy)`.as('uses')]),
        )
        .selectFrom('invite_code')
        .leftJoin('use_count', 'invite_code.code', 'use_count.code')
        .select([
          'invite_code.code as code',
          'invite_code.availableUses as available',
          'invite_code.disabled as disabled',
          'invite_code.forUser as forAccount',
          'invite_code.createdBy as createdBy',
          'invite_code.createdAt as createdAt',
          'use_count.uses as uses',
        ])

      const ref = ctx.db.db.dynamic.ref
      let keyset
      if (sort === 'recent') {
        keyset = new TimeCodeKeyset(ref('createdAt'), ref('code'))
      } else if (sort === 'usage') {
        keyset = new UseCodeKeyset(ref('uses'), ref('code'))
      } else {
        throw new InvalidRequestError(`unknown sort method: ${sort}`)
      }

      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const res = await builder.execute()

      const uses: Record<string, CodeUse[]> = {}
      const codes = res.map((row) => row.code)
      if (codes.length > 0) {
        const usesRes = await ctx.db.db
          .selectFrom('invite_code_use')
          .where('code', 'in', codes)
          .selectAll()
          .execute()
        for (const use of usesRes) {
          const { code, usedBy, usedAt } = use
          uses[code] ??= []
          uses[code].push({ usedBy, usedAt })
        }
      }

      const resultCursor = keyset.packFromResult(res)
      const codeDetails: CodeDetail[] = res.map((row) => ({
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
