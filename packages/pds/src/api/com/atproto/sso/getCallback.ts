import {
  AuthRequiredError,
  InternalServerError,
  InvalidRequestError,
} from "@atproto/xrpc-server";
import { AppContext } from "../../../../context";
import { Server } from "../../../../lexicon";
import * as cookie from "cookie";
import { base64url } from "jose";
import {
  UnauthorizedClientError,
} from "@atproto/oauth-provider";
import { DidDocument } from "@atproto/common";
import { validateInputsForLocalPds } from "../server/createAccount";
import { didDocForSession, safeResolveDidDoc } from "../server/util";
import {
  AccountStatus,
  formatAccountStatus,
} from "../../../../account-manager/account-manager";
import { syncEvtDataFromCommit } from "../../../../sequencer";
import { NullOutput, UserServiceAuthOutput } from "../../../../auth-verifier";
import {
  InputSchema,
  OutputSchema,
} from "../../../../lexicon/types/com/atproto/server/createAccount";
import { INVALID_HANDLE } from "@atproto/syntax";
import { softDeleted } from "../../../../db";
import { resultPassthru } from "../../../proxy";
import { GitHubEmailsSchema, OauthResponse, oauthResponseSchema, OidcClaims, oidcClaimsSchema } from "../../../../sso/db/schema/identity-provider";
import { ActorAccount } from "../../../../account-manager/helpers/account";
import { ssoLogger as log } from "../../../../logger";

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sso.getCallback({
    auth: ctx.authVerifier.userServiceAuthOptional,
    handler: async ({ params, auth, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.sso.getCallback(
            params,
            ctx.entrywayPassthruHeaders(req),
          ),
        )
      }

      const { code, state } = params;

      if (!req.headers.cookie) {
        throw new InvalidRequestError("Missing cookie header");
      }

      let callbackId: string | undefined = undefined;

      if (typeof req.headers.cookie === 'string') {
        try {
          const cookies: Record<string, string | undefined>
            = cookie.parse(req.headers.cookie);

          callbackId = cookies["atproto-callback"];
        } catch (err) {
          throw new InvalidRequestError(`Invalid cookie header: ${err}`);
        }
      }

      if (!callbackId) {
        throw new InvalidRequestError("Missing callback cookie");
      }

      const callback = await ctx.ssoManager.getAuthCallback(callbackId);

      if (!callback) {
        throw new InvalidRequestError("Failed to find callback");
      }

      log.info(callback, `Found callback`);

      if (callbackId !== state) {
        throw new InvalidRequestError(
          `State mismatch in callback parameter (expected: ${callbackId}, got: ${state})`
        );
      }

      log.info(`Callback state is valid`);

      const idp = await ctx.ssoManager.getIdentityProvider(callback.idpId);

      if (!idp) {
        throw new InvalidRequestError(
          `Missing identity provider: ${callback.idpId}`
        );
      }

      log.info(idp);

      if (!idp.metadata && idp.discoverable) {
        idp.metadata = await ctx.ssoManager.fetchMetadata(new URL(idp.issuer));

        await ctx.ssoManager.updateIdentityProvider(idp);
      }

      if (!idp.metadata) {
        throw new InternalServerError(
          `Missing metadata for identity provider: ${callback.idpId}`
        );
      }

      const data = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callback.redirectUri,
        client_id: idp.clientId,
      });

      log.info(idp, "IDP");

      if (idp.clientSecret && idp.metadata.authMethods?.includes('client_secret_post')) {
        data.append("client_secret", idp.clientSecret);
      }

      if (callback.codeVerifier) {
        data.append("code_verifier", callback.codeVerifier);
      }


      log.info([...data.entries()], `Token endpoint request`);

      let claims: OidcClaims = {};

      let res: Response;

      try {
        res = await fetch(idp.metadata.endpoints.token, {
          method: "POST",
          headers: {
            "Content-type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            ...!data.get("client_secret") && ({
              "Authorization": `Basic: ${Buffer.from(idp.clientSecret || "").toString('base64')}`
            }),
          },
          body: data,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "<unreadable body>");

          throw new InternalServerError(
            `Failed to fetch token endpoint: ${res.status} ${res.statusText} – ${text}`
          );
        }

        log.info(`Token endpoint request successful`);
      } catch (err) {
        log.error(err, `Failed to fetch token endpoint`);

        throw new Error(`Failed to fetch token endpoint`);
      }

      let body: OauthResponse;

      try {
        body = await res.json().then(token => {
          log.info(token, `Token endpoint response`);

          return oauthResponseSchema.parse(token);
        });

        log.info(`Fetching OAuth response successful`);
      } catch (err) {
        log.error(err, `Invalid JSON from token endpoint`);

        throw new InternalServerError(`Invalid JSON from token endpoint`);
      }

      if ("error" in body) {
        log.error(body.error, `Failed to fetch token endpoint`);

        throw new InternalServerError(`Failed to fetch token endpoint`);
      }

      if (body.id_token) {
        const buffer = body.id_token.split(".").at(1);

        if (!buffer) {
          log.error(body.id_token, `Malformed ID token`);

          throw new InternalServerError(`Malformed ID token`);
        }

        const de = new TextDecoder("utf-8");

        try {
          const tokenClaims = JSON.parse(de.decode(base64url.decode(buffer)));

          log.info(tokenClaims, `Token endpoint claims`);

          claims = oidcClaimsSchema.parse(tokenClaims);

          log.info(`Parsing ID token claims successful`);
        } catch (err) {
          log.error(err, `Invalid JSON from token endpoint`);

          throw new InternalServerError(`Invalid JSON from token endpoint`);
        }
      }

      if (idp.metadata.endpoints.userinfo) {
        let res: Response;

        try {
          res = await fetch(idp.metadata.endpoints.userinfo, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${body.access_token}`,
              "Accept": "application/json",
            },
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "<unreadable body>");

            throw new InternalServerError(
              `Failed to fetch userinfo endpoint: ${res.status} ${res.statusText} – ${text}`
            );
          }

          log.info(`Fetching userinfo endpoint successful`);
        } catch (err) {
          log.error(err, `Failed to fetch userinfo endpoint`);

          throw new InternalServerError(`Failed to fetch userinfo endpoint`);
        }

        const wwwAuth = res.headers.get("WWW-Authenticate");

        if (wwwAuth) {
          if (wwwAuth.startsWith("Basic ")) {
            throw new UnauthorizedClientError(`Basic authentication required`);
          }

          if (wwwAuth.startsWith("Bearer ")) {
            throw new UnauthorizedClientError(
              `Bearer token rejected: ${wwwAuth.substring("Bearer ".length).trim()}`
            );
          }

          throw new UnauthorizedClientError(
            `Unsupported WWW-Authenticate header: ${wwwAuth}`
          );
        }

        log.info(`No error found in WWW-Authenticate header`);

        try {
          const userinfoClaims = await res.json().then(userinfo => {
            log.info(userinfo, `Userinfo endpoint response`);

            return oidcClaimsSchema.parse(userinfo);
          });

          log.info(userinfoClaims, `Userinfo endpoint claims`);

          claims = {
            ...claims,
            ...userinfoClaims,
          };

          log.info(`Parsing userinfo claims successful`);
        } catch (err) {
          log.error(err, `Invalid JSON from userinfo endpoint`);

          throw new InternalServerError(`Invalid JSON from userinfo endpoint`);
        }
      }

      const sub = claims?.[idp.metadata.mappings.sub];

      if (!sub) {
        throw new InternalServerError(
          `Absent subject in claims: ${JSON.stringify(claims, null, 4)}`,
        );
      }

      let account: ActorAccount | null = null;

      const accountClaims = await ctx.ssoManager.getAccountClaims(sub, idp.id);

      if (accountClaims) {
        account = await ctx.accountManager.getAccount(
          accountClaims.did.toLowerCase(),
          {
            includeDeactivated: true,
            includeTakenDown: true,
          },
        );

        if (!account) {
          await ctx.ssoManager.deleteAuthClaims(accountClaims.did, idp.id);

          throw new InternalServerError(
            `Unlinked account claims for ${accountClaims.sub}`,
          );
        }

        log.info(account.handle, `Found existing account`);
      }

      if (!account) {
        const username = idp.metadata.mappings.username ? claims?.[idp.metadata.mappings.username] : claims?.["preferred_username"] ||
          claims?.["nickname"];

        if (typeof username !== "string") {
          if (typeof username === "undefined") {
            throw new InternalServerError(
              `Username claim is absent`,
            );
          }
          throw new InternalServerError(
            `Username claim is not a string: ${username} (${typeof username})`,
          );
        }

        let email = idp.metadata.mappings.email ? claims?.[idp.metadata.mappings.email] : claims?.["email"];

        if (idp.issuer === "https://github.com") {
          try {
            res = await fetch("https://api.github.com/user/emails", {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${body.access_token}`,
                "Accept": "application/json",
              },
            });

            if (!res.ok) {
              const text = await res.text().catch(() => "<unreadable body>");

              throw new InternalServerError(
                `Failed to fetch email endpoint: ${res.status} ${res.statusText} – ${text}`
              );
            }

            log.info(`Fetching email endpoint successful`);
          } catch (err) {
            log.error(err, `Failed to fetch email endpoint`);

            throw new InternalServerError(`Failed to fetch email endpoint`);
          }

          try {
            const emails = await res.json().then(emails => {
              log.info(emails, `Email endpoint response`);

              return GitHubEmailsSchema.parse(emails);
            });

            log.info(emails, `Email endpoint response`);

            const primary = emails.find(email => email.primary && email.verified);

            if (!primary) {
              throw new InvalidRequestError(`No primary verified Github email`);
            }

            email = primary.email;

            log.info(`Parsing emails successful`);
          } catch (err) {
            log.error(err, `Invalid JSON from userinfo endpoint`);

            throw new InternalServerError(`Invalid JSON from userinfo endpoint`);
          }

        }

        if (typeof email !== "string") {
          if (typeof email === "undefined") {
            throw new InternalServerError(
              `email claim is absent`,
            );
          }
          throw new InternalServerError(
            `Username email is not a string: ${email} (${typeof email})`,
          );
        }

        const data = {
          email,
          handle: `${username}.test`
        }

        log.info(data, `Registering new account`);

        // const { handle, did, didDoc, accessJwt, refreshJwt } =
        const { did } = await createAccount(ctx, auth, {
          ...data,
          did: undefined,
          inviteCode: undefined,
          verificationCode: undefined,
          verificationPhone: undefined,
          password: undefined,
          recoveryKey: undefined,
          plcOp: undefined,
        });

        try {
          await ctx.ssoManager.createAuthClaims({
            did,
            idpId: idp.id,
            sub,
            picture: null,
            email: email || null,
          });

          account = await ctx.accountManager.getAccount(
            did.toLowerCase(),
            {
              includeDeactivated: true,
              includeTakenDown: true,
            },
          );
        } catch (err) {
          await ctx.ssoManager.deleteAuthClaims(did, idp.id);
          await ctx.actorStore.destroy(did);

          throw new InternalServerError(
            `Failed to save auth claims: ${err}`
          );
        }
      }

      if (!account) {
        throw new InternalServerError(
          `Account was registered but does not exist`,
        );
      }

      const isSoftDeleted = softDeleted(account);

      if (isSoftDeleted) {
        throw new AuthRequiredError(
          "Account has been taken down",
          "AccountTakedown",
        );
      }

      const [{ accessJwt, refreshJwt }, didDoc] = await Promise.all([
        ctx.accountManager.createSession(
          account.did,
          null,
          isSoftDeleted,
        ),
        didDocForSession(ctx, account.did),
      ]);

      const { status, active } = formatAccountStatus(account);

      const emailConfirmed = claims?.["email_verified"];

      if (typeof emailConfirmed !== "boolean" && typeof emailConfirmed !== "undefined") {
        throw new InternalServerError(
          `EmailVerified claim is not a boolean: ${emailConfirmed} (${typeof emailConfirmed})`,
        );
      }

      return {
        encoding: "application/json",
        body: {
          did: account.did,
          didDoc,
          handle: account.handle ?? INVALID_HANDLE,
          email: account.email ?? undefined,
          emailConfirmed: emailConfirmed || false,
          accessJwt,
          refreshJwt,
          active,
          status,
          redirectUri: callback.redirectUri,
        },
      };
    },
  });
}

