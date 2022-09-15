# Federated Remote Procedure Calls (FedRPC)

FedRPC is a general purpose server-to-server messaging protocol. It was created for the ADX protocol but is a generic communications layer which can be applied to multiple use-cases (and which does not include any ADX-specific semantics). The [repository data layer](./repo.md) and social applications operate as layers atop FedRPC.

```
┌─────────────────────┐
│ Social Applications │  Application semantics
└─┰──────────┰────────┘
  ┃          ┃
  ┃  ┌───────▽────────┐
  ┃  │  Repositories  │  Block & record storage
  ┃  └───────┰────────┘
  ┃          ┃
┌─▽──────────▽────────┐
│       FedRPC        │  Wire protocol
└─────────────────────┘
```

Features:

- **Contract-oriented**. All "methods" in FedRPC are declared by schemas which define the accepted inputs and outputs. Schemas are globally identified and published as machine-readable documents. This helps ensure correctness and consistency across an open network of services.
- **HTTP-based**. FedRPC methods are transported using HTTP/S, using GET or POST methods depending on the behavior. This makes FedRPC easy to understand and easy to integrate into existing tech stacks.
- **Cacheable**. FedRPC's "query" methods are designed to cache well with common HTTP-based caching techniques.
- **Support for multiple encodings**. FedRPC supports structured data (JSON) and unstructured binary blobs.

## TODOs

- Authentication
- Schema versioning & extensibility
- Define `getSchema`

## Specification

FedRPC supports client-to-server and server-to-server messaging over HTTP/S. Each user has a "Personal Data Server (PDS)" which acts as their agent in the network, meaning most (if not all) of their communication is routed through their PDS.

```
┌────────┐              ┌────────┐
│ Server │ ◀──FedRPC──▶ │ Server │
└────────┘              └────────┘
    ▲
    │
  FedPRC
    │
    ▼
┌────────┐
│ Client │
└────────┘
```

### Methods

FedRPC "Methods" possess the following attributes:

- **ID**: The ID of the schema for the method's inputs and outputs.
- **Type**: Query (non-effectful, cacheable) or Procedure (effectful, non-cacheable).
- **Parameters**: Encoded in the URI query segment. Affects caching.
- **Input**: The request body.
- **Output**: The response body.

Calls to a method must specify the ID, Parameters, Input, and certain HTTP Headers for the request. Likewise the return value must provide some information about the HTTP response. Therefore FedRPC does not fully abstract away the semantics of HTTP when used in APIs.

#### Method IDs

