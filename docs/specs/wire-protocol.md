# ADX Wire Protocol v0.0.0

TODO: this document is deprecated by the FedRPC-based system

ADX exchanges data using HTTP/S. This document enumerates the routes and their expected behaviors.

## `GET /.well-known/adx-did`

Provides the DID of the repo indicated by the Host parameter.

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|text/plain|Successful operation|-|

## `GET /.adx/v1/data/root`

Gets the current root CID of a repo.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|query|The DID of the repo to request.|Yes|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|application/json|Successful operation|[RepoRoot](#reporoot)|

## `GET /.adx/v1/data/repo`

Gets the repo state as a CAR file.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|query|The DID of the repo to request.|Yes|
|**from**|query|The CID of a previous commit.|No|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|application/octet-stream|Successful operation|-|

## `POST /.adx/v1/data/repo/{did}`

Writes commits to a repo.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to modify.|Yes|

### Request body

|MimeType|Description|Schema|
|-|-|-|
|application/octet-stream|A CAR file.|-|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `GET /.adx/v1/account`

Get information about the account.

## `POST /.adx/v1/account`

Create an account.

## `DELETE /.adx/v1/account`

Delete an account.

## `GET /.adx/v1/session`

Get information about the current session.

## `POST /.adx/v1/session`

Create an session.

## `DELETE /.adx/v1/session`

Delete the current session.

## `GET /.adx/v1/api/repo/{did}`

Get information about the repo, including the list of collections.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to request.|Yes|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `POST /.adx/v1/api/repo/{did}`

Apply a batch transaction of creates, puts, and deletes.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to modify.|Yes|
|**validate**|query|Validate the record? Defaults to true.|No|

### Request body

|MimeType|Description|Schema|
|-|-|-|
|application/json|The modifications to apply.|[BatchWrite](#batchwrite)|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `GET /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}`

Get information about the repo, including the list of collections.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to request.|Yes|
|**namespace**|path|The namespace of the collection to request.|Yes|
|**dataset**|path|The name of the collection to request.|Yes|
|**limit**|query|The number of records to return. Defaults to 50. TODO- max number?|No|
|**before**|query|A TID to filter the range of records returned.|No|
|**after**|query|A TID to filter the range of records returned.|No|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `POST /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}`

Create a new record.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to modify.|Yes|
|**namespace**|path|The namespace of the collection to write to.|Yes|
|**dataset**|path|The name of the collection to write to.|Yes|
|**validate**|query|Validate the record? Defaults to true.|No|

### Request body

|MimeType|Description|Schema|
|-|-|-|
|application/json|The record to create.|-|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `GET /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}`

Get information about the repo, including the list of collections.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to request.|Yes|
|**namespace**|path|The namespace of the collection to request.|Yes|
|**dataset**|path|The name of the collection to request.|Yes|
|**tid**|path|The TID of the record to request.|Yes|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `PUT /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}`

Write a record.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to modify.|Yes|
|**namespace**|path|The namespace of the collection to write to.|Yes|
|**dataset**|path|The name of the collection to write to.|Yes|
|**tid**|path|The TID of the record to write to.|Yes|
|**validate**|query|Validate the record? Defaults to true.|No|

### Request body

|MimeType|Description|Schema|
|-|-|-|
|application/json|The record to write.|-|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `DELETE /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}`

Delete a record.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**did**|path|The DID of the repo to modify.|Yes|
|**namespace**|path|The namespace of the collection to write to.|Yes|
|**dataset**|path|The name of the collection to write to.|Yes|
|**tid**|path|The TID of the record to write to.|Yes|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## `GET /.adx/v1/api/view/{viewId}`

Fetch a view.

### Parameters

|Name|In|Description|Required|
|-|-|-|-|
|**viewId**|path|The ID of the view to request.|Yes|

### Responses

|Code|MimeType|Description|Schema|
|-|-|-|-|
|**200**|-|Successful operation|-|

## Schemas

### RepoRoot

```json
{
  "type": "object",
  "required": [
    "root"
  ],
  "properties": {
    "root": {
      "type": "string"
    }
  }
}
```

### BatchWrite

```json
{
  "type": "object",
  "required": [
    "writes"
  ],
  "properties": {
    "writes": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "required": [
              "action",
              "collection",
              "value"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "create"
                ]
              },
              "collection": {
                "type": "string"
              },
              "value": {}
            }
          },
          {
            "type": "object",
            "required": [
              "action",
              "collection",
              "tid",
              "value"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "update"
                ]
              },
              "collection": {
                "type": "string"
              },
              "tid": {
                "type": "string"
              },
              "value": {}
            }
          },
          {
            "type": "object",
            "required": [
              "action",
              "collection",
              "tid"
            ],
            "properties": {
              "action": {
                "type": "string",
                "enum": [
                  "delete"
                ]
              },
              "collection": {
                "type": "string"
              },
              "tid": {
                "type": "string"
              }
            }
          }
        ]
      }
    }
  }
}
```
