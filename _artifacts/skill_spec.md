# @atproto/lex — Skill Spec

Type-safe Lexicon tooling for the AT Protocol. Provides a CLI to install and
generate TypeScript from Lexicon schemas, a typed XRPC client for making API
requests, and a Client class for authenticated record management. Part of the
atproto monorepo with 12 sub-packages under `packages/lex/`.

## Domains

| Domain                  | Description                                            | Skills                             |
| ----------------------- | ------------------------------------------------------ | ---------------------------------- |
| Schema Management       | Installing Lexicon schemas and generating TypeScript   | lexicon-management, schema-codegen |
| Data Handling           | Data types, validation, encoding, and schema utilities | data-validation, data-model        |
| Network Communication   | XRPC requests, auth sessions, and record CRUD          | xrpc-requests, client-api          |
| Composition & Extension | Actions, Client composition, and server infrastructure | actions-composition, server-setup  |

## Skill Inventory

| Skill               | Type | Domain                | What it covers                                       | Failure modes |
| ------------------- | ---- | --------------------- | ---------------------------------------------------- | ------------- |
| lexicon-management  | core | schema-management     | lex install CLI, manifest, CID verification, deps    | 3             |
| schema-codegen      | core | schema-management     | lex build CLI, output options, workflow integration  | 3             |
| data-validation     | core | data-handling         | $build/$validate/$parse/$check, l namespace, formats | 5             |
| xrpc-requests       | core | network-communication | xrpc()/xrpcSafe(), error types, retry                | 4             |
| client-api          | core | network-communication | Client class, CRUD, auth, labelers, proxying         | 6             |
| data-model          | core | data-handling         | LexValue, Cid, BlobRef, JSON/CBOR encoding, datetime | 5             |
| actions-composition | core | composition-extension | Action type, composition, higher-order, library APIs | 3             |
| server-setup        | core | composition-extension | LexRouter, service auth, WebSocket, Node.js adapter  | 4             |

## Failure Mode Inventory

### Lexicon Management (3 failure modes)

| #   | Mistake                                           | Priority | Source               | Cross-skill? |
| --- | ------------------------------------------------- | -------- | -------------------- | ------------ |
| 1   | Forgetting to commit lexicons.json manifest       | HIGH     | README               | —            |
| 2   | Using --ci without saving first                   | MEDIUM   | lex-installer source | —            |
| 3   | Not understanding recursive dependency resolution | MEDIUM   | lex-installer source | —            |

### Schema Code Generation (3 failure modes)

| #   | Mistake                                     | Priority | Source             | Cross-skill? |
| --- | ------------------------------------------- | -------- | ------------------ | ------------ |
| 1   | Missing prebuild script for codegen         | HIGH     | README             | —            |
| 2   | Not using --pure-annotations for libraries  | MEDIUM   | README             | —            |
| 3   | Using --indexFile with .index TLD namespace | MEDIUM   | lex-builder source | —            |

### Data Validation (5 failure modes)

| #   | Mistake                                     | Priority | Source            | Cross-skill? |
| --- | ------------------------------------------- | -------- | ----------------- | ------------ |
| 1   | Confusing $validate with $parse             | CRITICAL | lex-schema source | —            |
| 2   | Using $check when $isTypeOf is needed       | HIGH     | README            | —            |
| 3   | Omitting $type in $validate but not $build  | HIGH     | lex-schema source | —            |
| 4   | Using open union when closed is needed      | MEDIUM   | lex-schema source | —            |
| 5   | Expecting floats to pass integer validation | MEDIUM   | lex-schema source | —            |

### XRPC Requests (4 failure modes)

| #   | Mistake                                     | Priority | Source            | Cross-skill? |
| --- | ------------------------------------------- | -------- | ----------------- | ------------ |
| 1   | Using xrpc() without error handling         | HIGH     | README            | —            |
| 2   | Not using AbortSignal for timeouts          | HIGH     | README            | —            |
| 3   | Passing body with query methods             | MEDIUM   | lex-server source | —            |
| 4   | Ignoring shouldRetry() for transient errors | MEDIUM   | lex-client source | —            |

### Client API (6 failure modes)

| #   | Mistake                                         | Priority | Source               | Cross-skill? |
| --- | ----------------------------------------------- | -------- | -------------------- | ------------ |
| 1   | Using new Date().toISOString() for createdAt    | CRITICAL | README               | data-model   |
| 2   | Missing rkey for non-literal record keys        | HIGH     | lex-client source    | —            |
| 3   | Not using swapRecord for concurrent updates     | HIGH     | README               | —            |
| 4   | Calling Client methods without authentication   | HIGH     | lex-client source    | —            |
| 5   | ReadableStream body prevents retry on 401       | MEDIUM   | lex-password-session | —            |
| 6   | Not configuring labelers for content moderation | MEDIUM   | README               | —            |

