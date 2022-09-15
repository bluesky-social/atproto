# Schemas

TODO

## Overview

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

## Distribution

### Schema IDs

TODO

### Schema publishing

TODO

## Definition

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

### Reserved field names

There are a set of fields which are reserved in ADX and shouldn't be used by schemas.

|Field|Usage|
|-|-|
|`$type`|Declares the type of a record or view.|
|`$ext`|Contains extensions to a record or view's base schema.|
|`$required`|Used by extensions to flag whether their support is required.|
|`$fallback`|Used by extensions to give a description of the missing data.|

Generally it's wise to avoid `$` prefixes in your fieldnames.

## Usage

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

### Schema negotiation

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