# Lexicon Schema Documents

Lexicon is a schemas document format used to define [XRPC](./xrpc.md) methods and [ATP Repository](./adx/repo.md) record types. Every Lexicon schema is written in JSON and follows the interface specified below. The schemas are identified using [NSIDs](./nsid.md) which are then used to identify the methods or record types they describe.

## Interface

```typescript
interface LexiconDoc {
  lexicon: 1
  id: string // an NSID
  type: 'query' | 'procedure' | 'record'
  revision?: number
  description?: string
}

interface RecordLexiconDoc extends LexiconDoc {
  key?: string
  record: JSONSchema
}

interface XrpcLexiconDoc extends LexiconDoc {
  parameters?: Record<string, XrpcParameter>
  input?: XrpcBody
  output?: XrpcBody
  errors?: XrpcError[]
}

interface XrpcParameter {
  type: 'string' | 'number' | 'integer' | 'boolean'
  description?: string
  default?: string | number | boolean
  required?: boolean
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
}

interface XrpcBody {
  encoding: string|string[]
  schema: JSONSchema
}

interface XrpcError {
  name: string
  description?: string
}
```

## Examples

### XRPC Method

```json
{
  "lexicon": 1,
  "id": "todo.adx.createAccount",
  "type": "procedure",
  "description": "Create an account.",
  "parameters": {},
  "input": {
    "encoding": "application/json",
    "schema": {
      "type": "object",
      "required": ["email", "username", "password"],
      "properties": {
        "email": {"type": "string"},
        "username": {"type": "string"},
        "inviteCode": {"type": "string"},
        "password": {"type": "string"}
      }
    }
  },
  "output": {
    "encoding": "application/json",
    "schema": {
      "type": "object",
      "required": ["jwt", "name", "did"],
      "properties": {
        "jwt": { "type": "string" },
        "name": {"type": "string"},
        "did": {"type": "string"}
      }
    }
  },
  "errors": [
    {"name": "InvalidEmail"},
    {"name": "InvalidUsername"},
    {"name": "InvalidPassword"},
    {"name": "InvalidInviteCode"},
    {"name": "UsernameTaken"},
  ]
}
```

### ATP Record Type

```json
{
  "lexicon": 1,
  "id": "todo.social.repost",
  "type": "record",
  "key": "tid",
  "record": {
    "type": "object",
    "required": ["subject", "createdAt"],
    "properties": {
      "subject": {"type": "string"},
      "createdAt": {"type": "string", "format": "date-time"}
    }
  }
}
```