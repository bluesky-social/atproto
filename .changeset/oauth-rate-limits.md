---
'@atproto/oauth-provider': minor
'@atproto/oauth-provider-api': minor
'@atproto/oauth-provider-ui': patch
'@atproto/pds': patch
---

Add rate limiting to the OAuth provider, with two tiers on account flows when hCaptcha is configured (captcha required, then blocked)

**Breaking changes** in `@atproto/oauth-provider`:

- `OAuthProvider.pushedAuthorizationRequest()` requires a new `deviceMetadata` argument (the PAR requests are rate limited).
- `AccountManager` no longer verifies hCaptcha tokens: the API routes do, through the rate limits, before calling it. `processHcaptchaToken()` and `buildSignupData()` were removed, and `authenticateAccount()` receives a `SignInInput`.
- The `SignInData` and `SignUpData` types were removed. Hooks and stores receive the form inputs instead (`SignInInput`, `SignUpInput`, `InitiatePasswordResetInput` and `ConfirmResetPasswordInput`, from `@atproto/oauth-provider-api`), including the `hcaptchaToken` when one was submitted:
  - `onSignInAttempt`, `onSignedIn` and `onSignInFailed` receive `input` instead of `data`.
  - `onSignedUp` receives `input` instead of `data`, the invite code being `input.inviteCode`. It no longer receives the hCaptcha verification result (`data.hcaptchaResult`): use the `onHcaptchaResult` hook (`action: 'sign-up'`) instead.
  - `AccountStore.createAccount()` receives the `inviteCode` as submitted, even when invite codes are not required (it used to be omitted). The PDS now validates and uses an invite code submitted on an OAuth sign-up whatever its configuration, as `com.atproto.server.createAccount` does.
  - The password reset hooks (`onResetPasswordRequest`, `onResetPasswordRequested`, `onResetPasswordConfirm` and `onResetPasswordConfirmed`), as well as `AccountStore.resetPasswordRequest()` and `AccountStore.resetPasswordConfirm()`, may receive an `hcaptchaToken`.
- The `onSignUpAttempt` hook is now called after the sign-up rate limits and captcha verification.
- The `onHcaptchaResult` hook data is a union discriminated on `action` (`sign-up`, `sign-in`, `reset-password-request` or `reset-password-confirm`), each carrying its form `input`, as the hook is now called whenever a captcha is verified.
- `HcaptchaClientTokens.hashedHandle` was renamed `hashedIdentifier`, and is only present when the form has an identifier (the handle on sign-up). The identifier is now trimmed, lowercased and stripped of any leading `@` before being hashed, and the sign-up email is hashed as `hashedEmail`. This changes the `client_tokens` sent to hCaptcha, and the `tokens` provided to the `onHcaptchaResult` hook.
- A failed hCaptcha verification (including on sign-up, and when hCaptcha can't be reached) is now reported as `captcha_rejected` instead of `invalid_request`.

New features in `@atproto/oauth-provider`:

- `rateLimits` option: the host provides a `RateLimiterFactory` backend, and may override the `DEFAULT_RATE_LIMIT_POLICIES`. Without it, no rate limiting is performed, though the rules that have no points still apply. Each rule computes its key with a `key` function, from the context its policy provides (see `RateLimitPolicyContexts`); `ipKey`, `identifierKey`, `identifierIpKey`, `authenticatedClientKey` and `publicClientIpKey` are provided. PAR requests are limited per authenticated client (shared by all its users, 3,000 per 5 minutes), and per client and IP address for public clients (which anyone can claim to be, 50 per 5 minutes).
- The sign-in, sign-up, password reset request and password reset confirmation policies support a captcha tier. Sign-ups requiring a captcha is now the default captcha tier of the `sign-up` policy: a rule with no points, which every request exceeds. Such rules need no storage, so they apply even without the `rateLimits` option.
- `captcha_required` (HTTP 400, no hCaptcha token was provided), `captcha_rejected` (HTTP 400, the hCaptcha token failed verification) and `rate_limit_exceeded` (HTTP 429, with a `Retry-After` header) errors.
- `OAuthError.getResponseHeaders()` lists the headers to send along an error response (e.g. `WWW-Authenticate`, `Retry-After`).

**Breaking changes** in `@atproto/oauth-provider-api`:

- The `EmailString` and `IdentifierString` types are exported, and used to type `SignInInput.identifier`, `InitiatePasswordResetInput.identifier`, `SignUpInput.email` and `Account.email`. `SignUpInput.handle` is a `HandleString`.
- `SignInInput`, `InitiatePasswordResetInput` and `ConfirmResetPasswordInput` accept an `hcaptchaToken`.

The sign-in and password reset forms (request and confirmation), including the account page's password change dialog, show an hCaptcha challenge when the server requires one, and how long to wait when rate limited. That dialog no longer has an inline "Resend" button: "Back" returns to the request step, as in the signed-out flow. The PDS enables these rate limits along with its XRPC rate limits (`PDS_RATE_LIMITS_ENABLED`), using the same storage; the bypass settings (`PDS_RATE_LIMIT_BYPASS_IPS`, `PDS_RATE_LIMIT_BYPASS_KEY`) do not apply to them.
