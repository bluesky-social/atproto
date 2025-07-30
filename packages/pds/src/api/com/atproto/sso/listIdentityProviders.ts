import { MethodNotImplementedError } from "@atproto/xrpc-server";
import { AppContext } from "../../../../context";
import { Server } from "../../../../lexicon";

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sso.listIdentityProviders({
    auth: ctx.authVerifier.userServiceAuthOptional,
    handler: async () => {
      if (ctx.entrywayAgent) {
        throw new MethodNotImplementedError(
          "Cannot proxy listing identity providers yet",
        );
      }

      const arr = await ctx.ssoManager.listIdentityProviders();

      return {
        encoding: "application/json",
        body: {
          identityProviders: arr.map(({ id, name, icon }) => ({
            id,
            name: name || undefined,
            icon: icon || undefined,
          })),
        },
      };
    },
  });
}
