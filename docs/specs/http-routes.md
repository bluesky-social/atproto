
<h1 id="adx-http-routes">ADX HTTP Routes v0.0.0</h1>

ADX exchanges data using HTTP/S. This document enumerates the routes and their expected behaviors.

Base URLs:

* <a href="http://localhost:2583">http://localhost:2583</a>

 License: MIT

<h1 id="adx-http-routes-protocol">protocol</h1>

Server-to-server protocol operations.

## resolveName

<a id="opIdresolveName"></a>

`GET /.well-known/adx-did`

*Provides the DID of the repo indicated by the Host parameter.*

<h3 id="resolvename-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|string|

<aside class="success">
This operation does not require authentication
</aside>

## getRepoRoot

<a id="opIdgetRepoRoot"></a>

`GET /.adx/v1/data/root`

*Gets the current root CID of a repo.*

<h3 id="getreporoot-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|query|string|true|The DID of the repo to request.|

<h3 id="getreporoot-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|[RepoRoot](#schemareporoot)|

<aside class="success">
This operation does not require authentication
</aside>

## getRepoState

<a id="opIdgetRepoState"></a>

`GET /.adx/v1/data/repo`

*Gets the repo state as a CAR file.*

<h3 id="getrepostate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|query|string|true|The DID of the repo to request.|
|from|query|string|false|The CID of a previous commit.|

<h3 id="getrepostate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|string|

<aside class="success">
This operation does not require authentication
</aside>

## writeRepoState

<a id="opIdwriteRepoState"></a>

`POST /.adx/v1/data/repo/{did}`

*Writes commits to a repo.*

> Body parameter

```yaml
type: string
format: binary

```

<h3 id="writerepostate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to modify.|
|body|body|string(binary)|true|A CAR file.|

<h3 id="writerepostate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="adx-http-routes-account">account</h1>

Account management API.

## getAccount

<a id="opIdgetAccount"></a>

`GET /.adx/v1/account`

*Get information about the account.*

<h3 id="getaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="success">
This operation does not require authentication
</aside>

## updateAccount

<a id="opIdupdateAccount"></a>

`POST /.adx/v1/account`

*Create an account.*

<h3 id="updateaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="success">
This operation does not require authentication
</aside>

## deleteAccount

<a id="opIddeleteAccount"></a>

`DELETE /.adx/v1/account`

*Delete an account.*

<h3 id="deleteaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="adx-http-routes-session">session</h1>

Session management API.

## getSession

<a id="opIdgetSession"></a>

`GET /.adx/v1/session`

*Get information about the current session.*

<h3 id="getsession-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="success">
This operation does not require authentication
</aside>

## createSession

<a id="opIdcreateSession"></a>

`POST /.adx/v1/session`

*Create an session.*

<h3 id="createsession-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="success">
This operation does not require authentication
</aside>

## deleteSession

<a id="opIddeleteSession"></a>

`DELETE /.adx/v1/session`

*Delete the current session.*

<h3 id="deletesession-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="adx-http-routes-repo">repo</h1>

Repository API.

## describeRepo

<a id="opIddescribeRepo"></a>

`GET /.adx/v1/api/repo/{did}`

*Get information about the repo, including the list of collections.*

<h3 id="describerepo-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to request.|

<h3 id="describerepo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

## batchWriteRepo

<a id="opIdbatchWriteRepo"></a>

`POST /.adx/v1/api/repo/{did}`

*Apply a batch transaction of creates, puts, and deletes.*

> Body parameter

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

