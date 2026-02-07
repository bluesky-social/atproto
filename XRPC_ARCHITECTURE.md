# XRPC Server Architecture

## Overview

This document explains how the `@atproto/xrpc-server` package works in the PDS, based on analysis of the source code in `packages/xrpc-server/src/`.

## Key Components

### 1. Lexicon Schemas

**Location**: `lexicons/**/*.json`

Lexicon schemas are JSON files that define:
- NSID (Namespace ID): e.g., `app.bsky.bookmark.createBookmark`
- Type: `query`, `procedure`, or `subscription`
- Input schema: Expected request body structure
- Output schema: Expected response structure
- Parameters: Query parameters

**Example** (`lexicons/app/bsky/bookmark/createBookmark.json`):
```json
{
  "lexicon": 1,
  "id": "app.bsky.bookmark.createBookmark",
  "defs": {
    "main": {
      "type": "procedure",
      "input": {
        "encoding": "application/json",
        "schema": {
          "type": "object",
          "required": ["uri", "cid"],
          "properties": {
            "uri": { "type": "string", "format": "at-uri" },
            "cid": { "type": "string", "format": "cid" }
          }
        }
      }
    }
  }
}
```

### 2. Lexicon Code Generation

**Command**: `pnpm codegen` (in `packages/pds/package.json`)

**What it does**:
```bash
lex gen-server --yes ./src/lexicon ../../lexicons/app/bsky/*/*
```

This generates TypeScript files in `packages/pds/src/lexicon/`:
- `lexicons.ts`: Contains all schemas as JavaScript objects
- `index.ts`: Creates server class with typed method wrappers
- `types/**/*.ts`: TypeScript type definitions for each endpoint

**Important**: Code generation does NOT register handlers - it only creates:
1. Type definitions
2. Schema objects for XRPC server validation
3. Wrapper methods for registering handlers

### 3. XRPC Server Initialization

**File**: `packages/pds/src/lexicon/index.ts`

```typescript
export function createServer(options?: XrpcOptions): Server {
  return new Server(options)
}

export class Server {
  xrpc: XrpcServer

  constructor(options?: XrpcOptions) {
    // Creates XRPC server with ALL generated schemas
    this.xrpc = createXrpcServer(schemas, options)
  }
}
```

**Key Point**: The XRPC server is initialized with ALL schemas from `lexicons.ts`, regardless of whether handlers are registered.

### 4. Handler Registration

**File**: `packages/pds/src/api/**/*.ts`

Handlers are registered explicitly by calling the generated methods:

```typescript
// Example: Registering a handler for com.atproto.server.createAccount
server.com.atproto.server.createAccount({
  handler: async ({ input, req, res }) => {
    // Implementation here
    return { encoding: 'application/json', body: {...} }
  }
})
```

**What happens when you register a handler**:
1. `server.com.atproto.server.createAccount(config)` is called
2. This calls `this._server.xrpc.method(nsid, config)`
3. XRPC calls `addMethod(nsid, config)`
4. XRPC calls `addRoute(nsid, def, config)` (line 179 in `xrpc-server/src/server.ts`)
5. `addRoute` calls `createHandler(nsid, def, config)` (line 186)
6. `createHandler` creates an `inputVerifier` that parses the request body
7. Route is registered: `this.routes.post(path, handler)` (line 189)

## Request Flow

### Flow for Endpoints WITH Registered Handlers

```
1. Request arrives: POST /xrpc/com.atproto.server.createAccount
2. Express router matches registered route
3. Handler executes (created by createHandler):
   a. Parse & validate params (query parameters)
   b. Authenticate request
   c. Parse & validate input (BODY IS CONSUMED HERE)
      - inputVerifier calls bodyParser (express.json() or express.text())
      - Body stream is read and parsed into req.body
      - Validation runs against lexicon schema
   d. Execute handler function
   e. Validate & return output
4. Response sent to client
```

**Critical Code** (`xrpc-server/src/util.ts`, lines 153-154):
```typescript
if (bodyParser) {
  await bodyParser(req, res)  // ← BODY CONSUMED HERE
}
```

### Flow for Endpoints WITHOUT Registered Handlers (Catchall)

```
1. Request arrives: POST /xrpc/app.bsky.bookmark.createBookmark
2. No registered route matches
3. Catchall middleware executes (xrpc-server/src/server.ts, line 195):
   a. Validate XRPC path format
   b. Extract NSID from URL
   c. Run global rate limiter (if configured)
   d. Check if lexicon definition exists: def = this.lex.getDef(nsid)
   e. Validate HTTP method matches definition type
   f. Call custom catchall handler (if configured)
4. PDS catchall: pipethrough.ts proxies to AppView
```

**Important**: The catchall does NOT parse the request body. Body parsing only happens in registered handlers.

