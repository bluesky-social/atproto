import { AuthCallback, SSODb } from "../db";

export const selectQB = (db: SSODb) =>
  db.db.selectFrom("auth_callback").selectAll();

export const getAuthCallback = (
  db: SSODb,
  state: string,
): Promise<AuthCallback | null> =>
  selectQB(db).where((qb) => qb.where("state", "=", state))
    .executeTakeFirst().then((found) => found || null);

export const registerAuthCallback = (
  db: SSODb,
  opts: AuthCallback,
): Promise<string | null> =>
  db.executeWithRetry(
    db.db
      .insertInto("auth_callback")
      .values(opts)
      .onConflict((oc) => oc.doNothing())
      .returning("state"),
  ).then(([res]) => res?.state || null);

export const deleteAuthCallback = (
  db: SSODb,
  state: string,
): Promise<void> =>
  db.executeWithRetry(
    db.db.deleteFrom("auth_callback").where("state", "=", state),
  ).then(() => {});
