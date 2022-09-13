# ADX HTTP Routes
ADX exchanges data using HTTP/S. This document enumerates the routes and their expected behaviors.

## Version: 0.0.0

**License:** MIT

[Learn more about ADX](https://github.com/bluesky-social/adx/)
### /.well-known/adx-did

#### GET
##### Summary

Provides the DID of the repo indicated by the Host parameter.

### /.adx/v1/data/root

#### GET
##### Summary

Gets the current root CID of a repo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | query | The DID of the repo to request. | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### /.adx/v1/data/repo

#### GET
##### Summary

Gets the repo state as a CAR file.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | query | The DID of the repo to request. | Yes | string |
| from | query | The CID of a previous commit. | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### /.adx/v1/data/repo/{did}

#### POST
##### Summary

Writes commits to a repo.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### /.adx/v1/account

#### GET
##### Summary

Get information about the account.

#### POST
##### Summary

Create an account.

#### DELETE
##### Summary

Delete an account.

### /.adx/v1/session

#### GET
##### Summary

Get information about the current session.

#### POST
##### Summary

Create an session.

#### DELETE
##### Summary

Delete the current session.

### /.adx/v1/api/repo/{did}

#### GET
##### Summary

Get information about the repo, including the list of collections.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to request. | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

#### POST
##### Summary

Apply a batch transaction of creates, puts, and deletes.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| validate | query | Validate the record? Defaults to true. | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}

#### GET
##### Summary

Get information about the repo, including the list of collections.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to request. | Yes | string |
| namespace | path | The namespace of the collection to request. | Yes | string |
| dataset | path | The name of the collection to request. | Yes | string |
| limit | query | The number of records to return. Defaults to 50. TODO- max number? | No | number |
| before | query | A TID to filter the range of records returned. | No | string |
| after | query | A TID to filter the range of records returned. | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

#### POST
##### Summary

Create a new record.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| namespace | path | The namespace of the collection to write to. | Yes | string |
| dataset | path | The name of the collection to write to. | Yes | string |
| validate | query | Validate the record? Defaults to true. | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}

#### GET
##### Summary

Get information about the repo, including the list of collections.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to request. | Yes | string |
| namespace | path | The namespace of the collection to request. | Yes | string |
| dataset | path | The name of the collection to request. | Yes | string |
| tid | path | The TID of the record to request. | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

#### PUT
##### Summary

Write a record.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| namespace | path | The namespace of the collection to write to. | Yes | string |
| dataset | path | The name of the collection to write to. | Yes | string |
| tid | path | The TID of the record to write to. | Yes | string |
| validate | query | Validate the record? Defaults to true. | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

#### DELETE
##### Summary

Delete a record.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| did | path | The DID of the repo to modify. | Yes | string |
| namespace | path | The namespace of the collection to write to. | Yes | string |
| dataset | path | The name of the collection to write to. | Yes | string |
| tid | path | The TID of the record to write to. | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### /.adx/v1/api/view/{viewId}

#### GET
##### Summary

Fetch a view.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| viewId | path | The ID of the view to request. | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 200 | Successful operation |

### Models

#### RepoRoot

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| root | string |  | No |

#### BatchWrite

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| writes | [  ] |  | No |

#### BatchWriteCreate

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| action | string | _Enum:_ `"create"` | No |
| collection | string |  | No |
| value |  |  | No |

#### BatchWriteUpdate

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| action | string | _Enum:_ `"update"` | No |
| collection | string |  | No |
| tid | string |  | No |
| value |  |  | No |

#### BatchWriteDelete

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| action | string | _Enum:_ `"delete"` | No |
| collection | string |  | No |
| tid | string |  | No |