### Catchall Code Analysis

**File**: `xrpc-server/src/server.ts`, lines 195-240

```typescript
catchall: CatchallHandler = async (req, res, next) => {
  if (!req.url.startsWith('/xrpc/')) return next()

  const nsid = extractUrlNsid(req.url)
  if (!nsid) {
    return next(new InvalidRequestError('invalid xrpc path'))
  }

  // Check if lexicon definition exists (loaded from schemas)
  const def = this.lex.getDef(nsid)

  if (def) {
    // Validate HTTP method matches definition
    const expectedMethod = def.type === 'procedure' ? 'POST' : 'GET'
    if (expectedMethod !== req.method) {
      return next(new InvalidRequestError(...))
    }
  }

  // Call custom catchall (pipethrough in PDS)
  if (this.options.catchall) {
    this.options.catchall.call(null, req, res, next)
  } else if (!def) {
    next(new MethodNotImplementedError())
  } else {
    next()  // No catchall and def exists - fall through
  }
}
```

**Key Insight**:
- Having a lexicon definition does NOT cause body parsing
- Body parsing only happens in `createHandler` → `inputVerifier`
- `inputVerifier` is only created when a handler is registered via `addRoute`

## PDS Pipethrough

**File**: `packages/pds/src/pipethrough.ts`

The PDS configures a catchall handler that proxies unimplemented endpoints to the AppView:

```typescript
export const proxyHandler = (ctx: AppContext): CatchallHandler => {
  return async (req, res, next) => {
    // Body should be intact here (not consumed)
    const body = req.method === 'POST' ? req : undefined

    // Authenticate and proxy to AppView
    await pipethroughStream(ctx, {
      origin: appViewUrl,
      method: req.method,
      path: req.originalUrl,
      body,  // Original request stream
      headers
    }, ...)
  }
}
```

**Expected Behavior**:
1. Bookmark request arrives at PDS
2. No handler registered → catchall executes
3. Body stream is intact (not consumed)
4. Pipethrough forwards intact stream to AppView
5. AppView processes bookmark and returns response

## Express Middleware Order

**File**: `packages/pds/src/index.ts`, lines 236-245

```typescript
app.use(loggerMiddleware)
app.use(compression())
app.use(authRoutes.createRouter(ctx))
app.use(cors({ maxAge: DAY / SECOND }))
app.use(basicRoutes.createRouter(ctx))
app.use(wellKnown.createRouter(ctx))
app.use(ioTrustanchor(ctx))
app.use(server.xrpc.router)  // ← XRPC router here
app.use(error.handler)
```

The XRPC router (which includes catchall) runs AFTER all other middleware.

## Body Parsing: When Does It Happen?

### Registered Handlers
Body parsing happens in `createInputVerifier` (`xrpc-server/src/util.ts`):

```typescript
export function createInputVerifier(
  nsid: string,
  def: LexXrpcProcedure | LexXrpcQuery,
  options: RouteOptions,
  lexicons: Lexicons,
): (req: Request, res: Response) => Awaitable<Input> {
  if (def.type === 'query' || !def.input) {
    return () => undefined  // No body expected
  }

  // For procedures with input:
  const bodyParser = createBodyParser(input.encoding, options)

  return async (req, res) => {
    // Parse body using Express middleware
    if (bodyParser) {
      await bodyParser(req, res)  // ← Consumes stream
    }

    // Validate against schema
    if (input.schema) {
      req.body = lexicons.assertValidXrpcInput(nsid, req.body)
    }

    // Return parsed body or decoded stream
    const body = req.readableEnded ? req.body : decodeBodyStream(req)
    return { encoding: reqEncoding, body }
  }
}
```

### createBodyParser

**File**: `xrpc-server/src/util.ts`, lines 271-292

```typescript
function createBodyParser(inputEncoding: string, options: RouteOptions) {
  if (inputEncoding === ENCODING_ANY) {
    // When encoding is */*, skip parsing
    return undefined
  }

  const { jsonLimit, textLimit } = options
  const jsonParser = json({ limit: jsonLimit })
  const textParser = text({ limit: textLimit })

  // Returns Express middleware that parses JSON and text
  return (req: Request, res: Response) => {
    return new Promise<void>((resolve, reject) => {
      jsonParser(req, res, (err) => {
        if (err) return reject(err)
        textParser(req, res, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }
}
```

**Key Points**:
- `bodyParser` uses Express's `json()` and `text()` middleware
- These middleware consume the request stream by reading it
- Once consumed, `req.readableEnded` becomes `true`
- Body is stored in `req.body`

### Catchall (No Handler)
**No body parsing occurs**. The catchall:
1. Checks if definition exists (for validation only)
2. Validates HTTP method
3. Calls custom catchall handler
4. Request body stream remains intact

