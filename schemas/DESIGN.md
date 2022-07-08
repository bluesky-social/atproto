# ADX Schemas, draft 2

## Background

In [draft 1](https://gist.github.com/pfrazee/0c51dc1afceac83d984ebfd555fe6340#), we discussed the broad goals and background thinking for ADX's schemas and introduced a basic set of mechanisms. This included a number of ideas which didn't hold up to scrutiny, including the use of CBOR's tagged value types and no defined approach to schema versioning.

For draft 2, we've begun to engage much more deeply with the mechanics needed by ADX. This includes:

- The developer experience (DX) for application developers using ADX and ADX Schemas
- The need for efficient secondary indexes on user data
- Localized data descriptions in permissions screens

Consequently this draft introduces multiple changes compare to draft 1.

**As before, remember that these drafts are completely subject to change!**

---

> ### A note from Paul regarding RDF
>
> In draft 1, I made a strong effort to build an RDF-based approach to schemas. This got almost exactly the response I expected: some people loved it, some people didn't care, and some people would have preferred that I hadn't. One of the most frequent questions I got from the latter two camps was "Why bother with RDF?" and generally my response was "because it might be useful eventually." In truth, however, I spent a disproportionate amount of time making the spec work with RDF for very little practical gain.
>
> As I started draft 2, I decided not to continue maintaining the RDF-oriented design, if just to reduce the complexity of an already complex idea-space. I remain open to arguments in its favor and to the possibility that the final design can adopt RDF, but for now I need to eject that priority so that I can focus on the practical needs of ADX.

---

## Overview

### ADX at a glance

ADX is a federated network for public social broadcast. Think: Twitter, Medium, Podcasts, YouTube, and so on.

ADX syncs "repositories" of user data. These are similar to Git repos in a way; the records get committed and assembled into a hash-tree. The commits are then signed by the owning user and synced to anyone interested.

All repositories are identified by a [DID](https://w3c.github.io/did-core/). The DID resolves to a public key which signs the repo data. Users also have "usernames" which are domain names -- so I'll probably be `@pfrazee.com`!

Applications will read and write the records in the repositories. Each user has a "Personal Data Server (PDS)" that hosts their repository, and apps will be able to use the PDS as their entire backend (like Firebase).

### Data layout

Repositories are comprised of collections. Collections are an ordered list of records.

- **Repository**
    - **Feed Collection**
        - Post Record
        - Like Record
        - Post Record
        - etc
    - **Social Graph Collection**
        - Follow Record
        - Follow Record
        - etc
    - etc

Collections are identified by their Schema ID (eg `blueskyweb.xyz:Feed`) while records are identified by a key string -- which is often derived from the current time.

> Collections can contain any type of record. Their meaning is a shared convention among apps; for instance, apps will expect to find posts in the "Feed" collection and follows in the "Social Graph" collection. We *could* constrain what kinds of records are allowed in a collection to help make things more clear, but this would just make the system harder to evolve or extend.

### Merging data from multiple users

Every user's data is siloed in their repository, so to drive UIs we merge together records from multiple users. A feed or a thread UI, for instance, will merge posts from lots of different authors. We call those merges a "view" of the network, and with this document we introduce a formal mechanism for views.
 
Repos are synced between the PDSes and also crawled by indexers to create aggregated views and custom algorithms -- much like how search engines crawl the Web. The "view schemas" give us a way to talk to the PDS and indexers.

### What do ADX Schemas describe?

ADX Schemas describe the following types of things:

|Thing|Description|Effects|
|-|-|-|
|**Collections**|Ordered lists of data within an ADX repository.|Where records are stored & access control.|
|**Records**|Individual objects within collections in an ADX repository.|The smallest unit of data which can be transmitted over the network.|
|**Views**|HTTP-accessable endpoints which compute a response at call-time.|What computed/indexed information is available to a client.|

#### Collections

Collections are where records get stored. They imply a location ("where did you put the record?") which is useful for coordinating behaviors like a "feed" collection for broadcasted content. Applications request access to user data based on collections ("X would like to read and write records in your feed").

#### Records

Records are the atomic unit of data. When syncing data over the network, they are the smallest unit of information that can be synced. Applications can also request access to user data based on collections ("X would like to read and write *posts* in your feed").

#### Views

Views are HTTP endpoints which give information that requires additional indexes, often spanning records and repositories. They are used frequently by applications as they provide a wider span of information than reading records directly.

## General mechanisms

### Record encoding (CBOR)

ADX records are encoded using [CBOR](https://www.rfc-editor.org/rfc/rfc8949.html). The following value types are supported:

<table>
  <tr>
   <td><code>null</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.3"> CBOR simple value</a> (major type 7, subtype 24) with a simple value of 22 (null). 
   </td>
  </tr>
  <tr>
   <td><code>boolean</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.3"> CBOR simple value</a> (major type 7, subtype 24) with a simple value of 21 (true) or 20 (false). 
   </td>
  </tr>
  <tr>
   <td><code>integer</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR integer</a> (major type 0 or 1), choosing the shortest byte representation. 
   </td>
  </tr>
  <tr>
   <td><code>float</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR floating-point number</a> (major type 7). All floating point values <em>MUST</em> be encoded as 64-bits (additional type value 27), even for integral values.
   </td>
  </tr>
  <tr>
   <td><code>string</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR string</a> (major type 3).
   </td>
  </tr>
  <tr>
   <td><code>list</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR array</a> (major type 4), where each element of the list is added, in order, as a value of the array according to its type.
   </td>
  </tr>
  <tr>
   <td><code>map</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR map</a> (major type 5), where each entry is represented as a member of the CBOR map. The entry key is expressed as a<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR string</a> (major type 3) as the key.
   </td>
  </tr>
</table>

TODO: do we need bignums?

TODO: do we need binary?

### Field pathing

All fields in ADX records are addressed using [JSON Pointers](https://datatracker.ietf.org/doc/html/rfc6901) in the fragment section of the URL.

```javascript
const obj = {
  "foo": 10,
  "arr": [
    { "key": "value1" },
    { "key": "value2" }
  ]
}

get(obj, '#/foo') // => 10
get(obj, '#/arr') // => [Object, Object]
get(obj, '#/arr/0/key') // => "value1"
get(obj, '#/arr/1/key') // => "value2"
```


### Reserved field names

There are a set of fields which are reserved in ADX and shouldn't be used by schemas.

|Field|Usage|
|-|-|
|`$type`|Declares the type of a record or view.|
|`$ext`|Contains extensions to a record or view's base schema.|
|`$required`|Used by extensions to flag whether their support is required.|
|`$fallback`|Used by extensions to give a description of the missing data.|

Generally it's wise to avoid `$` prefixes in your fieldnames.


### Data layout

The data layout establishes the units of network-transmissable data. It includes the following three groupings:

|Grouping|Description|
|-|-|
|**Repository**|Repositories are the dataset of a single "actor" (ie user) in the ADX network. Every user has a single repository which is identified by a [DID](https://w3c.github.io/did-core/).|
|**Collection**|A collection is an ordered list of records. Every collection has a type and is identified by the Schema ID of its type. Collections may contain records of any type and cannot enforce any constraints on them.|
|**Record**|A record is a key/value document. It is the smallest unit of data which can be transmitted over the network. Every record has a type and is identified by a key which is chosen by the writing software.|

These groupings establish addressability as well as the available network queries.

#### Builtin collections

The builtin "Definitions collection," identified by `def`, is used to store schema definitions.


### "adx" URL scheme

The `adx` URL scheme is used to address records in the ADX network.

```
adx-url   = "adx://" authority path [ "?" query ] [ "#" fragment ]
authority = reg-name / did
path      = [ "/" schema-id [ "/" record-id ] ]
coll-ns   = reg-name
coll-id   = 1*pchar
record-id = 1*pchar
```

`did` is defined in [https://w3c.github.io/did-core/#did-syntax](https://w3c.github.io/did-core/#did-syntax).

`reg-name` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2).

`pchar` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.3](https://www.rfc-editor.org/rfc/rfc3986#section-3.3).

`query` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.4](https://www.rfc-editor.org/rfc/rfc3986#section-3.4).

`fragment` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5). 

`schema-id` is defined in "Schema IDs."

The fragment segment only has meaning if the URL references a record. Its value maps to a subrecord with the matching `"id"` value.

Some example `adx` URLs:


<table>
  <tr>
   <td>Repository
   </td>
   <td><code>adx://bob.com</code>
   </td>
  </tr>
  <tr>
   <td>Repository
   </td>
   <td><code>adx://did:ion:EiAnKD8-jfdd0MDcZUjAbRgaThBrMxPTFOxcnfJhI7Ukaw</code>
   </td>
  </tr>
  <tr>
   <td>Collection
   </td>
   <td><code>adx://bob.com/example.com:songs</code>
   </td>
  </tr>
  <tr>
   <td>Record
   </td>
   <td><code>adx://bob.com/example.com:songs/3yI5-c1z-cc2p-1a</code>
   </td>
  </tr>
</table>

## Schemas

### Schema IDs

Schema IDs use the following form:

```
{author-domain-name} ':' {schema-name}
```

For instance, `blueskyweb.xyz:Comment` maps to the `Comment` schema published by `blueskyweb.xyz`. Conventionally the schema name is capitalized.

### Schema publishing

Schemas must be published in ADX repositories under the special `'def'` collection and made available for download. The schema ID is expanded to the following URL form in order to download the schema:

```
'adx://' {author-domain-name} '/def/' {schema-name}
```

### Schema structure

Schemas all follow the following base form:

```typescript
interface ADXSchema {
  $type: 'adxs-collection' | 'adxs-record' | 'adxs-view'
  author: string // a domain name
  name: string // the name of the schema
  revision?: number // a versioning counter
  locale: Record<LocaleCode, ADXSchemaLocaleStrings>
}

type LocaleCode = string

interface ADXSchemaLocaleStrings {
  nameSingular: string
  namePlural: string
}
```

The form then varies according to the `$type` value.

```typescript
interface ADXCollectionSchema extends ADXSchema {
  $type: 'adxs-collection'
}

interface ADXRecordSchema extends ADXSchema {
  $type: 'adxs-record'
  schema: JSONSchema // constraints on the record value
}

interface ADXViewSchema extends ADXSchema {
  $type: 'adxs-view'
  reads?: string[] // schema IDs of collections read by the view (affects permissioning)
  parameters: JSONSchema // constraints on the query parameters sent to the view
  response: JSONSchema // constraints on the response value
}
```

### Schema validation

Constraints are structural: they apply constraints to fields under object path (eg `#/text`) to establish permissable values for that field.

The constraints they can apply are value-type and valid values of the type (eg numbers within a range, strings of a certain format or pattern, etc). These constraints are described using [JSON Schema](https://json-schema.org/draft/2020-12/json-schema-core.html).

Let's consider a hypothetical `blueskyweb.xyz:Zeet` schema:

```json
{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Zeet",
  "schema": {
    "type": "object",
    "required": ["text", "createdAt"],
    "properties": {
      "text": {"type": "string", "maxLength": 256},
      "createdAt": {"type": "string", "format": "date-time"}
    }
  }
}
```

It would apply constraints to the `#/text` and `#/createdAt` fields, with `#/$type` constrained by the standard behavior.

```javascript
// passes - all constraints satsified
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: "Hello, world!",
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT"
}) 

// fails - `#/text` constraint failed
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: true,
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT"
})
```

Unconstrained fields however are ignored.

```javascript
// passes - `#/moreText` exists outside the constraints
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: "Hello, world!",
  moreText: "Isn't this fun!",
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT",
}) 
```

Which means the "identity schema" accepts all inputs.

```javascript
identitySchema.isValid({}) // => true
identitySchema.isValid({foo: "bar"}) // => true
// etc...
```

This property is necessary for schema evolvability. It is not advised to use the unconstrained fields, however, as future versions of the schema may use them. You should instead use the "Schema extension" mechanism described below.

> **Takeaways:**
> - Schemas apply constraints to fields within objects.
>- Schemas have no effect on fields they don't constrain.
>- Applications should however not use unconstrained fields, and should use "Schema extensions" instead.

### Schema versioning

**Once a field constraint is published, it can never change.** Loosening a constraint (adding possible values) will cause old software to fail validation for new data, and tightening a constraint (removing possible values) will cause new software to fail validation for old data.

As a consequence, schemas may only add constraints to previously unconstrained fields. If our `blueskyweb.xyz:Zeet` schema wanted to add support for longer text, it would need to add a new `#/textV2` field -- and it could not mark that field as required as doing so would tighten a previously-defined constraint. Consumers of this new schema revision would need to populate both `#/text` and `#/textV2`.

A "revision" field is used to indicate this change, but it has no enforced meaning. It simply is used to help developers track the changes.

```json
{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Zeet",
  "revision": 2,
  "schema": {
    "type": "object",
    "required": ["text", "createdAt"],
    "properties": {
      "text": {"type": "string", "maxLength": 256},
      "textV2": {"type": "string", "maxLength": 10000},
      "createdAt": {"type": "string", "format": "date-time"}
    }
  }
}
```

If a schema must change a previously-published constraint, it should be published as a new schema under a new ID (eg `blueskyweb.xyz:ZeetV2`).

> **Takeaways:**
> - Once a schema is published, it can never change its field constraints.
>   - Values that were once invalid cannot become invalid.
>   - Values that were once valid cannot become invalid.
>   - Fields that were once optional cannot become required, and once-required fields cannot become optional.
> - Constraints on previously unconstrained fields can be added.
> - A "revision" field indicates changes to a schema.
> - If an existing constraint must change then a new schema must be created under a new ID.

### Schema extension

All records may introduce additional schemas using the `#/$ext` field. This is a standard field which encodes a map of schema IDs to "extension objects."

Extension objects use two standard fields: `$required` and `$fallback`. The `$required` field tells us if the extension *must* be understood by the software to use it properly. Meanwhile the `$fallback` field gives us a localized set of text instructing the software how to tell the user what's wrong.

> The schemas used by extensions are standard record schemas. There will probably be schemas designed to be used as extensions, but there's nothing enforcing that expectation.

In the following example, we'll include an extension to our zeet which adds a poll. This extension will not be required, so the record will pass validation. The record will also includes a fallback message which the application might want to display on the zeet so that users aren't confused about the "poll."

```javascript
// will be true - the foo.com:Poll extension isn't required
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: "Hello, world!",
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT",
  $ext: {
    "foo.com:Poll": {
      $required: false,
      $fallback: {
        "en-US": "This zeet includes a poll which your app can't render."
      },
      question: "How are you today?",
      options: ["Good", "Meh", "Bad"]
    }
  }
})
```

If the extension sets `$required: true`, the validation should fail. In this case, the app should NOT render the zeet, and should show the fallback message instead.

```javascript
// will be false -- this time, the extension is required
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: "Hello, world!",
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT",
  $ext: {
    "foo.com:Poll": {
      $required: true,
      $fallback: {
        "en-US": "This zeet includes a poll which your app can't render."
      },
      question: "How are you today?",
      options: ["Good", "Meh", "Bad"]
    }
  }
})
```

Now suppose our application *does* understand `foo.com:Poll`. It tells the validation library about it using a second parameter where it passes in the extension.

```javascript
// will be true -- we pass the foo.com:Poll schema into the function
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: "Hello, world!",
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT",
  $ext: {
    "foo.com:Poll": {
      $required: true,
      $fallback: {
        "en-US": "This zeet includes a poll which your app can't render."
      },
      question: "How are you today?",
      options: ["Good", "Meh", "Bad"]
    }
  }
}, {extensions: [pollSchema]})
```

Of course, the extension objects are subject to validation same as the base record.

```javascript
// will be false -- the poll is malformed
zeetSchema.isValid({
  $type: "blueskyweb.xyz:Zeet",
  text: "Hello, world!",
  createdAt: "Tue, 21 Jun 2022 21:47:38 GMT",
  $ext: {
    "foo.com:Poll": {
      $required: true,
      $fallback: {
        "en-US": "This zeet includes a poll which your app can't render."
      },
      question: "How are you today?"
      // options is missing
    }
  }
}, {extensions: [pollSchema]})
```

These examples are using a hypothetical API for validation. In practice, you'll likely want to use an API that gives more information than an `isValid()` binary. We'll explore this more in the "Application APIs" section.

> **Takeaways:**
> - Record schemas can be extended using the `$ext` field as set of objects.
> - Extension objects include the `$required` and `$fallback` fields to describe how the record should be handled if the extensions are not supported.
> - The schemas used by extension objects are standard record schemas.

## Application of schemas

**Schemas are not enforced by ADX or by the Personal Data Server's APIs.** Instead they are used by applications and indexers to help ensure they're speaking the same language. Therefore it's up to developers to enforce the schemas.

> The one exception to this is the permission screens, which are explained below.

Generally speaking, developers are advised to follow the schemas in their applications. The reason that enforcement isn't automated is to ensure that the tooling never gets in the way. Sometimes you need to ignore the schemas; sometimes you need to handle them by munging/lensing the data; sometimes you need to ignore data you don't understand. Use the schemas, but use them in the way that helps you!

### Permission screens

Write-authorization in ADX is established using [UCANs](https://fission.codes/blog/auth-without-backend/) which are issued by the user's key management software. A UCAN designates the resources for which it permits writes.

Resource descriptions are hierarchical: they designate a collection schema and optionally one or more record schemas. The descriptions embed the schema IDs of which the key manager must translate these IDs into user-friendly descriptions.

```
{APPLICATION} would like to:
    Read all of your public data
    Write {"all records"|RECORD} in your {COLLECTION}
```

All schemas include a localized set of description strings under `#/locale`. The permission screen should fetch the schemas from their host repository (see "Schema publishing") to access these descriptions. If the descriptions are not available, the permission screen should fall back to the schema IDs.

For example:

```
foo.com would like to:
    Read all of your public data
    Write Zeets in your Feed
    Write Likes in your Feed
```
```
foo.com would like to:
    Read all of your public data
    Write blueskyweb.xyz:Zeet records your blueskyweb.xyz:Feed collection
    Write blueskyweb.xyz:Like records your blueskyweb.xyz:Feed collection
```

### Application APIs

The core of an ADX API should handle the following verbs:

- `get(url)` a general record fetch
- `listCollections(repo)` list all collections in a repo
- `listRecords(repo, collection, opts)` list records in a repo's collection
- `getRecord(repo, collection, key)` get a record in a repo's collection
- `createRecord(collection, value)` create a record under a generated key
- `putRecord(collection, key, value)` write a record under the given key
- `delRecord(collection, key)` delete a record
- `getView(view, params)` fetch a view

These base APIs should not enforce any schema validation, but simply use the schema IDs for identification, eg:

```javascript
await pds.getRecord('bob.com', 'blueskyweb.xyz:SocialGraph', 'profile')
await pds.getView('blueskyweb.xyz:FeedView')
```

Validation should be applied by applications on the inputs and outputs to these functions. For example:

```javascript
const FEED = 'blueskyweb.xyz:Feed'
const zeetSchema = schemaLib.get('blueskyweb.xyz:Zeet')

// ensure correctness on read
const posts = await pds.listRecords('bob.com', FEED)
const zeets = posts.filter(p => zeetSchema.isValid(p))

// ensure correctness on write
const zeet = {
  $type: 'blueskyweb.xyz:Zeet',
  text: 'Hello, world!',
  createdAt: (new Date()).toISOString()
}
if (zeetSchema.isValid(zeet)) {
  await pds.createRecord(FEED, zeet)
}
```

Libraries and tooling should be created for each environment/language and can adopt more useful patterns such as static type signatures, builder-patterns, and code generation.

As all schemas are published on ADX, it's possible to write tools which "install" schemas from their ID, check for updates, and help publish changes (including verifying that updates to a schema do not violate previously-published constraints).

#### Schema negotiation

The process of establishing support for a record is called "Schema negotiation." This is a bi-directional dialogue between the application and the record itself. Records declare which schemas they depend upon, and applications declare which schemas they support. The validation tooling can then instruct the application on how best to handle the resulting record.

Records declare their schemas in both the `$type` field and in the `$ext` object. As described in "Schema extension," the extension objects include a `$required` field indicating whether or not the extension must be understood to properly handle the object. They can also include a `$fallback` field with a localized string for explaining a missing feature. (It's presumed that the root `$type` is always required and that there is no suitable fallback if not understood.)

A proper API for this might look something like this:

```typescript
// assume we can resolve these schema IDs to their schema definitions
const postSchema = createSchema({
  types: ['blueskyweb.xyz:Zeet', 'blueskyweb.xyz:ZeetV2'], // 2 base types supported
  extensions: ['foo.com:Poll']
})
const zeet = await adxClient.get(zeetUrl)

const res = postSchema.validate(zeet) // returns ValidationResult

if (res.support === 'full') {
  // the post valid and fully supported
}
else if (res.support === 'partial') {
  // the post is valid but 1+ optional extension is not supported
  // be sure to render `res.messages` in the UI
}
else if (res.support === 'incompatible') {
  // the post type is unknown, or a required extension is not supported
  // render `res.messages` if we need to explain the problem
}
else if (res.support === 'invalid') {
  // the post failed validation of a known type
  // render `res.messages` if we need to explain the problem
}

// where...
interface ValidationResult {
  support: 'full' | 'partial' | 'incompatible' | 'invalid'
  messages: string[] // messages to put in the UI
}
```

## Additional notes

### PDS indexing behaviors

Indexing is a key requirement for applications. A traditional relational database would struggle if developers had to "scan and filter" the entire table for each query, and ADX is no exception.

Choosing an indexing strategy for ADX has been challenging. Here's a quick summary of the approaches we've considered:

- **Have each application produce its own indexes.** We often refer to this as the "full client" approach, where the application downloads repositories directly and produce whatever secondary indexes they need. This is always an option, but it doesn't really work in the browser or mobile environment (it takes a lot of resources) and it means the application needs to sync and index the records before the user can start. Realistically speaking, this approach requires the application to run its own backend, and we'd really like it if the core social applications could use the PDS as their sole backend -- a model we call the "delegator client."
- **Allow schemas to define how they should be indexed by the PDS**. This is a wonderful-sounding idea until you realize that the resource costs of producing those indexes could easily grow out of control. Each index has a processing and storage cost, and we're not yet comfortable with the idea that a PDS should accept arbitrary index definitions.
- **Create generic indexes on every field of every record by the PDS**. If schema-defined indexes *might* be a resource problem, then this idea definitely will be. There's also a good chance this won't cover all the kinds of indexes needed; how would the user's merged home feed get produced, for example?

Right now we've decided the best option is implement indexes & views for a core set of schemas in the PDS software that Bluesky releases. As Bluesky's core mission is to enable decentralized public social broadcast, these baked-in schemas will be the vocabulary needed for social networking. This way we can be sure to produce efficient indexes for the core use-cases of ADX.

It's important to note that this approach will not preclude the use of other schemas. The PDS will still correctly accept and host data that uses other schemas, and applications will still be able to access that data. The PDS simply won't produce any optimized indexes for that data; an application will either need to live without custom indexes, or it will need to produce them itself.

It's also important to point out that the baked-in schemas will be specified the same way any other schema is. The protocol won't elevate any schemas as "core." This decision will reveal itself as a set of views declared by and implemented in the PDS server software we produce.

This certainly wasn't our first choice, so we're hopeful that somebody comes up with a better idea in the future. We're also going to be looking at ways for the baked-in views to serve a variety of use-cases that go beyond a core vocabulary. For instance, it might be possible to produce some generic views (eg "all records which link to this record"). It might also be possible that schema extensions can help satisfy a wider variety of needs (eg "posts with the foo.com:Poll extension").

### Private data

ADX is designed for public social broadcast. It uses self-authenticating data repos which are intended to be synced widely. As a consequence, private or selectively-shared data is not trivial to introduce.

After multiple discussions, the Bluesky team decided to punt on private data. Every attempt to add private data to the ADX model revealed unacceptable trade-offs. Rather than add complexity to achieve a sub-par outcome, we decided to leave the question for later.

In the short-term, this will require applications and the PDS to maintain some private state. The PDS will likely need some baked-in APIs for notifications "is read" state, for instance.

For the long-term, the prevailing theory is that a separate protocol may be needed. (Paul is partial to the idea of a mail protocol in which records are sent to a list of recipients.) This may be an entirely separate protocol or simply an additional mode for ADX.

## Open tasks and questions

### Blobs

We're fairly certain that repositories need a mechanism for "blobs" (unstructured data) which would primarily contain media. This hasn't been specced yet, however.

### Are "collections" as a separate concept from "records" necessary?

Collections could potentially be removed as a concept and have their behaviors merged into records and views. This ultimately depends on whether they're useful as a separate concept or not. (I'm not going to dig into this for now; just wanted to note the question.)

### How should validation libraries handle extensions within views?

Generally the `$ext` is expected on the root of records, but views are often wrappers around the original records which means that the `$ext` fields will be embedded within the view. We still want to support schema-negotiation in that context, so how will validation libraries handle this? Do they need to do a deep search for all `$ext` records? What if the view is a list of records -- then schema negotiation needs to occur at the per-record level.

This might not be a challenge in practice (there might be an obvious answer) I'm just not sure yet.

### Is it a good idea to use JSON-Schema to spec views' query params?

Query parameters can't encode all the things that JSON-Schema can describe. We either need to create a generic "object as query params" encoding or we need to use something other than JSON-Schema to describe view params.

### Do we need "read" permissions for applications?

All data in ADX is currently public and could be accessed by network sync. Is there any real value in describing read perms given that an app could talk to the sync protocol and get the same data?

### How do "views" get resolved to HTTP endpoints?

E.g. for a view `blueskyweb.xyz:FeedView` and a server `example.com` what is the endpoint for accessing the view?

- Is a template likd `{origin}/{view}` -> `https://example.com/blueskyweb.xyz:FeedView`?
- Do we look up the endpoint using a `.well-known` resource?
- Other?

### Non-JSON value types

In the "Record encoding (CBOR)" section we have TODOs for considering BigNums and Binary. If we decide to include those, how are they serialized to & from JSON?

### Is it possible to create a more sophisticated `$fallback`?

Aaron has observed that the `$fallback` mechanism is similar to HTML's wrapped tag fallbacks.

```html
<!-- remember this? -->
<video>
  <source src="video.mp4" type="video/mp4" />
  <!-- fallback to flash -->
  <object type="application/x-shockwave-flash" data="video.swf">
    <!-- fallback to image -->
    <img src="video.jpg">
  </object>
</video>
```

Browsers essentially ignore tags that they don't support, so this kind of HTML would fall back from `video` to `object` to `img`.

The `$fallback` behavior in this doc only provides a localized string to display, but it might be possible to fallback to an entirely different object. It's not clear yet how that would work, however.

### Do we need a syntax for specifying schema revisions?

Eg should `"revision": 2` of `blueskyweb.xyz:Zeet` be something like `blueskyweb.xyz:Zeet@2` or `blueskyweb.xyz:Zeet.2` ?

### When do JSON Schema `$ref` links get resolved?

This might need to occur when "installing" the schema to a codebase.

### Can the JSON Schema `$ref` links use our schema id shorthand or do they need to be full URLs?

It could create problems to use the shorthand.

---

# An example set of schemas

For reference, here is a set of hypothetical schemas based on the ideas in this document.

## Collections

### `blueskyweb.xyz:Feed`

Where you put posts and likes.

```json
{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "Feed",
  "locale": {
    "en-US": {
      "nameSingular": "Feed",
      "namePlural": "Feeds"
    }
  }
}
```

### `blueskyweb.xyz:SocialGraph`

Where you put follows and your profile record.

```json
{
  "$type": "adxs-collection",
  "author": "blueskyweb.xyz",
  "name": "SocialGraph",
  "locale": {
    "en-US": {
      "nameSingular": "Social Graph",
      "namePlural": "Social Graphs"
    }
  }
}
```

## Records

### `blueskyweb.xyz:Follow`

A social follow

```json
{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Follow",
  "locale": {
    "en-US": {
      "nameSingular": "Follow",
      "namePlural": "Follows"
    }
  },
  "schema": {
    "type": "object",
    "required": ["subject", "createdAt"],
    "properties": {
      "subject": {"$ref": "#/schema/$defs/link"},
      "createdAt": {"type": "string", "format": "date-time"}
    },
    "$defs": {
      "link": {
        "type": "object",
        "required": ["uri"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "username": {"type": "string"}
        }
      }
    }
  }
}
```

### `blueskyweb.xyz:Like`

A like on a zeet

```json
{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Like",
  "locale": {
    "en-US": {
      "nameSingular": "Like",
      "namePlural": "Likes"
    }
  },
  "schema": {
    "type": "object",
    "required": ["subject", "createdAt"],
    "properties": {
      "subject": {"$ref": "#/schema/$defs/link"},
      "createdAt": {"type": "string", "format": "date-time"}
    },
    "$defs": {
      "link": {
        "type": "object",
        "required": ["uri"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "username": {"type": "string"}
        }
      }
    }
  }
}
```

### `blueskyweb.xyz:Profile`

A user's public profile

```json
{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Profile",
  "locale": {
    "en-US": {
      "nameSingular": "Profile",
      "namePlural": "Profiles"
    }
  },
  "schema": {
    "type": "object",
    "required": ["displayName"],
    "properties": {
      "displayName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "description": {
        "type": "string",
        "maxLength": 256
      }
    }
  }
}
```

### `blueskyweb.xyz:Zeet`

You know what this is

```json
{
  "$type": "adxs-record",
  "author": "blueskyweb.xyz",
  "name": "Zeet",
  "locale": {
    "en-US": {
      "nameSingular": "Zeet",
      "namePlural": "Zeets"
    }
  },
  "schema": {
    "type": "object",
    "required": ["text", "createdAt"],
    "properties": {
      "text": {"type": "string", "maxLength": 256},
      "reply": {
        "type": "object",
        "required": ["root"],
        "properties": {
          "root": {"$ref": "#/schema/$defs/link"},
          "parent": {"$ref": "#/schema/$defs/link"},
        }
      },
      "media": {"type": "array", "items": {"$ref": "#/schema/$defs/embed"}},
      "createdAt": {"type": "string", "format": "date-time"}
    },
    "$defs": {
      "link": {
        "type": "object",
        "required": ["uri"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "username": {"type": "string"}
        }
      },
      "embed": {
        "type": "object",
        "required": ["blobs"],
        "properties": {
          "caption": {"type": "string"},
          "blobs": {
            "type": "object",
            "required": ["original"],
            "properties": {
              "thumb": {"$ref": "#/schema/$defs/blob"},
              "original": {"$ref": "#/schema/$defs/blob"}
            }
          }
        },
        "blob": {
          "type": "object",
          "required": ["mimeType", "blobId"],
          "properties": {
            "mimeType": {"type": "string"},
            "blobId": {"type": "string"}
          }
        }
      }
    }
  }
}
```

## Views

### `blueskyweb.xyz:FeedView`

A computed view of the home feed or a user's feed

```json
{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "FeedView",
  "locale": {
    "en-US": {
      "nameSingular": "Feed",
      "namePlural": "Feeds"
    }
  },
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph",
  ],
  "parameters": {
    "type": "object",
    "properties": {
      "author": {"type": "string"},
      "limit": {"type": "number"},
      "lt": {"type": "string"}
    }
  },
  "response": {
    "type": "object",
    "required": ["feed"],
    "properties": {
      "feed": {
        "type": "array",
        "items": {"$ref": "#/schema/$defs/feedItem"},
      },
    },
    "$defs": {
      "feedItem": {
        "type": "object",
        "required": ["uri", "author", "zeet", "replyCount", "likeCount", "indexedAt"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "author": {
            "type": "object",
            "required": ["username", "displayName"],
            "properties": {
              "username": {"type": "string"},
              "displayName": {
                "type": "string",
                "minLength": 1,
                "maxLength": 64
              }
            }
          },
          "zeet": {"$ref": "/def/Zeet#/schema"},
          "replyCount": {"type": "number"},
          "likeCount": {"type": "number"},
          "indexedAt": {"type": "string", "format": "date-time"}
        }
      }
    }
  }
}
```

### `blueskyweb.xyz:UserFollowersView`

Who is following a user?

```json
{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "UserFollowersView",
  "locale": {
    "en-US": {
      "nameSingular": "User Followers View",
      "namePlural": "User Followers Views"
    }
  },
  "reads": [
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": ["user"],
    "properties": {
      "user": {"type": "string"}
    }
  },
  "response": {
    "type": "object",
    "required": ["subject", "followers"],
    "properties": {
      "subject": {
        "type": "object",
        "required": ["uri", "username"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "username": {"type": "string"}
        }
      },
      "followers": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["uri", "username"],
          "properties": {
            "uri": {"type": "string", "format": "uri"},
            "username": {"type": "string"},
            "displayName": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64
            }
          }
        },
      },
    }
  }
}
```

### `blueskyweb.xyz:NotificationsView`

A user's notifications

```json
{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "NotificationsView",
  "locale": {
    "en-US": {
      "nameSingular": "Notifications View",
      "namePlural": "Notifications Views"
    }
  },
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "properties": {
      "limit": {"type": "number"},
      "lt": {"type": "string"},
      "gt": {"type": "string"},
      "after": {"type": "string", "format": "date-time"},
      "before": {"type": "string", "format": "date-time"}
    }
  },
  "response": {
    "type": "object",
    "required": ["notifications"],
    "properties": {
      "notifications": {
        "type": "array",
        "items": {"$ref": "#/schema/$defs/notification"},
      }
    },
    "$defs": {
      "notification": {
        "type": "object",
        "required": ["uri", "author", "item", "isRead", "indexedAt", "createdAt"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "author": {
            "type": "object",
            "required": ["username", "displayName"],
            "properties": {
              "username": {"type": "string"},
              "displayName": {
                "type": "string",
                "minLength": 1,
                "maxLength": 64
              }
            }
          },
          "item": {"type": "object"},
          "isRead": {"type": "boolean"},
          "indexedAt": {"type": "string", "format": "date-time"},
          "createdAt": {"type": "string", "format": "date-time"},
        }
      }
    }
  }
}
```

### `blueskyweb.xyz:ProfileView`

A user profile

```json
{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "Profile",
  "locale": {
    "en-US": {
      "nameSingular": "Profile View",
      "namePlural": "Profiles Views"
    }
  },
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": ["user"],
    "properties": {
      "user": {"type": "string"}
    }
  },
  "response": {
    "type": "object",
    "properties": {
      "uri": {"type": "string", "format": "uri"},
      "username": {"type": "string"},
      "displayName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 64
      },
      "description": {
        "type": "string",
        "maxLength": 256
      },
      "followerCount": {"type": "number"},
      "followsCount": {"type": "number"},
      "zeetsCount": {"type": "number"}
    }
  }
}
```

### `blueskyweb.xyz:ZeetView`

A zeet with some attached info

```json
{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "ZeetView",
  "locale": {
    "en-US": {
      "nameSingular": "Zeet View",
      "namePlural": "Zeet Views"
    }
  },
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": ["uri"],
    "properties": {
      "uri": {"type": "string"}
    }
  },
  "response": {
    "type": "object",
    "required": ["uri", "author", "zeet", "replyCount", "likeCount", "likedBy", "indexedAt"],
    "properties": {
      "uri": {"type": "string", "format": "uri"},
      "author": {
        "type": "object",
        "required": ["username", "displayName"],
        "properties": {
          "username": {"type": "string"},
          "displayName": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          }
        }
      },
      "zeet": {"$ref": "/def/Zeet#/schema"},
      "replyCount": {"type": "number"},
      "likeCount": {"type": "number"},
      "likedBy": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["uri"],
          "properties": {
            "uri": {"type": "string", "format": "uri"},
            "username": {"type": "string"},
            "displayName": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64
            }
          }
        }
      },
      "indexedAt": {"type": "string", "format": "date-time"}
    }
  }
}
```

### `blueskyweb.xyz:ZeetThreadView`

A zeet with its replies

```json
{
  "$type": "adxs-view",
  "author": "blueskyweb.xyz",
  "name": "ZeetView",
  "locale": {
    "en-US": {
      "nameSingular": "Zeet View",
      "namePlural": "Zeet Views"
    }
  },
  "reads": [
    "blueskyweb.xyz:Feed",
    "blueskyweb.xyz:SocialGraph"
  ],
  "parameters": {
    "type": "object",
    "required": ["uri"],
    "properties": {
      "uri": {"type": "string"}
    }
  },
  "response": {
    "$ref": "#/response/$defs/zeet",
    "$defs": {
      "zeet": {
        "type": "object",
        "required": ["uri", "author", "zeet", "replyCount", "replies", "likeCount", "likedBy", "indexedAt"],
        "properties": {
          "uri": {"type": "string", "format": "uri"},
          "author": {
            "type": "object",
            "required": ["username", "displayName"],
            "properties": {
              "username": {"type": "string"},
              "displayName": {
                "type": "string",
                "minLength": 1,
                "maxLength": 64
              }
            }
          },
          "zeet": {"$ref": "/def/Zeet#/schema"},
          "replyCount": {"type": "number"},
          "replies": {
            "type": "array",
            "items": {"$ref": "#/response/$defs/zeet"}
          },
          "likeCount": {"type": "number"},
          "likedBy": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["uri"],
              "properties": {
                "uri": {"type": "string", "format": "uri"},
                "username": {"type": "string"},
                "displayName": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 64
                }
              }
            }
          },
          "indexedAt": {"type": "string", "format": "date-time"}
        }
      }
    }
  }
}
```