Methods are identified using [NSIDs](./nsid.md), a form of [Reverse Domain-Name Notation](https://en.wikipedia.org/wiki/Reverse_domain_name_notation).

Some example method IDs:

```
com.example.status
io.social.getFeed
net.users.bob.ping
```

#### Method schemas

Method schemas are encoded in JSON and adhere to the following interface:

```typescript
interface MethodSchema {
  fedrpc: 1
  id: string
  type: 'query' | 'procedure'
  description?: string
  parameters?: Record<string, MethodParam> // a map of param names to their definitions
  input?: MethodBody
  output?: MethodBody
}

interface MethodParam {
  type: 'string' | 'number' | 'integer' | 'boolean'
  description?: string
  default?: string | number | boolean
  required?: boolean
  minLength?: number // string only
  maxLength?: number // string only
  minimum?: number // number and integer only
  maximum?: number // number and integer only
}

interface MethodBody {
  encoding: string | string[] // must be a valid mimetype
  schema?: JSONSchema // json only
}
```

An example query-method schema:

```json
{
  "fedrpc": 1,
  "id": "io.social.getFeed",
  "type": "query",
  "description": "Fetch the user's latest feed.",
  "parameters": {
    "limit": {"type": "integer", "minimum": 1, "maximum": 50},
    "cursor": {"type": "string"},
    "reverse": {"type": "boolean", "default": true}
  },
  "output": {
    "encoding": "application/json",
    "schema": {
      "type": "object",
      "required": ["entries", "totalCount"],
      "properties": {
        "entries": {
          "type": "array",
          "items": {
            "type": "object",
            "description": "Entry items will vary and are not constrained at the method level"
          }
        },
        "totalCount": {"type": "number"}
      }
    }
  }
}
```

An example procedure-method schema:

```json
{
  "fedrpc": 1,
  "id": "io.social.setProfilePicture",
  "type": "procedure",
  "description": "Set the user's avatar.",
  "input": {
    "encoding": ["image/png", "image/jpg"],
  }
}
```

#### Schema distribution

Method schemas are designed to be machine-readable and network-accessible. While it is not current _required_ that a schema is available on the network, it is strongly advised to publish schemas so that a single canonical & authoritative representation is available to consumers of the method.

To fetch a schema, a request must be sent to the builtin [`getSchema`](#getschema) method. This request is sent to the authority of the NSID.

### Built-in methods

#### `getSchema`

TODO

### Requests

#### HTTP Method

The HTTP Method used depends on the `type` specified by the method schema.

|Type|Method|
|-|-|
|`query`|`GET`|
|`procedure`|`POST`|

#### Path

All requests are sent to the `/fedrpc/{methodId}` path on the target server. For example, a call to the `io.social.getFeed` method would be sent to `/fedrpc/io.social.getFeed` path.

The parameters (as specified in the [Method schema](#method-schemas)) are encoded as query parameters. The values should be encoded using the following algorithm in pseudo-javascript:

```js
function encodeParam (paramType, value) {
  if (paramType === 'boolean') {
    return value ? 'true' : 'false'
  } else {
    return encodeURIComponent(value)
  }
}
```

If a default value is specified in the method schema, that value should be included in requests to ensure consistent caching behaviors.

#### Headers

|Header|Usage|
|-|-|
|`Content-Type`|Must specify the encoding of the request body if present.|
|`Authentication`|May specify the authentication data if present. See [Authentication](#authentication) for more information.|

### Responses

Response types are identified by the HTTP status codes.

#### `200` Request successful

The request has succeeded. Expectations:

- `Content-Type` header must be populated.
- Response body will vary by the method interface.

#### `400` Invalid request

The request is invalid and was not processed. Expecations:

- `Content-Type` header must be `application/json`.
- Response body must match the [InvalidRequest](#invalidrequest) schema.

#### `401` Authentication required

The request cannot be processed without authentication. Expectations:

- `WWW-Authenticate` header must be populated with an authentication challenge. See [Authentication](#authentication) for more information.

#### `403` Forbidden

The user lacks the needed permissions to access the method.

#### `404` FedRPC not supported

The interpretation of a `404` response is somewhat unique for FedRPC. A `404` indicates that the server does not provide a resource at the given location (`/fedrpc`) meaning the server does not support FedRPC.

To indicate that the given procedure is not implemented, use the `501` response.

#### `413` Payload too large

The payload of the request is larger than the server is willing to process. Payload size-limits are decided by each server.

#### `429` Rate limit exceeded

The client has sent too many requests. Rate-limits are decided by each server. Expectations:

- `Retry-After` header may be populated with the amount of time that must pass before the next request.

#### `500` Internal server error

The server reached an unexpected condition during processing. Expecations:

- `Content-Type` header must be `application/json`.
- Response body must match the [InternalError](#internalerror) schema.

#### `501` Procedure not implemented

The server does not implement the requested procedure.

#### `502` A request to upstream failed

The execution of the procedure depends on a call to another server which has failed. Expecations:

- `Content-Type` header must be `application/json`.
- Response body must match the [UpstreamError](#upstreamerror) schema.

#### `503` Not enough resources

The server is under heavy load and can't complete the request.

#### `504` A request to upstream timed out

The execution of the procedure depends on a call to another server which timed out. Expecations:

- `Content-Type` header must be `application/json`.
- Response body must match the [UpstreamError](#upstreamerror) schema.

#### Remaining codes

Any response code not explicitly enumerated should be handled as follows:

- `1xx` treat as a `404`
- `2xx` treat as a `200`
- `3xx` treat as a `404` (redirects are not supported)
- `4xx` treat as a `400`
- `5xx` treat as a `500`

### Authentication

TODO

### Response schemas

The following schemas are used within the FedRPC protocol.

#### `InvalidRequest`

```typescript
interface InvalidRequest {
  error: true
  type: 'InvalidRequest'
  message: string
}
```

#### `InternalError`

```typescript
interface InternalError {
  error: true
  type: 'InternalError'
  message: string
}
```

#### `UpstreamError`

```typescript
interface UpstreamError {
  error: true
  type: 'UpstreamError'
  message: string
}
```