<h3 id="batchwriterepo-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to modify.|
|validate|query|string|false|Validate the record? Defaults to true.|
|body|body|[BatchWrite](#schemabatchwrite)|true|The modifications to apply.|

#### Enumerated Values

|Parameter|Value|
|---|---|
|validate|t|
|validate|true|
|validate|f|
|validate|false|

<h3 id="batchwriterepo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

## listRecords

<a id="opIdlistRecords"></a>

`GET /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}`

*Get information about the repo, including the list of collections.*

<h3 id="listrecords-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to request.|
|namespace|path|string|true|The namespace of the collection to request.|
|dataset|path|string|true|The name of the collection to request.|
|limit|query|number|false|The number of records to return. Defaults to 50. TODO- max number?|
|before|query|string|false|A TID to filter the range of records returned.|
|after|query|string|false|A TID to filter the range of records returned.|

<h3 id="listrecords-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

## createRecord

<a id="opIdcreateRecord"></a>

`POST /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}`

*Create a new record.*

> Body parameter

```json
{}
```

<h3 id="createrecord-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to modify.|
|namespace|path|string|true|The namespace of the collection to write to.|
|dataset|path|string|true|The name of the collection to write to.|
|validate|query|string|false|Validate the record? Defaults to true.|
|body|body|any|true|The record to create.|

#### Enumerated Values

|Parameter|Value|
|---|---|
|validate|t|
|validate|true|
|validate|f|
|validate|false|

<h3 id="createrecord-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

## getRecord

<a id="opIdgetRecord"></a>

`GET /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}`

*Get information about the repo, including the list of collections.*

<h3 id="getrecord-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to request.|
|namespace|path|string|true|The namespace of the collection to request.|
|dataset|path|string|true|The name of the collection to request.|
|tid|path|string|true|The TID of the record to request.|

<h3 id="getrecord-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

## putRecord

<a id="opIdputRecord"></a>

`PUT /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}`

*Write a record.*

> Body parameter

```json
{}
```

<h3 id="putrecord-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to modify.|
|namespace|path|string|true|The namespace of the collection to write to.|
|dataset|path|string|true|The name of the collection to write to.|
|tid|path|string|true|The TID of the record to write to.|
|validate|query|string|false|Validate the record? Defaults to true.|
|body|body|any|true|The record to write.|

#### Enumerated Values

|Parameter|Value|
|---|---|
|validate|t|
|validate|true|
|validate|f|
|validate|false|

<h3 id="putrecord-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

## deleteRecord

<a id="opIddeleteRecord"></a>

`DELETE /.adx/v1/api/repo/{did}/c/{namespace}/{dataset}/r/{tid}`

*Delete a record.*

<h3 id="deleterecord-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|did|path|string|true|The DID of the repo to modify.|
|namespace|path|string|true|The namespace of the collection to write to.|
|dataset|path|string|true|The name of the collection to write to.|
|tid|path|string|true|The TID of the record to write to.|

<h3 id="deleterecord-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="adx-http-routes-view">view</h1>

View API.

## getView

<a id="opIdgetView"></a>

`GET /.adx/v1/api/view/{viewId}`

*Fetch a view.*

<h3 id="getview-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|viewId|path|string|true|The ID of the view to request.|

<h3 id="getview-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Successful operation|None|

<aside class="success">
This operation does not require authentication
</aside>

# Schemas

<h2 id="tocS_RepoRoot">RepoRoot</h2>

<a id="schemareporoot"></a>
<a id="schema_RepoRoot"></a>
<a id="tocSreporoot"></a>
<a id="tocsreporoot"></a>

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

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|root|string|true|none|none|

<h2 id="tocS_BatchWrite">BatchWrite</h2>

<a id="schemabatchwrite"></a>
<a id="schema_BatchWrite"></a>
<a id="tocSbatchwrite"></a>
<a id="tocsbatchwrite"></a>

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

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|writes|[oneOf]|true|none|none|

oneOf

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[BatchWriteCreate](#schemabatchwritecreate)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[BatchWriteUpdate](#schemabatchwriteupdate)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[BatchWriteDelete](#schemabatchwritedelete)|false|none|none|

<h2 id="tocS_BatchWriteCreate">BatchWriteCreate</h2>

<a id="schemabatchwritecreate"></a>
<a id="schema_BatchWriteCreate"></a>
<a id="tocSbatchwritecreate"></a>
<a id="tocsbatchwritecreate"></a>

```json
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
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|action|string|true|none|none|
|collection|string|true|none|none|
|value|any|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|action|create|

<h2 id="tocS_BatchWriteUpdate">BatchWriteUpdate</h2>

<a id="schemabatchwriteupdate"></a>
<a id="schema_BatchWriteUpdate"></a>
<a id="tocSbatchwriteupdate"></a>
<a id="tocsbatchwriteupdate"></a>

```json
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
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|action|string|true|none|none|
|collection|string|true|none|none|
|tid|string|true|none|none|
|value|any|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|action|update|

<h2 id="tocS_BatchWriteDelete">BatchWriteDelete</h2>

<a id="schemabatchwritedelete"></a>
<a id="schema_BatchWriteDelete"></a>
<a id="tocSbatchwritedelete"></a>
<a id="tocsbatchwritedelete"></a>

```json
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

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|action|string|true|none|none|
|collection|string|true|none|none|
|tid|string|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|action|delete|

