## Creating New Lexicons

Let's use an example. Say you want to create a new lexicon for blog posts. You can follow these steps to have the new lexicon built in. We will be using the namespace `post.blog.habitat.com` for this example.

1. First, write out the lexicon in the direactory corresponding to your lexicon's namespace. For this example, we'd be adding it under the path `lexicons/com/habitat/blog/post.json`. Our example lexicon looks like this:
```
{
  "lexicon": 1,
  "id": "com.habitat.blog.post",
  "defs": {
    "main": {
      "type": "record",
      "description": "Record containing a Habitat blogpost.",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["text", "createdAt"],
        "properties": {
          "text": {
            "type": "string",
            "maxLength": 3000,
            "maxGraphemes": 300,
            "description": "The primary post content. May be an empty string, if there are embeds."
          },
          "createdAt": {
            "type": "string",
            "format": "datetime",
            "description": "Client-declared timestamp when this post was originally created."
          }
        }
      }
    }
  }
}
```

2. To have this lexicon be available in the PDS, we need to generate the typescript record interface for this lexicon. To do so, run the following:
    ```
    cd packages/pds && pnpm run codegen
    ```
3. After running this, verify that the code has been generated. For our namespace, we should see a new Typescript file under the path `packages/pds/src/lexicon/types/com/habitat/blog/post.ts` that looks something like this:

```
/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Record {
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'com.habitat.blog.post#main' ||
      v.$type === 'com.habitat.blog.post')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('com.habitat.blog.post#main', v)
}
```

## Building a PDS image with custom lexicons
To build the PDS image with your newly created lexicon, run this command from the root of the repository:
```
docker build -f ./services/pds/Dockerfile .
```

To find the newly built images hash, run `docker image ls`. The image's hash should be from the first entry:
```
REPOSITORY                   TAG       IMAGE ID       CREATED          SIZE
<none>                       <none>    82bec7316f45   33 seconds ago   363MB
```

Now, you can tag the image with a repository and name that makes sense to you
```
docker tag 82bec7316f45 ethangraf/pds:latest
```

If you'd like, you can now push the image up to a Docker registry of your choice.

`docker push ethangraf/pds:latest`

## Interacting with collections using the new lexicon over the PDS's API

Now that we've created a new Lexicon, we should be able to add records to it via our PDS's API. Assuming you've already created a new repository and session with your PDS, you can create a new blog post record by creating an HTTP request for `POST http://localhost:3000/xrpc/com.atproto.repo.createRecord` with the following body:
```
{
    {
    "repo": "<your PDS repo DID>",
    "collection": "com.habitat.blog.post",
    "record": {
        "text": "First Habitat Blog Post",
        "createdAt": "1985-04-12T23:20:50.123Z"
    }
}
```
This will return a URI and content identifier for the new record we've created:
```
{
    "uri": "at://did:plc:idwl7disfzcyh3s57ihzhulj/com.habitat.blog.post/3ks6wtctmus2k",
    "cid": "bafyreigwfemjmnsxvgwf6kwkryw37cp3eqaqay754keppikwfkls3x4dw4"
}
```

Now, we should be able query this record back using `GET http://localhost:3000/xrpc/com.atproto.repo.getRecord?repo=did:plc:2v6cxs7mtkc3l4alcev2eorh&collection=app.bsky.feed.post&cid=bafyreieiv6yhl4mpt3ajpp57azop375hqnjlfpmikdp775xfsz5lf3xeyu&rkey=3ks6nphxn2s2w`

The fields that are specified in the URL query parameters are the repo DID, the record's content identifier, and the record key. The response should look like this:
```
{
    "uri": "at://did:plc:2v6cxs7mtkc3l4alcev2eorh/app.bsky.feed.post/3ks6nphxn2s2w",
    "cid": "bafyreieiv6yhl4mpt3ajpp57azop375hqnjlfpmikdp775xfsz5lf3xeyu",
    "value": {
        "text": "abc",
        "$type": "app.bsky.feed.post",
        "createdAt": "1985-04-12T23:20:50.123Z"
    }
}
```


