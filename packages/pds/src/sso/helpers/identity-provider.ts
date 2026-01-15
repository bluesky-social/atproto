import { fromJson, toJson } from "../../db";
import { ssoLogger as log } from "../../logger";
import { SSODb } from "../db";
import { IdentityProviderData, isAuthMethod, isCodeChallengeMethod, Metadata, oidcMetadataSchema } from "../db/schema/identity-provider";

export const selectQB = (db: SSODb) =>
  db.db.selectFrom("identity_provider").selectAll();

export const getIdentityProvider = (
  db: SSODb,
  id: string,
): Promise<IdentityProviderData | null> =>
  selectQB(db).where((qb) => qb.where("id", "=", id))
    .executeTakeFirst().then((found) =>
      found
        ? {
          ...found,
          usePkce: found.usePkce === 1,
          discoverable: found.discoverable === 1,
          metadata: found.metadata ? fromJson(found.metadata) : null,
        }
        : null
    );

export const listIdentityProviders = (
  db: SSODb,
): Promise<Array<IdentityProviderData>> =>
  selectQB(db)
    .execute().then((arr) =>
      arr.map((found) => (
        {
          ...found,
          usePkce: found.usePkce === 1,
          discoverable: found.discoverable === 1,
          metadata: found.metadata ? fromJson(found.metadata) : null,
        }
      ))
    );

export const registerIdentityProvider = (
  db: SSODb,
  opts: IdentityProviderData,
): Promise<string | null> =>
  db.executeWithRetry(
    db.db
      .insertInto("identity_provider")
      .values({
        ...opts,
        usePkce: opts.usePkce ? 1 : 0,
        discoverable: opts.discoverable ? 1 : 0,
        metadata: opts.metadata ? toJson(opts.metadata) : null,
      })
      .onConflict((oc) => oc.doNothing())
      .returning("id"),
  ).then(([res]) => res?.id || null);

export const updateIdentityProvider = async (
  db: SSODb,
  opts: IdentityProviderData,
): Promise<string> => {
  const res = await db.db.updateTable("identity_provider")
    .set({
      ...opts,
      usePkce: opts.usePkce ? 1 : 0,
      discoverable: opts.discoverable ? 1 : 0,
      metadata: opts.metadata ? toJson(opts.metadata) : null,
    })
    .where("id", "=", opts.id)
    .returning("id")
    .executeTakeFirst();

  if (!res?.id) {
    throw new Error(
      `Missing identity provider: '${opts.id}'`,
    );
  }

  return res.id;
}

export const deleteIdentityProvider = (
  db: SSODb,
  id: string,
): Promise<void> =>
  db.executeWithRetry(
    db.db.deleteFrom("identity_provider").where("id", "=", id),
  ).then(() => { });

export const fetchMetadata = async (
  issuer: URL,
): Promise<Metadata> => {
  log.info(`fetching metadata from ${issuer}`);

  let uri = issuer;

  try {
    uri.pathname = "/.well-known/openid-configuration";

    const res = await fetch(uri, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Indiscoverable OIDC metadata: ${res.status} ${res.statusText}`);
    }

    const {
      issuer: metadataIssuer,
      authorization_endpoint,
      token_endpoint,
      userinfo_endpoint,
      claims_supported,
      token_endpoint_auth_methods_supported,
      scopes_supported,
      code_challenge_methods_supported,
    } = await res.json().then(md => oidcMetadataSchema.parse(md));

    if (issuer.host !== metadataIssuer.host) {
      throw new Error(`Issuer host mismatch in OIDC metadata (expected: ${issuer.host}, got: ${metadataIssuer.host})`);
    }

    return {
      endpoints: {
        authorization: authorization_endpoint.toString(),
        token: token_endpoint.toString(),
        userinfo: userinfo_endpoint?.toString(),
      },
      mappings: {
        sub: "sub",
        picture: claims_supported?.find(c => c === "picture"),
        email: claims_supported?.find(c => c === "email"),
      },
      authMethods: token_endpoint_auth_methods_supported?.filter(
        isAuthMethod,
      ),
      scopesSupported: scopes_supported,
      codeChallengeMethods: code_challenge_methods_supported?.filter(
        isCodeChallengeMethod
      ),
    };
  } catch (err) {
    throw new Error(`Failed to fetch OIDC metadata: ${err}`);
  }
};

