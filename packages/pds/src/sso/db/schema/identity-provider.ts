import { Selectable } from "kysely";
import { JsonEncoded } from "../../../db";
import { z } from "zod";
import { oauthAuthorizationResponseErrorSchema, oauthTokenResponseSchema } from "@atproto/oauth-provider";

export const authMethods = [
  "client_secret_basic",
  "client_secret_post",
] as const;

export type AuthMethod = typeof authMethods[number];

export const isAuthMethod = (s: string): s is typeof authMethods[number] =>
  authMethods.includes(s as any);

export const codeChallengeMethods = [
  "plain",
  "S256",
] as const;

export type CodeChallengeMethod = typeof codeChallengeMethods[number];

export const isCodeChallengeMethod = (s: string): s is typeof codeChallengeMethods[number] =>
  codeChallengeMethods.includes(s as any);

export type Endpoints = {
  authorization: string;
  token: string;
  userinfo?: string;
};

export type Mappings = {
  sub: string;
  username?: string;
  picture?: string;
  email?: string;
};

export type Metadata = {
  endpoints: Endpoints;
  mappings: Mappings;
  authMethods?: AuthMethod[];
  scopesSupported?: string[];
  codeChallengeMethods?: CodeChallengeMethod[];
};

export type IdentityProviderData =
  & Omit<IdentityProvider, "metadata" | "usePkce" | "discoverable">
  & {
    usePkce: boolean;
    discoverable: boolean;
    metadata: Metadata | null;
  };

export interface IdentityProvider {
  id: string;
  name: string | null;
  icon: string | null;
  issuer: string;
  clientId: string;
  clientSecret: string | null;
  scope: string;
  usePkce: number;
  discoverable: number;
  metadata: JsonEncoded<Metadata> | null;
}

export type IdentityProviderEntry = Selectable<IdentityProvider>;

export const tableName = "identity_provider";

export type PartialDB = { [tableName]: IdentityProvider };

export const oidcMetadataSchema = z.object({
  issuer: z.string().url()
    .transform((s) => new URL(s)),
  authorization_endpoint: z.string().url()
    .transform((s) => new URL(s)),
  token_endpoint: z.string().url()
    .transform((s) => new URL(s)),
  token_endpoint_auth_methods_supported: z
    .array(z.string()).transform((arr) =>
      arr.filter(isAuthMethod)
    ).optional(),
  userinfo_endpoint: z.string().url()
    .transform((s) => new URL(s)).optional(),
  scopes_supported: z.array(z.string()).optional(),
  code_challenge_methods_supported: z
    .array(z.string()).transform((arr) =>
      arr.filter(isCodeChallengeMethod)
    ).optional(),
  claims_supported: z.array(z.string()).optional(),
});

export type OidcMetadata = z.infer<typeof oidcMetadataSchema>;

export const oauthResponseSchema = z.discriminatedUnion('error', [
  oauthTokenResponseSchema.extend({ error: z.undefined() }),
  z.object({
    error: oauthAuthorizationResponseErrorSchema,
    error_description: z.string().optional(),
  })
]);

export type OauthResponse = z.infer<typeof oauthResponseSchema>;

export const oidcClaimsSchema = z.record(z.string(), z.any())
  .transform((obj) =>
    Object.fromEntries(
      Object.entries(obj).filter(([_, v]) =>
        ["string", "number", "boolean"].includes(typeof v)
      )
    )
  )
.optional();

export type OidcClaims = z.infer<typeof oidcClaimsSchema>;

const GitHubEmailSchema = z.object({
  email: z.string().email(),
  primary: z.boolean(),
  verified: z.boolean(),
  visibility: z.union([z.literal("public"), z.literal("private"), z.null()]),
});

export const GitHubEmailsSchema = z.array(GitHubEmailSchema);
