import {
  AuthorizedClientData,
  AuthorizedClients,
  ClientId,
  Did,
} from '@atproto/oauth-provider'
import { fromJson, toDateISO, toJson } from '../../db/index.js'
import { AccountDb } from '../db/index.js'

export async function upsert(
  db: AccountDb,
  did: Did,
  clientId: ClientId,
  data: AuthorizedClientData,
) {
  const now = new Date()

  return db.db
    .insertInto('authorized_client')
    .values({
      did,
      clientId,
      createdAt: toDateISO(now),
      updatedAt: toDateISO(now),
      data: toJson(data),
    })
    .onConflict((oc) =>
      // uses "authorized_client_pk" idx
      oc.columns(['did', 'clientId']).doUpdateSet({
        updatedAt: toDateISO(now),
        data: toJson(data),
      }),
    )
    .executeTakeFirst()
}

export async function getAuthorizedClients(
  db: AccountDb,
  did: Did,
): Promise<AuthorizedClients> {
  return (await getAuthorizedClientsMulti(db, [did])).get(did)!
}

export async function deleteAllAuthorizedClients(db: AccountDb, did: Did) {
  await db.executeWithRetry(
    db.db.deleteFrom('authorized_client').where('did', '=', did),
  )
}

export async function getAuthorizedClientsMulti(
  db: AccountDb,
  dids: Iterable<Did>,
): Promise<Map<Did, AuthorizedClients>> {
  // Using a Map will ensure unicity of dids (through unicity of keys)
  const map = new Map<Did, AuthorizedClients>(
    Array.from(dids, (did) => [did, new Map()]),
  )

  if (map.size) {
    const found = await db.db
      .selectFrom('authorized_client')
      .select('did')
      .select('clientId')
      .select('data')
      // uses "authorized_client_pk"
      .where('did', 'in', [...map.keys()])
      .execute()

    for (const { did, clientId, data } of found) {
      map.get(did)!.set(clientId, fromJson(data))
    }
  }

  return map
}