### Data Model (5 failure modes)

| #   | Mistake                                       | Priority | Source          | Cross-skill?    |
| --- | --------------------------------------------- | -------- | --------------- | --------------- |
| 1   | Using JSON.parse instead of lexParse          | CRITICAL | README          | —               |
| 2   | Using string length instead of graphemeLen    | CRITICAL | README/lex-data | data-validation |
| 3   | Constructing BlobRef without proper structure | HIGH     | lex-data source | —               |
| 4   | Not handling legacy blob refs in old records  | MEDIUM   | README          | —               |
| 5   | Comparing CIDs with === instead of .equals()  | HIGH     | lex-data source | —               |

### Actions Composition (3 failure modes)

| #   | Mistake                                        | Priority | Source | Cross-skill? |
| --- | ---------------------------------------------- | -------- | ------ | ------------ |
| 1   | Not calling assertAuthenticated in Actions     | HIGH     | README | —            |
| 2   | Not forwarding options/signal to sub-calls     | HIGH     | README | —            |
| 3   | Bundling Actions in a class instead of exports | MEDIUM   | README | —            |

### Server Setup (4 failure modes)

| #   | Mistake                                          | Priority | Source            | Cross-skill? |
| --- | ------------------------------------------------ | -------- | ----------------- | ------------ |
| 1   | Not providing upgradeWebSocket for subscriptions | HIGH     | lex-server source | —            |
| 2   | Registering duplicate XRPC methods               | MEDIUM   | lex-server source | —            |
| 3   | Not handling iterator cleanup errors             | HIGH     | lex-server source | —            |
| 4   | Accepting JWT with alg:none or typ:at+jwt        | CRITICAL | lex-server source | —            |

## Tensions

| Tension                                | Skills                                | Agent implication                                                                          |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Validation strictness vs. ease of use  | data-validation ↔ client-api         | Agent uses $validate everywhere (false rejections) or $parse everywhere (silent mutations) |
| Type safety vs. runtime performance    | data-validation ↔ xrpc-requests      | Agent enables all validation (slow) or disables all (unsafe)                               |
| Simple xrpc() vs. Client abstraction   | xrpc-requests ↔ client-api           | Agent over-engineers scripts with Client or under-engineers apps with xrpc()               |
| Tree-shaking vs. developer convenience | schema-codegen ↔ actions-composition | Agent wraps Actions in classes, defeating tree-shaking                                     |

## Cross-References

| From               | To                  | Reason                                                       |
| ------------------ | ------------------- | ------------------------------------------------------------ |
| lexicon-management | schema-codegen      | lex install must run before lex build                        |
| data-validation    | data-model          | Validation operates on data model types (CID, BlobRef)       |
| xrpc-requests      | client-api          | Client.xrpc() delegates to xrpc(), same error types          |
| client-api         | actions-composition | Actions invoked via client.call(), need Client understanding |
| data-model         | client-api          | Client CRUD methods accept/return data model types           |
| schema-codegen     | data-validation     | lex build generates the schema objects for validation        |
| data-validation    | server-setup        | Server uses same schema system for request validation        |

## Subsystems & Reference Candidates

| Skill           | Subsystems | Reference candidates                                       |
| --------------- | ---------- | ---------------------------------------------------------- |
| data-validation | —          | l namespace (>30 builders), string formats (11 validators) |
| data-model      | —          | —                                                          |
| server-setup    | —          | —                                                          |
| All others      | —          | —                                                          |

## Remaining Gaps

| Skill              | Question                                                                 | Status |
| ------------------ | ------------------------------------------------------------------------ | ------ |
| server-setup       | Recommended pattern for structuring multi-route lex-server applications? | open   |
| lexicon-management | How does dependency resolution handle circular NSID references?          | open   |
| client-api         | Recommended error handling for Actions with partial completion?          | open   |

## Recommended Skill File Structure

- **Core skills:** lexicon-management, schema-codegen, data-validation, xrpc-requests, client-api, data-model, actions-composition, server-setup
- **Framework skills:** None (framework-agnostic library)
- **Lifecycle skills:** None currently (potential: getting-started, migration)
- **Composition skills:** None currently (potential: oauth-integration)
- **Reference files:** data-validation (l namespace reference, string formats reference)

## Composition Opportunities

| Library                    | Integration points                 | Composition skill needed?           |
| -------------------------- | ---------------------------------- | ----------------------------------- |
| @atproto/oauth-client      | Session management for Client auth | No (documented in Client API skill) |
| @atproto/oauth-client-node | Server-side OAuth for Node.js      | No (documented in Client API skill) |
| @atproto/syntax            | AtUri, NSID, Handle parsing        | No (used internally)                |
| @atproto/crypto            | Key management for service auth    | No (used internally by lex-server)  |
