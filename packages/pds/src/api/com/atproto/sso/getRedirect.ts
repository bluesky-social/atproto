import {
  InternalServerError,
  InvalidRequestError,
} from "@atproto/xrpc-server";
import { AppContext } from "../../../../context";
import { Server } from "../../../../lexicon";
import { randomBytes, subtle } from "node:crypto";
import { CookieSerializeOptions, serialize as serializeCookie } from "cookie";
import { base64url } from "jose";
import { ServerResponse } from "node:http";
import { resultPassthru } from "../../../proxy";
import { ssoLogger as log } from "../../../../logger";
import { CodeChallengeMethod } from "../../../../sso/db/schema/identity-provider";

export function appendHeader(
  res: ServerResponse,
  header: string,
  value: string | readonly string[],
): void {
  const existing = res.getHeader(header);
  if (existing == null) {
    res.setHeader(header, value);
  } else {
    const arr = Array.isArray(existing) ? existing : [String(existing)];
    res.setHeader(header, arr.concat(value));
  }
}

// @NOTE Cookie based CSRF protection is redundant with session cookies using
// `SameSite` and could probably be removed in the future.
const getCallbackCookieOptions = (): Readonly<CookieSerializeOptions> => ({
  expires: new Date(Date.now() + 6e3 * 5), // "session" cookie
  secure: true,
  httpOnly: true,
  sameSite: "lax",
  path: "/xrpc/com.atproto.sso.getCallback",
});

export function generateRandomStr(length: number) {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

const generatePKCE = async (method: CodeChallengeMethod) => {
  const verifier = generateRandomStr(64);

  if (method === "plain") {
    return {
      challenge: verifier,
      verifier,
    };
  }

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );

  return {
    challenge: base64url.encode(new Uint8Array(digest)),
    verifier,
  };
};

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sso.getRedirect({
    handler: async ({ params: { idpId, redirectUri }, req, res }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.sso.getRedirect(
            { idpId, redirectUri },
            ctx.entrywayPassthruHeaders(req),
          ),
        )
      }

      const idp = await ctx.ssoManager.getIdentityProvider(idpId);

      if (!idp) {
        throw new InvalidRequestError(
          `Could not find identity provider: ${idpId}`,
        );
      }

      try {
        new URL(redirectUri);
      } catch (err) {
        throw new InvalidRequestError(
          `Invalid redirect URI: ${err}`,
        );
      }

      log.info(idp, "IDP");

      if (!idp.metadata && idp.discoverable) {
        idp.metadata = await ctx.ssoManager.fetchMetadata(new URL(idp.issuer));

        await ctx.ssoManager.updateIdentityProvider(idp);
      }

      if (!idp.metadata) {
        throw new InternalServerError(
          `Missing metadata for identity provider: ${idp.id}`
        );
      }

      const codeChallengeMethods = idp.metadata.codeChallengeMethods;

      const codeChallengeMethod = codeChallengeMethods && codeChallengeMethods.length > 0 &&
        (codeChallengeMethods.find(m => m === "S256")
          || codeChallengeMethods.find(m => m === "plain"));

      const pkce = idp.usePkce && codeChallengeMethod
        ? await generatePKCE(codeChallengeMethod)
        : null;

      const authCallback = {
        state: generateRandomStr(32),
        nonce: generateRandomStr(32),
        scope: idp.scope,
        idpId: idp.id,
        redirectUri,
        codeVerifier: pkce?.verifier || null,
      };

      log.info(authCallback, "Created callback`")

      await ctx.ssoManager.createAuthCallback(authCallback);

      const query = new URLSearchParams({
        client_id: idp.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: idp.scope,
        state: authCallback.state,
        ...(pkce && { code_challenge: pkce.challenge, code_challenge_method: "S256" })
      });

      const location = new URL(idp.metadata.endpoints.authorization);

      for (const [k, v] of [...query.entries()]) {
        location.searchParams.append(k, v);
      }

      appendHeader(res, "Set-Cookie", serializeCookie(
        "atproto-callback",
        authCallback.state,
        getCallbackCookieOptions()
      ));

      appendHeader(res, "Location", location.toString());

      return {
        encoding: "application/json",
        body: {
          state: authCallback.state,
        },
      };
    },
  });
}
