# ADX Repository Structure

The "repository" is a collection of signed records.

It is an implementation of a [Merkle Search Tree (MST)](https://hal.inria.fr/hal-02303490/document). The MST is an ordered, insert-order-independent, deterministic tree. Keys are laid out in alphabetic order. The key insight of an MST is that each key is hashed and starting 0s are counted to determine which layer it falls on (5 zeros for ~32 fanout).

This is a merkle tree, so each subtree is referred to by it's hash (CID). When a leaf is changed, ever tree on the path to that leaf is changed as well, thereby updating the root hash.

## Encodings

All data in the repository is encoded using [CBOR](https://cbor.io/). The following value types are supported:

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

TODO:

- Are we missing value types? Binary? CID/Link?

### CBOR normalization

TODO: describe normalization algorithm

## Data layout

The data layout establishes the units of network-transmissable data. It includes the following three major groupings:

|Grouping|Description|
|-|-|
|**Repository**|Repositories are the dataset of a single "user" in the ADX network. Every user has a single repository which is identified by a [DID](https://w3c.github.io/did-core/).|
|**Collection**|A collection is an ordered list of records. Every collection is identified by an [NSID](../nsid.md). Collections only contain records of the type identified by their NSID.|
|**Record**|A record is a key/value document. It is the smallest unit of data which can be transmitted over the network. Every record has a type and is identified by a [TID](#timestamp-ids-tid).|

## Identifiers

The following identifiers are used in repositories:

|Identifier|Usage|
|-|-|
|Username|A domain name which weakly identify repositories.|
|DID|A unique global identifier which strongly identify repositories.|
|TID|A timestamp-based ID which identifies records.|
|Schema ID|An [NSID](../nsid.md) which identifies record types.|

### Usernames

Usernames are domain names which "weakly" identify repositories. They are a convenience which should be used in UIs but rarely used within records to reference data. See [Name Resolution](./name-resolution.md) for more information.

The reason that usernames are considered "weak" references is that they may change at any time. Therefore the repo DID is preferred to provide a stable identifier.

### DIDs

DIDs are unique global identifiers which "strongly" identify repositories. They are considered "strong" because they should never change during the lifecycle of a user. They should rarely be used in UIs, but should *always* be used in records to reference data.

ADX supports two DID methods:

- [Web (`did:web`)](https://w3c-ccg.github.io/did-method-web/). Should be used only when the user is "self-hosting" and therefore directly controls the domain name & server. May also be used during testing.
- [Placeholder (`did:pch`)](../did-pch.md). A method developed in conjunction with ADX to provide global secure IDs which are host-independent.

DIDs resolve to "DID Documents" which provide the address of the repo's host and the public key used to sign the repo's updates. See [DID Resolution](./did-resolution.md) for more information.

## Timestamp IDs (TID)

TODO

### Schema IDs

Schemas are identified using [NSIDs](../nsid.md), a form of [Reverse Domain-Name Notation](https://en.wikipedia.org/wiki/Reverse_domain_name_notation). In the repository, the Schema NSID has many usages:

- In the `$type` field of records to identify its schema.
- To identify collections of records of a given `$type`.
- In permissioning to identify the types of records an application make access.

Some example schema IDs:

```
com.example.profile
io.social.post
net.users.bob.comment
```

## Schemas

Schemas define the possible values of a record. Every record has a "type" which maps to a schema. Schemas are also used to distinguish collections of records, and are used to drive permissioning.

### Schema distribution

Schemas are designed to be machine-readable and network-accessible. While it is not currently _required_ that a schema is available on the network, it is strongly advised to publish schemas so that a single canonical & authoritative representation is available to consumers of the method.

To fetch a schema, a request must be sent to the xrpc [`getSchema`](../xrpc.md#getschema) method. This request is sent to the authority of the NSID.

### Schema structure

Record schemas are encoded in JSON and adhere to the following interface:

```typescript
interface RecordSchema {
  adx: 1
  id: string
  revision?: number // a versioning counter
  description?: string
  record: JSONSchema
}
```

Here is an example schema:

```json
{
  "adx": 1,
  "id": "com.example.post",
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

And here is a record using this example schema:

```json
{
  "$type": "com.example.post",
  "text": "Hello, world!",
  "createdAt": "2022-09-15T16:37:17.131Z"
}
```

### Reserved field names

There are a set of fields which are reserved in ADX and shouldn't be used by schemas.

|Field|Usage|
|-|-|
|`$type`|Declares the type of a record.|
|`$ext`|Contains extensions to a record's base schema.|
|`$required`|Used by extensions to flag whether their support is required.|
|`$fallback`|Used by extensions to give a description of the missing data.|

Generally it's wise to avoid `$` prefixes in your fieldnames.

### Schema validation

Constraints are structural: they apply constraints to fields under object path (eg `#/text`) to establish permissable values for that field. The constraints they can apply are value-type and valid values of the type (eg numbers within a range, strings of a certain format or pattern, etc). These constraints are described using [JSON Schema](https://json-schema.org/draft/2020-12/json-schema-core.html).

Unconstrained fields are ignored during validation, but should be avoided in case future versions of the schema apply constraints.

### Schema versioning

Once a field constraint is published, it can never change. Loosening a constraint (adding possible values) will cause old software to fail validation for new data, and tightening a constraint (removing possible values) will cause new software to fail validation for old data. As a consequence, schemas may only add optional constraints, and only to previously unconstrained fields.

A "revision" field is used to indicate this change, but it has no enforced meaning. It simply is used to help developers track revisions. If a schema must change a previously-published constraint, it should be published as a new schema under a new NSID.

### Schema extension

Records may introduce additional schemas using the `#/$ext` field. This is a standard field which encodes a map of schema NSIDs to "extension objects."

Extension objects use two standard fields: `$required` and `$fallback`. The `$required` field tells us if the extension *must* be understood by the software to use it properly. Meanwhile the `$fallback` field gives us a string instructing the software how to tell the user what's wrong.

Here is an example of a record with an optional extension:

```json
{
  "$type": "com.example.post",
  "text": "Hello, world!",
  "createdAt": "2022-09-15T16:37:17.131Z",
  "$ext": {
    "com.example.poll": {
      "$required": false,
      "$fallback": "This post includes a poll which your app can't render.",
      "question": "How are you today?",
      "options": ["Good", "Meh", "Bad"]
    }
  }
}
```
