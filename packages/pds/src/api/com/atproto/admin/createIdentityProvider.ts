import {
  InvalidRequestError,
} from "@atproto/xrpc-server";
import { AppContext } from "../../../../context";
import { Server } from "../../../../lexicon";
import { isAuthMethod, isCodeChallengeMethod, Metadata } from "../../../../sso/db/schema/identity-provider";
import { ssoLogger as log } from "../../../../logger";
import { resultPassthru } from "../../../proxy";

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.createIdentityProvider({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ req, input }) => {
      const body = input.body;

      log.info(body);

      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.admin.createIdentityProvider(
            body,
            ctx.entrywayPassthruHeaders(req),
          ),
        )
      }

      let issuer: URL;

      try {
        issuer = new URL(body.issuer);

        if (issuer.protocol !== "https:") {
          throw new InvalidRequestError(`Issuer URL must use HTTPS: ${body.issuer}`);
        }
      } catch (err) {
        throw new InvalidRequestError(`Invalid issuer URL: ${body.issuer}`);
      }

      if (!body.clientSecret && !body.usePkce) {
        throw new InvalidRequestError(`Misisng client secret, PKCE required`);
      }

      let metadata: Metadata | null = null;

      if (!body.metadata) {
        if (!body.discoverable) {
          throw new InvalidRequestError(
            `Missing metadata for identity provider`
          );
        }

        metadata = await ctx.ssoManager.fetchMetadata(issuer);
      } else {
        metadata = ({
          ...body.metadata,
          authMethods: body.metadata.authMethods.filter(
            isAuthMethod
          ),
          codeChallengeMethods: body.metadata.codeChallengeMethods?.filter(
            isCodeChallengeMethod
          ),
        });
      }

      const idpId = await ctx.ssoManager.createIdentityProvider({
        ...body,
        name: body.name || null,
        icon: body.icon || null,
        clientSecret: body.clientSecret || null,
        metadata,
      });

      if (!idpId) {
        throw new InvalidRequestError(
          `Identity provider already exists`,
        );
      }

      return {
        encoding: "application/json",
        body: {
          idpId,
        },
      };
    },
  });
}
