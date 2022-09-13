# ADX HTTP Routes

**Version: 0.0.0**

ADX exchanges data using HTTP/S. This document enumerates the routes and their expected behaviors.

[Learn more about ADX](https://github.com/bluesky-social/adx/)

## /.well-known/adx-did

### GET
Provides the DID of the repo indicated by the Host parameter.

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation | text/plain: string |

## /.adx/v1/data/root

### GET
Gets the current root CID of a repo.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | query | The DID of the repo to request. | Yes | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation | application/json: object |

## /.adx/v1/data/repo

### GET
Gets the repo state as a CAR file.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | query | The DID of the repo to request. | Yes | string |
| from | query | The CID of a previous commit. | No | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation | application/octet-stream: binary |

## /.adx/v1/data/repo/{did}

### POST
Writes commits to a repo.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

## /.adx/v1/account

### GET
Get information about the account.

### POST
Create an account.

### DELETE
Delete an account.

## /.adx/v1/session

### GET
Get information about the current session.

### POST
Create an session.

### DELETE
Delete the current session.

## /.adx/v1/api/repo/{did}

### GET
Get information about the repo, including the list of collections.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to request. | Yes | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### POST
Apply a batch transaction of creates, puts, and deletes.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| validate | query | Validate the record? Defaults to true. | No | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

## /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}

### GET
Get information about the repo, including the list of collections.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to request. | Yes | string |
| namespace | path | The namespace of the collection to request. | Yes | string |
| dataset | path | The name of the collection to request. | Yes | string |
| limit | query | The number of records to return. Defaults to 50. TODO- max number? | No | number |
| before | query | A TID to filter the range of records returned. | No | string |
| after | query | A TID to filter the range of records returned. | No | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### POST
Create a new record.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| namespace | path | The namespace of the collection to write to. | Yes | string |
| dataset | path | The name of the collection to write to. | Yes | string |
| validate | query | Validate the record? Defaults to true. | No | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

## /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}

### GET
Get information about the repo, including the list of collections.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to request. | Yes | string |
| namespace | path | The namespace of the collection to request. | Yes | string |
| dataset | path | The name of the collection to request. | Yes | string |
| tid | path | The TID of the record to request. | Yes | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### PUT
Write a record.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| namespace | path | The namespace of the collection to write to. | Yes | string |
| dataset | path | The name of the collection to write to. | Yes | string |
| tid | path | The TID of the record to write to. | Yes | string |
| validate | query | Validate the record? Defaults to true. | No | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### DELETE
Delete a record.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| namespace | path | The namespace of the collection to write to. | Yes | string |
| dataset | path | The name of the collection to write to. | Yes | string |
| tid | path | The TID of the record to write to. | Yes | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

## /.adx/v1/api/view/{viewId}

### GET
Fetch a view.

#### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| viewId | path | The ID of the view to request. | Yes | string |

#### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### Models

#### RepoRoot

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| root | string |  | Yes |

#### BatchWrite

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| writes | [  ] |  | Yes |

#### BatchWriteCreate

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| action | string | _Enum:_ `"create"` | Yes |
| collection | string |  | Yes |
| value |  |  | Yes |

#### BatchWriteUpdate

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| action | string | _Enum:_ `"update"` | Yes |
| collection | string |  | Yes |
| tid | string |  | Yes |
| value |  |  | Yes |

#### BatchWriteDelete

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| action | string | _Enum:_ `"delete"` | Yes |
| collection | string |  | Yes |
| tid | string |  | Yes |
