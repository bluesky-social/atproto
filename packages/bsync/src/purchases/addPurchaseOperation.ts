import { sql } from 'kysely'
import { Database } from '..'
import { createPurchaseOpChannel } from '../db/schema/purchase_op'

export const addPurchaseOperation = async (
  db: Database,
  actorDid: string,
  entitlements: string[],
) => {
  const sortedEntitlements = [...entitlements].sort()

  return db.transaction(async (txn) => {
    // create purchase op
    const id = await createPurchaseOp(txn, actorDid, sortedEntitlements)
    // update purchase state
    await updatePurchaseItem(txn, id, actorDid, sortedEntitlements)
    return id
  })
}

const createPurchaseOp = async (
  db: Database,
  actorDid: string,
  entitlements: string[],
) => {
  const { ref } = db.db.dynamic
  const { id } = await db.db
    .insertInto('purchase_op')
    .values({
      actorDid,
      entitlements: JSON.stringify(entitlements),
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await sql`notify ${ref(createPurchaseOpChannel)}`.execute(db.db) // emitted transactionally
  return id
}

const updatePurchaseItem = async (
  db: Database,
  fromId: number,
  actorDid: string,
  entitlements: string[],
) => {
  const { ref } = db.db.dynamic
  await db.db
    .insertInto('purchase_item')
    .values({
      actorDid,
      entitlements: JSON.stringify(entitlements),
      fromId,
    })
    .onConflict((oc) =>
      oc.column('actorDid').doUpdateSet({
        entitlements: sql`${ref('excluded.entitlements')}`,
        fromId: sql`${ref('excluded.fromId')}`,
      }),
    )
    .execute()
}
