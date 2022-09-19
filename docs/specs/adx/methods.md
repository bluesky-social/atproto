# ADX XRPC Methods

## `todo.adx.resolveName`

Provides the DID of the repo indicated by the Host parameter.

- Params
  - `name` Required string. The name to resolve.
- Output
  - `json` [NameResolution](#nameresolution)

## `todo.adx.sync.getRoot`

Gets the current root CID of a repo.

- Params
  - `did` Required string. The DID of the repo to request.
- Output
  - `json` [RepoRoot](#reporoot)

## `todo.adx.sync.getRepo`

Gets the repo state.

- Params
  - `did` Required string. The DID of the repo to request.
  - `from` Optional string. The CID of a previous commit.
- Output
  - `octet-stream` A CAR file.

## `todo.adx.sync.updateRepo`

Writes commits to a repo.

- Params
  - `did` Required string. The DID of the repo to modify.
- Input
  - `octet-stream` A CAR file.

## `todo.adx.accounts.getAccount`

Get information about an account.

TODO

## `todo.adx.accounts.createAccount`

Create an account.

TODO

## `todo.adx.accounts.deleteAccount`

Delete an account.

TODO

## `todo.adx.accounts.getSession`

Get information about the current session.

TODO

## `todo.adx.accounts.createSession`

Create an authentication session.

TODO

## `todo.adx.accounts.deleteSession`

Delete the current session.

TODO

## `todo.adx.repo.describe`

Get information about the repo, including the list of collections.

- Parameters
  - `did` Required string. The DID of the repo to describe.
- Output
  - `json` TODO

## `todo.adx.repo.batchWrite`

Apply a batch transaction of creates, puts, and deletes.

- Parameters
  - `did` Required string. The DID of the repo.
  - `validate` Boolean. Validate the records? Default true.
- Input
  - `json` [BatchWrite](#batchwrite)
- Output
  - `json` TODO

## `todo.adx.repo.listRecords`

List a range of records in a collection.

- Parameters
  - `did` Required string. The DID of the repo.
  - `type` Required string. The NSID of the record type.
  - `limit` Optional number. The number of records to return. Defaults to 50. TODO- max number?
  - `before` Optional string. A TID to filter the range of records returned.
  - `after` Optional string. A TID to filter the range of records returned.
- Output
  - `json` TODO

## `todo.adx.repo.createRecord`

Create a new record.

- Parameters
  - `did` Required string. The DID of the repo.
  - `type` Required string. The NSID of the record type.
  - `validate` Boolean. Validate the record? Default true.
- Input
  - `json` The record value.
- Output
  - `json` TODO

## `todo.adx.repo.getRecord`

Fetch a record.

- Parameters
  - `did` Required string. The DID of the repo.
  - `type` Required string. The NSID of the record type.
  - `tid` Required string. The TID of the record.
- Output
  - `json` TODO

## `todo.adx.repo.putRecord`

Write a record.

### Parameters

- Parameters
  - `did` Required string. The DID of the repo.
  - `type` Required string. The NSID of the record type.
  - `tid` Required string. The TID of the record.
  - `validate` Boolean. Validate the record? Default true.
- Input
  - `json` The record value.
- Output
  - `json` TODO

## `todo.adx.repo.deleteRecord`

Delete a record.

- Parameters
  - `did` Required string. The DID of the repo.
  - `type` Required string. The NSID of the record type.
  - `tid` Required string. The TID of the record.
- Output
  - `json` TODO

## Schemas

### NameResolution

```json
{
  "type": "object",
  "required": ["did"],
  "properties": {
    "did": {"type": "string"}
  }
}
```

### RepoRoot

```json
{
  "type": "object",
  "required": ["root"],
  "properties": {
    "root": {"type": "string"}
  }
}
```

### BatchWrite

```json
{
  "type": "object",
  "required": ["writes"],
  "properties": {
    "writes": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": ["action", "collection", "value"],
            "properties": {
              "action": {"type": "string", "const": "create"},
              "collection": {"type": "string"},
              "value": {}
            }
          },
          {
            "type": "object",
            "required": ["action", "collection", "tid", "value"],
            "properties": {
              "action": {"type": "string", "const": "update"},
              "collection": {"type": "string"},
              "tid": {"type": "string"},
              "value": {}
            }
          },
          {
            "type": "object",
            "required": ["action", "collection", "tid"],
            "properties": {
              "action": {"type": "string", "const": "delete"},
              "collection": {"type": "string"},
              "tid": {"type": "string"}
            }
          }
        ]
      }
    }
  }
}
```
