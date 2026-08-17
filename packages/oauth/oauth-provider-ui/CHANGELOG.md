# @atproto/oauth-provider-ui

## 0.10.0

### Minor Changes

- [#5347](https://github.com/bluesky-social/atproto/pull/5347) [`6631add`](https://github.com/bluesky-social/atproto/commit/6631add612d9bfd40413ca4e0a0c170f1eb40fca) Thanks [@bigmoves](https://github.com/bigmoves)! - Account manager: make the selected account and the authentication step part of
  the router instead of in-component state.

  The account manager now uses real routes for authentication (`/account/sign-in`,
  `/account/sign-up`) and encodes the active account in the URL
  (`/account/u/<handle-or-did>/…`). A reload now restores both the current
  sub-page and the selected account from the URL, so a device with several
  remembered accounts no longer drops back to the account picker on refresh. This
  replaces the previous `#step=` URL-fragment state machine (still used by the
  third-party consent flow) for the account-manager entry.

  Routing is now file-based: `src/routes/` is the route tree and
  `@tanstack/router-plugin` generates it, code-splitting each page so it is only
  downloaded when visited. Access checks run in `beforeLoad` and redirect before a
  page renders, rather than in the page itself, and the devices and apps pages
  load their data through the route's `loader`.

### Patch Changes

- [#5401](https://github.com/bluesky-social/atproto/pull/5401) [`674e4e8`](https://github.com/bluesky-social/atproto/commit/674e4e8328251f286d50adfd0cae02f8e9127304) Thanks [@nilaallj](https://github.com/nilaallj)! - Update Swedish translations

- [#5366](https://github.com/bluesky-social/atproto/pull/5366) [`f5a0af4`](https://github.com/bluesky-social/atproto/commit/f5a0af4465b469203a2a0804e9611474fde50feb) Thanks [@bigmoves](https://github.com/bigmoves)! - Simplify the sign-up username step. The domain is no longer a listbox nested inside the text input: with several domains available it becomes a list of radio rows under the input, and with only one it becomes a preview of the resulting username. The two validation rows collapse into a single hint, and the terms-of-service disclaimer moves to the final step, which is the step that creates the account.

- [#5400](https://github.com/bluesky-social/atproto/pull/5400) [`5db35fc`](https://github.com/bluesky-social/atproto/commit/5db35fc18a92959d81b89c8984fbcfc0a4b8e843) Thanks [@bigmoves](https://github.com/bigmoves)! - The reset-password confirmation screen no longer says "your password was
  updated" three times over — as a card title, a subtitle and a heading — before
  telling the user what to do next.

- [#5394](https://github.com/bluesky-social/atproto/pull/5394) [`7d83e7d`](https://github.com/bluesky-social/atproto/commit/7d83e7d27ecef5f42f5e3d8d86239eb04df106a3) Thanks [@Laszlo19](https://github.com/Laszlo19)! - Add Romanian (`ro`) translations.

- [#5377](https://github.com/bluesky-social/atproto/pull/5377) [`795f2c1`](https://github.com/bluesky-social/atproto/commit/795f2c1f5663c1fd1d03577aae86e7bc5d4e1a23) Thanks [@bigmoves](https://github.com/bigmoves)! - Show the current email address and username on the account management screen at every viewport width. They were previously hidden below the `sm` breakpoint, so on mobile the rows gave no indication of what the setting was currently set to. The update-email dialog now names the address it is replacing, and email addresses quoted in dialog copy wrap instead of overflowing the dialog.

## 0.9.2

### Patch Changes

- [#5361](https://github.com/bluesky-social/atproto/pull/5361) [`b47f379`](https://github.com/bluesky-social/atproto/commit/b47f3799adc6ce6fc6435b6009c39044266894b1) Thanks [@bigmoves](https://github.com/bigmoves)! - Center the "You are being redirected..." copy on the post-authorization screen.

- [#5387](https://github.com/bluesky-social/atproto/pull/5387) [`4e18a00`](https://github.com/bluesky-social/atproto/commit/4e18a00b2de97e36b9b00a7fcb8713efd87964d1) Thanks [@bigmoves](https://github.com/bigmoves)! - Internal clean-up of the OAuth provider API surface: the UI now imports the
  CSRF cookie/header names and the API endpoint prefix from
  `@atproto/oauth-provider-api` instead of re-declaring them, and optional GET
  parameters are omitted from the query string rather than sent as the literal
  string `"undefined"`.
- Updated dependencies [[`4e18a00`](https://github.com/bluesky-social/atproto/commit/4e18a00b2de97e36b9b00a7fcb8713efd87964d1)]:
  - @atproto/oauth-provider-api@0.8.0

## 0.9.1

### Patch Changes

- [#5334](https://github.com/bluesky-social/atproto/pull/5334) [`b4d71fc`](https://github.com/bluesky-social/atproto/commit/b4d71fc24f1c907daa67460251f2a8dc904359f9) Thanks [@dependabot](https://github.com/apps/dependabot)! - Bump react-error-boundary from 5.0.0 to 6.1.2

## 0.9.0

### Minor Changes

- [#5305](https://github.com/bluesky-social/atproto/pull/5305) [`fca9bd8`](https://github.com/bluesky-social/atproto/commit/fca9bd8fd3384a1f45f9540654edac8db774aecb) Thanks [@bigmoves](https://github.com/bigmoves)! - Rebuild the OAuth provider UI on shadcn/ui (Base UI, `base-nova`). Same flows,
  steps and copy; the UX patterns are recomposed for shadcn. Forms use the
  browser's native constraint validation on Base UI (no form library), icons move
  to Lucide, and toasts to the Base UI toast. Branding colours configured on the
  provider apply at runtime, with a neutral fallback when none are set.

### Patch Changes

- [#5305](https://github.com/bluesky-social/atproto/pull/5305) [`fca9bd8`](https://github.com/bluesky-social/atproto/commit/fca9bd8fd3384a1f45f9540654edac8db774aecb) Thanks [@bigmoves](https://github.com/bigmoves)! - Add an optional per-scheme background image to the authorization screens via `branding.background`. The provider paints the configured light and dark image behind the auth card (`cover` / `center` over the neutral base), chosen by `prefers-color-scheme`. On the PDS, configure it with `PDS_BACKGROUND_LIGHT_URL` and `PDS_BACKGROUND_DARK_URL`.

- [#5311](https://github.com/bluesky-social/atproto/pull/5311) [`16bfd80`](https://github.com/bluesky-social/atproto/commit/16bfd80750e389b58a634226a24c4ae93a7c95c4) Thanks [@dolciss](https://github.com/dolciss)! - Update Japanese translations

## 0.8.11

### Patch Changes

- [#5310](https://github.com/bluesky-social/atproto/pull/5310) [`2021690`](https://github.com/bluesky-social/atproto/commit/2021690f281bcee7178a040bf9fa6baadff06f82) Thanks [@nilaallj](https://github.com/nilaallj)! - Updated Swedish translations

- [#5296](https://github.com/bluesky-social/atproto/pull/5296) [`aad541b`](https://github.com/bluesky-social/atproto/commit/aad541bb0577cefecdc2af315dd1ad216912b1ad) Thanks [@nilaallj](https://github.com/nilaallj)! - l10n: Plural formatting + string concatenation fixes

- Updated dependencies []:
  - @atproto/oauth-provider-api@0.7.9

## 0.8.10

### Patch Changes

- [#5295](https://github.com/bluesky-social/atproto/pull/5295) [`6a3d607`](https://github.com/bluesky-social/atproto/commit/6a3d6073cb66c527b5b109242049c85c36b9658c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update lingui dependency

- [#5295](https://github.com/bluesky-social/atproto/pull/5295) [`6a3d607`](https://github.com/bluesky-social/atproto/commit/6a3d6073cb66c527b5b109242049c85c36b9658c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update vitest dependencies

- [#5295](https://github.com/bluesky-social/atproto/pull/5295) [`6a3d607`](https://github.com/bluesky-social/atproto/commit/6a3d6073cb66c527b5b109242049c85c36b9658c) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update Vite to version 8

- [#5301](https://github.com/bluesky-social/atproto/pull/5301) [`8c07338`](https://github.com/bluesky-social/atproto/commit/8c07338232aa69427aa65322a555f70e0211d6d7) Thanks [@43081j](https://github.com/43081j)! - Switch from destructured default imports to named imports of CommonJS dependencies.

- Updated dependencies []:
  - @atproto/oauth-provider-api@0.7.8

## 0.8.9

### Patch Changes

- [#5286](https://github.com/bluesky-social/atproto/pull/5286) [`6866a5d`](https://github.com/bluesky-social/atproto/commit/6866a5d40be652bd83177332183ef346223f6012) Thanks [@dolciss](https://github.com/dolciss)! - Add Japanese (ja) translations

## 0.8.8

### Patch Changes

- [#5220](https://github.com/bluesky-social/atproto/pull/5220) [`5d2943e`](https://github.com/bluesky-social/atproto/commit/5d2943ea2ab1eea1f0d522d38ca5a047c3380c79) Thanks [@AG0708](https://github.com/AG0708)! - Show each connected app's granted OAuth permissions before access is revoked.

- [#5280](https://github.com/bluesky-social/atproto/pull/5280) [`9556dcb`](https://github.com/bluesky-social/atproto/commit/9556dcb5855a1a1b9a2dc119e0fd4abbb8b27198) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove redundent `vitest.config.ts` file

- [#5273](https://github.com/bluesky-social/atproto/pull/5273) [`87e6a95`](https://github.com/bluesky-social/atproto/commit/87e6a95c39f199e53b6a68b7d1fa23fbe8459753) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix a bug that would cause oauth session not recently refreshed not to be listed in the UI.

- [#5274](https://github.com/bluesky-social/atproto/pull/5274) [`0e773f3`](https://github.com/bluesky-social/atproto/commit/0e773f33468c5ecf14c5e999512b86fa697d4bff) Thanks [@bigmoves](https://github.com/bigmoves)! - Fix missing list bullets on the account "About" page at mobile widths, where the base `prose` class was only applied from the `md` breakpoint up.

- [#5275](https://github.com/bluesky-social/atproto/pull/5275) [`d692128`](https://github.com/bluesky-social/atproto/commit/d6921289c2c537c8d1cead65e7ad4f81f11299f6) Thanks [@bigmoves](https://github.com/bigmoves)! - Remove the `↗` marker appended to external links.

- [#5268](https://github.com/bluesky-social/atproto/pull/5268) [`602f4a8`](https://github.com/bluesky-social/atproto/commit/602f4a8199d5db0cf98bb6fe09010c0a375c8554) Thanks [@bigmoves](https://github.com/bigmoves)! - Restore the current authorization flow step on page refresh by encoding it in the URL fragment (`#step=<slug>`)

- [#5188](https://github.com/bluesky-social/atproto/pull/5188) [`28caa70`](https://github.com/bluesky-social/atproto/commit/28caa70dd4c4406eccce35d72adee23354c377ae) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update react dependency

- [#5269](https://github.com/bluesky-social/atproto/pull/5269) [`df27599`](https://github.com/bluesky-social/atproto/commit/df275998ad56b21a49e102b2fc1a2e5ee9e5bfc3) Thanks [@bigmoves](https://github.com/bigmoves)! - Use "sign in" terminology consistently in the OAuth authorization flow: the post-authorization redirect screen now says "Sign-in complete" / "Sign-in canceled" (previously "Login complete" / "Login canceled"), and the account picker's "Another account" option is labeled "Sign in to an account that is not listed"

- Updated dependencies [[`87e6a95`](https://github.com/bluesky-social/atproto/commit/87e6a95c39f199e53b6a68b7d1fa23fbe8459753)]:
  - @atproto/oauth-provider-api@0.7.7

## 0.8.7

### Patch Changes

- Updated dependencies []:
  - @atproto/oauth-provider-api@0.7.6

## 0.8.6

### Patch Changes

- [#5197](https://github.com/bluesky-social/atproto/pull/5197) [`a0c49d9`](https://github.com/bluesky-social/atproto/commit/a0c49d9e8bc685c5a747a8d3b2775c73c63fdb6f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rewrite import statements to be compatible with TypeScript's `verbatimModuleSyntax` config.

- Updated dependencies []:
  - @atproto/oauth-provider-api@0.7.5

## 0.8.5

### Patch Changes

- [#5177](https://github.com/bluesky-social/atproto/pull/5177) [`54a8364`](https://github.com/bluesky-social/atproto/commit/54a836416064e9394d58d156a0618a5afc73934c) Thanks [@dolciss](https://github.com/dolciss)! - fix: add missing links

- Updated dependencies []:
  - @atproto/oauth-provider-api@0.7.4

## 0.8.4

### Patch Changes

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update TypeScript build to rely on references to composite internal projects

- [#5099](https://github.com/bluesky-social/atproto/pull/5099) [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Bundle only necessary files in the NPM tarball, including the `CHANGELOG.md` and `README.md` files (if present).

- Updated dependencies [[`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07), [`b43ec31`](https://github.com/bluesky-social/atproto/commit/b43ec31f247f4461725b01226885f88bd430ca07)]:
  - @atproto/oauth-provider-api@0.7.3

## 0.8.3

### Patch Changes

- [#5151](https://github.com/bluesky-social/atproto/pull/5151) [`a51c45d`](https://github.com/bluesky-social/atproto/commit/a51c45d38f6bd7b8765f640e564cf921d52162e7) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update dependencies

## 0.8.2

## 0.8.1

### Patch Changes

- [#5111](https://github.com/bluesky-social/atproto/pull/5111) [`abab1ca`](https://github.com/bluesky-social/atproto/commit/abab1ca4c12dba2b3fbaa37c0340aca4c83f861e) Thanks [@nilaallj](https://github.com/nilaallj)! - Add Swedish (`sv`) translations

## 0.8.0

### Minor Changes

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Update `Account` properties to contain strongly typed `did`

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to deactivate and delete account from the account manager interface

### Patch Changes

- [#5106](https://github.com/bluesky-social/atproto/pull/5106) [`6fcf9b2`](https://github.com/bluesky-social/atproto/commit/6fcf9b20d8ed4b30d63f97b9311e81c25f12b684) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use setTimeout and an HTML anchor as redirect strategy

- [#4537](https://github.com/bluesky-social/atproto/pull/4537) [`61c0066`](https://github.com/bluesky-social/atproto/commit/61c006651b874558c1b24110b01806067b93b49a) Thanks [@quiple](https://github.com/quiple)! - Add Corean (ko) translations

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix credentials error not being displayed in sign-in form

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Keep notifications message in sync with the current locale

- [#5053](https://github.com/bluesky-social/atproto/pull/5053) [`9acd39b`](https://github.com/bluesky-social/atproto/commit/9acd39b22ead6c0c56428297de425bd2b9a3c61f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove unused `consentRequired` logic from OAuth consent flow UI

- [#5059](https://github.com/bluesky-social/atproto/pull/5059) [`dd77cdd`](https://github.com/bluesky-social/atproto/commit/dd77cdd4d728c6d9fa0429629cb66266ec88ca96) Thanks [@dolciss](https://github.com/dolciss)! - Add Japanese (ja) translations

- [#4331](https://github.com/bluesky-social/atproto/pull/4331) [`22b0c43`](https://github.com/bluesky-social/atproto/commit/22b0c43401d8c6b8e622e1737333671e8847674f) Thanks [@tdelgado00](https://github.com/tdelgado00)! - Add Spanish (es) translations

- [#5103](https://github.com/bluesky-social/atproto/pull/5103) [`55172ab`](https://github.com/bluesky-social/atproto/commit/55172aba771b54d5eed73e5b314bf7c3a2f7364a) Thanks [@ryanda9910](https://github.com/ryanda9910)! - Fix the OAuth consent screen overstating what an application can do. A request
  scoped to a few specific `app.bsky.*` collections (e.g. only creating
  `app.bsky.feed.post` records) no longer claims the app can "Manage your profile,
  posts, likes and follows". The blanket wording is now reserved for requests that
  actually grant broad write access (any collection or `transition:generic`);
  narrowly scoped Bluesky requests are described as accessing specific parts of the
  account and surface the exact per-collection breakdown instead.

## 0.7.4

### Patch Changes

- [#4967](https://github.com/bluesky-social/atproto/pull/4967) [`9fc720c`](https://github.com/bluesky-social/atproto/commit/9fc720ce75f3ee88a5e48a9be919b07c7647f6f5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use TypeScript 7 to build package

- [#5105](https://github.com/bluesky-social/atproto/pull/5105) [`1d0f332`](https://github.com/bluesky-social/atproto/commit/1d0f3325e09460586ec2d728410f9cdca9e09714) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Always show consent screen at the end of oauth flows

## 0.7.3

### Patch Changes

- [#5089](https://github.com/bluesky-social/atproto/pull/5089) [`85b4eb8`](https://github.com/bluesky-social/atproto/commit/85b4eb84aefaa293e93dcbf976b7b60cb47747fe) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve UX when the browser fails to redirect the user after the OAuth flow ends

- [#5089](https://github.com/bluesky-social/atproto/pull/5089) [`85b4eb8`](https://github.com/bluesky-social/atproto/commit/85b4eb84aefaa293e93dcbf976b7b60cb47747fe) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix error page no longer showing "This request has expired" when navigating back to the authorization page

## 0.7.2

### Patch Changes

- [#4986](https://github.com/bluesky-social/atproto/pull/4986) [`6c63f7d`](https://github.com/bluesky-social/atproto/commit/6c63f7dca6d37c22a8dd5d579ad6a72e532fc372) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Removal of dead and deprecated code

- [#4986](https://github.com/bluesky-social/atproto/pull/4986) [`6c63f7d`](https://github.com/bluesky-social/atproto/commit/6c63f7dca6d37c22a8dd5d579ad6a72e532fc372) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve form related UX (and DX) by using a unified form component that properly surfaces submission errors.

- [#4986](https://github.com/bluesky-social/atproto/pull/4986) [`6c63f7d`](https://github.com/bluesky-social/atproto/commit/6c63f7dca6d37c22a8dd5d579ad6a72e532fc372) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add ability to change the user handle through the account manager interface

- [#4986](https://github.com/bluesky-social/atproto/pull/4986) [`6c63f7d`](https://github.com/bluesky-social/atproto/commit/6c63f7dca6d37c22a8dd5d579ad6a72e532fc372) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Display an error message if "Deny access" causes an error (e.g. network)

- [#4986](https://github.com/bluesky-social/atproto/pull/4986) [`6c63f7d`](https://github.com/bluesky-social/atproto/commit/6c63f7dca6d37c22a8dd5d579ad6a72e532fc372) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove the need to complete the hCaptcha again when there is a form submission error, or when the user navigates "back" to a previous step, then "forward" again to the step with the hCaptcha.

## 0.7.1

### Patch Changes

- [#5008](https://github.com/bluesky-social/atproto/pull/5008) [`30ccc25`](https://github.com/bluesky-social/atproto/commit/30ccc25adfa8ef3b5393c65ab8af9b827e1e2c80) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Increase maximum handle length in OAuth flow

## 0.7.0

### Minor Changes

- [#4883](https://github.com/bluesky-social/atproto/pull/4883) [`64f5148`](https://github.com/bluesky-social/atproto/commit/64f5148ad8dcd669f77a9e022bd2622b2e594e0d) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for email verification and management in the account management interface

## 0.6.0

### Minor Changes

- [#4929](https://github.com/bluesky-social/atproto/pull/4929) [`f01c59f`](https://github.com/bluesky-social/atproto/commit/f01c59f5bd3f75fb8b47a9eecd4858b84033fb7c) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Drop support for Node.js 18 and 20. Node.js 22 is now the minimum supported version. Docker images now use Node.js 24.

- [#4943](https://github.com/bluesky-social/atproto/pull/4943) [`c459153`](https://github.com/bluesky-social/atproto/commit/c459153395a30ce89e050892c8fab7dc98e019b9) Thanks [@devinivy](https://github.com/devinivy)! - **BREAKING:** Convert to pure ESM. All packages now ship `"type": "module"` with ES module output and Node16 module resolution.

  Node.js 22's `require()` compatibility layer can still load these packages in CommonJS code.

- [#4930](https://github.com/bluesky-social/atproto/pull/4930) [`908bece`](https://github.com/bluesky-social/atproto/commit/908bece169258bff5ad121e5eec157d6ded6f705) Thanks [@devinivy](https://github.com/devinivy)! - Build with TypeScript 6.0.

## 0.5.2

### Patch Changes

- [#4880](https://github.com/bluesky-social/atproto/pull/4880) [`5d3e248`](https://github.com/bluesky-social/atproto/commit/5d3e248c262f45e3ca471d8d2381830a4cd896ae) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix `/.well-known/change-password` page

## 0.5.1

### Patch Changes

- [#4873](https://github.com/bluesky-social/atproto/pull/4873) [`84eb5ed`](https://github.com/bluesky-social/atproto/commit/84eb5ed95d145870a85ea380df3edf6c591c6310) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix reset password flow

## 0.5.0

### Minor Changes

- [#4820](https://github.com/bluesky-social/atproto/pull/4820) [`b3ce11a`](https://github.com/bluesky-social/atproto/commit/b3ce11ae2e965f239db6aec6054f069d557f4d55) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Unify account management and authorization pages into a signle package

### Patch Changes

- [#4820](https://github.com/bluesky-social/atproto/pull/4820) [`b3ce11a`](https://github.com/bluesky-social/atproto/commit/b3ce11ae2e965f239db6aec6054f069d557f4d55) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Account management interface improvements

## 0.4.3

### Patch Changes

- [#4619](https://github.com/bluesky-social/atproto/pull/4619) [`a2e4e95`](https://github.com/bluesky-social/atproto/commit/a2e4e9584730c1742aca7c1fcc59533a7c159740) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix depencies version

- [#4607](https://github.com/bluesky-social/atproto/pull/4607) [`19ecf5f`](https://github.com/bluesky-social/atproto/commit/19ecf5f76ae0d88c1963211a76920e00eecdd965) Thanks [@mozzius](https://github.com/mozzius)! - Fix avatar shape in OAuth UI

- [#4606](https://github.com/bluesky-social/atproto/pull/4606) [`78fee14`](https://github.com/bluesky-social/atproto/commit/78fee144ff46ffc4585f318c72eea98e4357ba7b) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add console error logging upon client-side API request errors

## 0.4.2

## 0.4.1

## 0.4.0

### Minor Changes

- [#4461](https://github.com/bluesky-social/atproto/pull/4461) [`5d8e7a6`](https://github.com/bluesky-social/atproto/commit/5d8e7a6588fc9e57e15d83d47bb45103205e3e41) Thanks [@ThisIsMissEm](https://github.com/ThisIsMissEm)! - Support selecting view based on prompt parameter

## 0.3.6

### Patch Changes

- [#4382](https://github.com/bluesky-social/atproto/pull/4382) [`be8e6c1`](https://github.com/bluesky-social/atproto/commit/be8e6c1f25814202b98e2616a217599a6c46e0db) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `toScopes()` utility on `IncludeScope`

## 0.3.5

## 0.3.4

### Patch Changes

- [#4301](https://github.com/bluesky-social/atproto/pull/4301) [`f496fa2c4`](https://github.com/bluesky-social/atproto/commit/f496fa2c4d9316229523454c691c75c269aba21e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Set dark background on authorization page's `<body>` in dark mode

## 0.3.3

## 0.3.2

## 0.3.1

### Patch Changes

- [#4186](https://github.com/bluesky-social/atproto/pull/4186) [`d570db43d`](https://github.com/bluesky-social/atproto/commit/d570db43d6df2044dbaa5813cac469b3e73ba219) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add Japanese translation on OAuth Provider UI

## 0.3.0

### Minor Changes

- [`f4cb3e4d0`](https://github.com/bluesky-social/atproto/commit/f4cb3e4d0ac45e567fa14f79b99a84621fa89a56) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Adapt to UI to support permission set.

## 0.2.1

## 0.2.0

### Minor Changes

- [#3806](https://github.com/bluesky-social/atproto/pull/3806) [`1899b1fc1`](https://github.com/bluesky-social/atproto/commit/1899b1fc16bc5cd7bb930ec697898766c3a05add) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Display detailed description of requested permissions

## 0.1.11

## 0.1.10

## 0.1.9

## 0.1.8

## 0.1.7

### Patch Changes

- [#3916](https://github.com/bluesky-social/atproto/pull/3916) [`71b9dcda9`](https://github.com/bluesky-social/atproto/commit/71b9dcda9611ab3662ccb2c4e175579396f16b3a) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Show sign-in screen instead of welcome screen when user already signed-in

## 0.1.6

### Patch Changes

- [`d1e3e68dd`](https://github.com/bluesky-social/atproto/commit/d1e3e68dd9eb7bed13d9023bc0e4ce3c448eabf5) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Improve auto completion of sing-in & reset password flows

## 0.1.5

### Patch Changes

- [#3820](https://github.com/bluesky-social/atproto/pull/3820) [`8318c5718`](https://github.com/bluesky-social/atproto/commit/8318c57187a1fed443be73bfd7639f49febc7337) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add support for `transition:email` oauth scope

## 0.1.4

### Patch Changes

- [#3810](https://github.com/bluesky-social/atproto/pull/3810) [`e1bda27e5`](https://github.com/bluesky-social/atproto/commit/e1bda27e550d3ba9dab1fab1f27726c185d8bf9f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix CORS issue on `<img>` tags

- [#3797](https://github.com/bluesky-social/atproto/pull/3797) [`a48b093f0`](https://github.com/bluesky-social/atproto/commit/a48b093f0ba3cf67b7abc50d309afcb336d8ead8) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use more consistent UI regardless of profile completion

## 0.1.3

### Patch Changes

- [#3778](https://github.com/bluesky-social/atproto/pull/3778) [`81524fcb0`](https://github.com/bluesky-social/atproto/commit/81524fcb007f12161fd6928badbf176b1568b4b3) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Minor UI fixes

- [#3781](https://github.com/bluesky-social/atproto/pull/3781) [`a70dad5ae`](https://github.com/bluesky-social/atproto/commit/a70dad5aea32ce26d2cca170a06d184935b4865d) Thanks [@estrattonbailey](https://github.com/estrattonbailey)! - Remove lazy loading of hcaptcha library to resolve chunk loading errors.

## 0.1.2

## 0.1.1

### Patch Changes

- [#3754](https://github.com/bluesky-social/atproto/pull/3754) [`1e461eab0`](https://github.com/bluesky-social/atproto/commit/1e461eab033f728f537db554b3072b7eda7e5e8f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix dependencies

- [#3754](https://github.com/bluesky-social/atproto/pull/3754) [`1e461eab0`](https://github.com/bluesky-social/atproto/commit/1e461eab033f728f537db554b3072b7eda7e5e8f) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Explicit exported package `files`

## 0.1.0

### Minor Changes

- [#3659](https://github.com/bluesky-social/atproto/pull/3659) [`371e04aad`](https://github.com/bluesky-social/atproto/commit/371e04aad2a3e8ae3fe185ce15fc8eb051cab78e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - New build system

### Patch Changes

- [#3667](https://github.com/bluesky-social/atproto/pull/3667) [`8b98fec88`](https://github.com/bluesky-social/atproto/commit/8b98fec8857aacddeed9efb5c755474951e6d9d4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Hide client id pathname if it is exaclty `/oauth-client-metadata.json`

## 0.0.2

### Patch Changes

- [#3640](https://github.com/bluesky-social/atproto/pull/3640) [`cc4122652`](https://github.com/bluesky-social/atproto/commit/cc4122652ed42ba55826c019d0ec57bf25df1ecd) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Split OAuth Provider's ui into its own package
