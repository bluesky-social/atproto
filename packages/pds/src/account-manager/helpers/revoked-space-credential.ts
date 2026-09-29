import type { SpaceRefString } from '@atproto/lex'
import { CLOCK_SKEW_SEC, SPACE_CREDENTIAL_MAX_AGE_SEC } from '@atproto/space'
import { toDateISO } from '../../db/index.js'
import type { AccountDb } from '../db/index.js'

export async function addRevokedSpaceCredentials(
  db: AccountDb,
  space: SpaceRefString,
  jtis: string[],
): Promise<void> {
  const now = Date.now()
  // @NOTE cover clock skew at both issuance and expiration.
  const expiresAt = toDateISO(
    new Date(now + (SPACE_CREDENTIAL_MAX_AGE_SEC + 2 * CLOCK_SKEW_SEC) * 1000),
  )
  await db.executeWithRetry(
    db.db
      .insertInto('revoked_space_credential')
      .values(jtis.map((jti) => ({ space, jti, expiresAt })))
      .onConflict((oc) =>
        oc.columns(['space', 'jti']).doUpdateSet({ expiresAt }),
      ),
  )
}

export async function deleteExpiredRevokedSpaceCredentials(
  db: AccountDb,
): Promise<void> {
  await db.executeWithRetry(
    db.db
      .deleteFrom('revoked_space_credential')
      .where('expiresAt', '<=', toDateISO(new Date(Date.now()))),
  )
}

export async function isSpaceCredentialRevoked(
  db: AccountDb,
  space: SpaceRefString,
  jti: string,
): Promise<boolean> {
  const revoked = await db.db
    .selectFrom('revoked_space_credential')
    .select('jti')
    .where('space', '=', space)
    .where('jti', '=', jti)
    .where('expiresAt', '>', toDateISO(new Date(Date.now())))
    .executeTakeFirst()
  return !!revoked
}