## Official Bluesky PDS Configuration

**Upstream codegen** (`packages/pds/package.json`):
```json
{
  "codegen": "lex gen-server ... ../../lexicons/app/bsky/*/*"
}
```

This includes ALL app.bsky namespaces:
- actor, embed, feed, graph, labeler, notification, etc.
- **Including bookmark** (AppView-only endpoint)

**Official behavior**:
1. Bookmark lexicons ARE loaded into XRPC server
2. Bookmark handlers are NOT registered
3. Bookmark requests go through catchall
4. Body is NOT parsed (catchall doesn't parse)
5. Pipethrough forwards intact body to AppView
6. AppView processes bookmark successfully

## Common Misconceptions

### ❌ "Having a lexicon schema means the body gets parsed"
**FALSE**. Body parsing only happens when:
1. A handler is registered via `addMethod()`
2. The handler's `inputVerifier` is invoked
3. `inputVerifier` calls `bodyParser`

### ❌ "Catchall parses bodies for validation"
**FALSE**. The catchall only:
- Validates XRPC path format
- Checks if definition exists (schema lookup only)
- Validates HTTP method matches definition type
- Calls custom catchall handler

No body reading or parsing occurs in catchall.

### ❌ "We should exclude AppView endpoints from codegen"
**INCORRECT**. The official PDS includes all app.bsky endpoints in codegen, even those implemented only in AppView. This allows:
- Type definitions for client code
- HTTP method validation in catchall
- Future handler implementation without regeneration

### ✅ "Body parsing happens in registered handlers, not catchall"
**CORRECT**. This is the key architectural principle.

## Debugging Body Consumption

If body is consumed before reaching catchall, check:

1. **Custom middleware before XRPC router**
   - Does any middleware read `req.body`?
   - Does any middleware attach body parsers?

2. **Handler registration**
   - Was a handler accidentally registered for the endpoint?
   - Check `packages/pds/src/api/**/*.ts` for handler calls

3. **XRPC configuration**
   - Are there custom options that change behavior?
   - Check `packages/pds/src/index.ts` server initialization

4. **Stream state**
   - Log `req.readable`, `req.readableEnded` at catchall entry
   - Check if earlier middleware consumed stream

## Summary

```
Lexicon Schemas (JSON)
         ↓
   lex gen-server
         ↓
Generated Code (TypeScript)
  - Type definitions
  - Schema objects
  - Method wrappers
         ↓
XRPC Server Initialization
  - Loads ALL schemas
  - No handlers registered yet
         ↓
Handler Registration (Optional)
  - Explicit handler registration
  - Creates routes in Express
  - Body parsing configured per-handler
         ↓
Request Processing:

┌─ Registered Handler ─────────┐
│ 1. Route matches              │
│ 2. Parse params               │
│ 3. Authenticate               │
│ 4. Parse body ← CONSUMES      │
│ 5. Validate input             │
│ 6. Execute handler            │
│ 7. Return response            │
└───────────────────────────────┘

┌─ Catchall (No Handler) ──────┐
│ 1. Validate XRPC path         │
│ 2. Check schema exists        │
│ 3. Validate HTTP method       │
│ 4. Call custom catchall       │
│    → Pipethrough to AppView   │
│ Body: INTACT ← NOT CONSUMED   │
└───────────────────────────────┘
```

## Critical: Global Body Parsing Middleware

### The Problem

When adding custom Express routes to the PDS, it's critical to **avoid global body parsing middleware** that runs before the XRPC router.

**What went wrong** (Real incident, January 2026):

A QuickLogin feature was added with this router structure:

```typescript
// packages/pds/src/api/io/trustanchor/quicklogin/index.ts
export default function (ctx: AppContext): Router {
  const router = Router()
  router.use(express.json())  // ← GLOBAL BODY PARSER - BREAKS XRPC!

  initQuickLogin(router, ctx)       // POST /api/quicklogin/init
  callbackQuickLogin(router, ctx)   // POST /api/quicklogin/callback
  statusQuickLogin(router, ctx)     // POST /api/quicklogin/status

  return router
}
```

This router was mounted globally in the main app:

```typescript
// packages/pds/src/index.ts
app.use(ioTrustanchor(ctx))  // ← Mounted BEFORE XRPC router
app.use(server.xrpc.router)
```

**Impact**:
- ALL requests (including XRPC) went through `express.json()` middleware
- `express.json()` reads the entire request stream into `req.body`
- Request stream becomes consumed: `readableEnded: true, destroyed: true`
- XRPC catchall receives requests with empty/destroyed streams
- Pipethrough tries to forward destroyed stream to AppView
- AppView validation fails: "Input must have property uri"

**Symptom**: Bookmark creation (and other AppView endpoints) returned 500/400 errors after QuickLogin implementation.

### The Root Cause

Express middleware behavior:
- `router.use(middleware)` applies to **ALL routes** in that router
- `app.use(router)` mounts router globally - middleware affects **ALL app requests**
- Body parsing middleware (`express.json()`, `express.text()`) **consumes request streams**
- Once consumed, streams cannot be read again

Node.js stream properties after consumption:
```javascript
req.readable        // true (doesn't mean has data)
req.readableEnded   // true (all data read/emitted)
req.readableLength  // 0 (no bytes in buffer)
req.destroyed       // true (stream destroyed)
```

The pipethrough code expects an intact stream:
```typescript
// If body was already parsed, this will forward empty stream
const body = req.method === 'POST' ? req : undefined
```

### The Solution

**Apply body parsing only to routes that need it**:

```typescript
// packages/pds/src/api/io/trustanchor/quicklogin/index.ts
export default function (ctx: AppContext): Router {
  const router = Router()
  // NO global router.use(express.json()) ← REMOVED

  // Each route applies middleware individually
  initQuickLogin(router, ctx)
  callbackQuickLogin(router, ctx)
  statusQuickLogin(router, ctx)

  return router
}
```

```typescript
// packages/pds/src/api/io/trustanchor/quicklogin/init.ts
import express from 'express'

export const initQuickLogin = (router: Router, ctx: AppContext) => {
  router.post('/api/quicklogin/init',
    express.json(),  // ← Route-specific middleware
    async (req, res) => {
      const { allowCreate } = req.body
      // ...
    }
  )
}
```

Similarly for callback and status routes - each applies `express.json()` individually.

### Best Practices

#### ✅ DO

1. **Route-specific body parsing**:
   ```typescript
   router.post('/api/custom', express.json(), handler)
   ```

2. **Conditional global middleware** (only for non-XRPC routes):
   ```typescript
   router.use('/api/custom/*', express.json())
   ```

3. **Middleware after XRPC router**:
   ```typescript
   app.use(server.xrpc.router)  // XRPC first
   app.use(customRouter)         // Custom routes after
   ```

#### ❌ DON'T

1. **Global body parsing on routers mounted before XRPC**:
   ```typescript
   router.use(express.json())  // BAD if router mounted globally
   ```

2. **Body parsing middleware at app level before XRPC**:
   ```typescript
   app.use(express.json())     // BAD - affects all routes
   app.use(server.xrpc.router)
   ```

3. **Reading request body in middleware before XRPC**:
   ```typescript
   app.use((req, res, next) => {
     const body = req.body      // BAD if body parser ran
     let data = ''
     req.on('data', chunk => {  // BAD - consumes stream
       data += chunk
     })
   })
   ```

### Debugging Body Consumption

If XRPC endpoints return "Request body is not readable" or AppView returns validation errors:

1. **Add stream checkpoints** between middleware:
   ```typescript
   app.use((req, res, next) => {
     if (req.method === 'POST') {
       console.log('Checkpoint:', {
         readable: req.readable,
         readableEnded: req.readableEnded,
         readableLength: req.readableLength,
         destroyed: req.destroyed
       })
     }
     next()
   })
   ```

2. **Check middleware order**:
   - List all `app.use()` calls before XRPC router
   - Identify any that might parse bodies

3. **Search for body parsing**:
   ```bash
   grep -r "express.json()" packages/pds/src/
   grep -r "express.text()" packages/pds/src/
   grep -r "req.on('data'" packages/pds/src/
   ```

4. **Verify router mounting**:
   - Ensure custom routers with body parsing mount AFTER XRPC
   - Or use route-specific middleware instead of router-level

### Why This Matters

The XRPC catchall/pipethrough pattern is fundamental to how Bluesky PDS works:

1. **PDS is lightweight** - doesn't implement all endpoints
2. **AppView implements** - feed algorithms, bookmarks, advanced features
3. **Pipethrough connects** - PDS forwards unknown endpoints to AppView
4. **Requires intact streams** - AppView needs original request body

Breaking this pattern means:
- Bookmark creation fails (AppView endpoint)
- Feed interactions fail (discover.bsky.app)
- Future AppView features won't work
- PDS can't act as transparent proxy

**Golden Rule**: If a router is mounted before the XRPC router, it must NOT consume request bodies globally.

## References

- XRPC Server: `packages/pds/src/server.ts`
- Input Verification: `packages/xrpc-server/src/util.ts`
- PDS Pipethrough: `packages/pds/src/pipethrough.ts`
- PDS Initialization: `packages/pds/src/index.ts`
- Generated Code: `packages/pds/src/lexicon/index.ts`
- Express Body Parsers: https://expressjs.com/en/api.html#express.json
