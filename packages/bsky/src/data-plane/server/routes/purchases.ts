import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { keyBy } from '@atproto/common'
import { Timestamp } from '@bufbuild/protobuf'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getPurchaseEntitlements(req) {
    const { dids } = req

    if (dids.length === 0) {
      return { purchaseEntitlements: [] }
    }

    const res = await db.db
      .selectFrom('purchase')
      .select(['did', 'entitlements', 'createdAt'])
      .where('did', 'in', dids ?? [])
      .execute()

    const byDid = keyBy(res, 'did')
    const purchaseEntitlements = res.map((row) => {
      const purchase = byDid[row.did] ?? {}

      return {
        entitlements: purchase.entitlements ?? [],
        createdAt: Timestamp.fromDate(new Date(purchase.createdAt)),
      }
    })

    return { purchaseEntitlements }
  },
})