const createAccount = async (
  ctx: AppContext,
  auth: UserServiceAuthOutput | NullOutput,
  body: InputSchema,
): Promise<OutputSchema> => {
  const requester = auth.credentials?.did ?? null;
  const {
    did,
    handle,
    email,
    password,
    inviteCode,
    signingKey,
    plcOp,
    deactivated,
  } = await validateInputsForLocalPds(ctx, body, requester);

  let didDoc: DidDocument | undefined;
  let creds: { accessJwt: string; refreshJwt: string };
  await ctx.actorStore.create(did, signingKey);
  try {
    const commit = await ctx.actorStore.transact(
      did,
      (actorTxn) => actorTxn.repo.createRepo([]),
    );

    // Generate a real did with PLC
    if (plcOp) {
      try {
        await ctx.plcClient.sendOperation(did, plcOp);
      } catch (err) {
        // req.log.error(
        //   { didKey: ctx.plcRotationKey.did(), handle },
        //   "failed to create did:plc",
        // );
        throw err;
      }
    }

    didDoc = await safeResolveDidDoc(ctx, did, true);

    creds = await ctx.accountManager.createAccountAndSession({
      did,
      handle,
      email,
      password,
      repoCid: commit.cid,
      repoRev: commit.rev,
      inviteCode,
      deactivated,
    });

    if (!deactivated) {
      await ctx.sequencer.sequenceIdentityEvt(did, handle);
      await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active);
      await ctx.sequencer.sequenceCommit(did, commit);
      await ctx.sequencer.sequenceSyncEvt(
        did,
        syncEvtDataFromCommit(commit),
      );
    }
    await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev);
    await ctx.actorStore.clearReservedKeypair(signingKey.did(), did);
  } catch (err) {
    // this will only be reached if the actor store _did not_ exist before
    await ctx.actorStore.destroy(did);
    throw err;
  }

  return {
    handle,
    did: did,
    didDoc,
    accessJwt: creds.accessJwt,
    refreshJwt: creds.refreshJwt,
  };
};
