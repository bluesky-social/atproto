# @atproto/lex-schema

## 0.0.4

### Patch Changes

- Updated dependencies [[`693784c`](https://github.com/bluesky-social/atproto/commit/693784c3a0dee4b6a29aa1e018fce682dcae148f)]:
  - @atproto/lex-data@0.0.3

## 0.0.3

### Patch Changes

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `default` option to `literal` and `enum` schemas

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rework object validation logic to work without `options` argument

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - `literal` schemas no longer use the value as "default". The "default" must now be explicitly provided.

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `l.nullable` for nullable object properties and `l.optional` for optional object properties in lex schemas.

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `l.refine` utility to add custom refinements to existing schemas.

- [#4401](https://github.com/bluesky-social/atproto/pull/4401) [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add test suite for all schema types

- [#4401](https://github.com/bluesky-social/atproto/pull/4401) [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Allow `array` schema's generic to be both a Validator type or an item value type

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Validation issues are now child classed to the `Issue` abstract class instead of simple objects with interfaces. This allows for better extensibility and custom behavior on issues (such as custom error messages).

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Replace use of `CID` with `Cid`

- [#4401](https://github.com/bluesky-social/atproto/pull/4401) [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Drop `lexiconType` property

- [#4401](https://github.com/bluesky-social/atproto/pull/4401) [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Fix type of `typedObject` and `record` schemas

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove options (`required`, `nullable`) from `object` schemas. Those are replaced by `l.optional` and `l.nullable` wrappers.

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Discriminated unions now only accept discriminators to be declared a `literal` or `enum` schemas and will throw at initialization if discriminators values aren't strictly disjoined.

- [#4389](https://github.com/bluesky-social/atproto/pull/4389) [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use string formats from `@atproto/syntax`

- [#4389](https://github.com/bluesky-social/atproto/pull/4389) [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `l.regexp` schema builder

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Require `l.discriminatedUnion` discriminator field to be a `literal` or `enum` schema

- [#4401](https://github.com/bluesky-social/atproto/pull/4401) [`a487ab8`](https://github.com/bluesky-social/atproto/commit/a487ab8afe8f18d00662e666049be8d28de2b57e) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Simplify `ParamsSchema` interface

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Remove options (`required`) from `params` schemas. Those are replaced by `l.optional` wrappers.

- [#4387](https://github.com/bluesky-social/atproto/pull/4387) [`9f87ff3`](https://github.com/bluesky-social/atproto/commit/9f87ff3aa60090c8c38b6ce400cba6ceff5cd2e9) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Simplify `dict` type definition

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Rename schema methods `validate`, `check` and `maybe` to `safeParse`, `matches` and `ifMatches` respectively.

- [#4397](https://github.com/bluesky-social/atproto/pull/4397) [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `CHANGELOG.md` to npm package

- [#4390](https://github.com/bluesky-social/atproto/pull/4390) [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Add `default` option to `const` and `enum` schemas

- Updated dependencies [[`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`1d445af`](https://github.com/bluesky-social/atproto/commit/1d445af2a7fc27eca5a45869b29266e6a2a7f3ba), [`bcae2b7`](https://github.com/bluesky-social/atproto/commit/bcae2b77b68da6dc2ec202651c8bf41fd5769f69), [`688f9d6`](https://github.com/bluesky-social/atproto/commit/688f9d67597ba96d6e9c4a4aec4d394d42f4cbf4)]:
  - @atproto/lex-data@0.0.2
  - @atproto/syntax@0.4.2

## 0.0.2

### Patch Changes

- [#4380](https://github.com/bluesky-social/atproto/pull/4380) [`23c271f`](https://github.com/bluesky-social/atproto/commit/23c271fcac27f090727e2f835697d4733784bdb4) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Use `literal` value as default

## 0.0.1

### Patch Changes

- [#4371](https://github.com/bluesky-social/atproto/pull/4371) [`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af) Thanks [@matthieusieben](https://github.com/matthieusieben)! - Release

- Updated dependencies [[`46550d6`](https://github.com/bluesky-social/atproto/commit/46550d6c1ffb298f57d54eb1904067b2df5a40af)]:
  - @atproto/lex-data@0.0.1
