import { fromJson, toJson } from "../../db";
import { AuthClaims, SSODb } from "../db";
import { AuthClaimsData, JsonValue } from "../db/schema/auth-claims";

export const selectQB = (db: SSODb) =>
  db.db.selectFrom("auth_claims").selectAll();

export const getAuthClaims = (
  db: SSODb,
  did: string,
  idpId: string,
): Promise<AuthClaimsData | null> =>
  selectQB(db).where((qb) =>
    qb.where("did", "=", did).where("idpId", "=", idpId)
  )
    .executeTakeFirst().then((found) => found ? ({
      ...found,
      sub: fromJson(found.sub)
    }) : null);

export const registerAuthClaims = (
  db: SSODb,
  opts: AuthClaimsData,
): Promise<[string, string] | null> =>
  db.executeWithRetry(
    db.db
      .insertInto("auth_claims")
      .values({
        ...opts,
        sub: toJson(opts.sub),
      })
      .onConflict((oc) => oc.doNothing())
      .returning(["did", "idpId"]),
  ).then(([res]) => res ? [res.did, res.idpId] : null);

export const deleteAuthClaims = (
  db: SSODb,
  did: string,
  idpId: string,
): Promise<void> =>
  db.executeWithRetry(
    db.db.deleteFrom("auth_claims").where("did", "=", did).where(
      "idpId",
      "=",
      idpId,
    ),
  ).then(() => { });

export const getAccountClaims = (
  db: SSODb,
  sub: JsonValue,
  idpId: string,
): Promise<AuthClaimsData | null> =>
  selectQB(db).where("sub", "=", toJson(sub)).where(
    "idpId",
    "=",
    idpId,
  ).executeTakeFirst().then((found) => found ? ({
    ...found,
    sub: fromJson(found.sub)
  }) : null);
