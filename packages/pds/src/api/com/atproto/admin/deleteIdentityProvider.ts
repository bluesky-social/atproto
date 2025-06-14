import { AppContext } from "../../../../context";
import { Server } from "../../../../lexicon";

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.deleteIdentityProvider({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ params }) => {
      await ctx.ssoManager.deleteIdentityProvider(params.idpId);
    },
  });
}
