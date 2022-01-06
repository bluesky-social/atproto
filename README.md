# Bluesky hack

This is a proof of concept for a 'decentralized social network'.

The demo revolves around two main concepts:

**Content Addressing:** Data is stored and distributed in a content addressed manner. A user's profile & post history can be represented by a single hash.

**User-controlled Keys & Auth:** Users register a public key to their account and sign updates & authorization tokens in the form of [ucans](https://github.com/ucan-wg/ts-ucan/) 

## Running the Demo
_Note: the server currently holds the state in memory, meaning it will lose all accounts and posts when it is reset_
### Go Server

Run the go server

```sh
cd server
go run cmd/server/main.go
```

Server will be running at `http://localhost:2583`

### Node server/frontend
_Requires Node>=15, and yarn_

In another console tab, run the node server

```sh
yarn 
cd frontend
yarn dev
```

Go to `http://localhost:3005` to try the demo.

## What's going on here?
### Building blocks
- [Ucans](https://github.com/ucan-wg/ts-ucan/): Ucans are distributed user-controlled & signed authorization tokens. They are signed JWTs that indicate what a given user (or keypair) is capable of. A user registers a "root DID" that has full account access, and using that keypair, can delegate some subset of their capabilities (such as posting) to another device, user, or third-party platform.
- [CAR files](https://github.com/ipld/js-car): CAR files are "Content Addressable aRchives". They encode and serialize some set of content addressable objects and allow you to indicate a "root" of the content addressed structure. CAR files allow us to take advantage of content addressing while avoiding the performance hit of content discovery in an in-browser DHT.
- [Hash Array Mapped Trie(HAMT)](https://github.com/rvagg/js-ipld-hashmap): A data structure that functions like a hashmap, but under the hood stores values in a trie. 

### Registration
The user creates an keypair and signs an empty (no attenuation) UCAN. This servers as proof of ownership of the key.

They then send the signed ucan and their requested username to the server.

The server parses and validates the UCAN, checks to make sure the username is available, and registers the DID that issued the UCAN to the requested username.

_Note: currently keys are stored in localStorage, which is not a safe location in production_

### Posting
The user maintains a merkelized "User Store" that wraps around a HAMT (described in more detail later). When they create a new post, they add it to the HAMT, indexed by the current post count.

The user signs a UCAN with a valid `POST` permission for their username.

The user serializes their user store to a CAR file, and sends it to the server, adding the encoded UCAN to the request in the form of a Bearer token.

The server validates the UCAN, ensuring that it has valid `POST` permission, decodes the CAR file, stores it in it's datastore (currently: memory), and updates the user's data root to the root of the CAR file.

### Listing posts
Posts are all public for the time being, so no authentication is needed.

The user requests the data for a given DID.

The server serializes the user store to a CAR file and sends it to the user.

The user decodes the CAR file and displays the posts to the user.


## User Store
The user store is a content-addressed merkelized data structure that encodes some basic information about a user and their post history.

Posts are stored in a HAMT, indexed by the current post count.

An [dag-cbor](https://github.com/ipld/js-dag-cbor) encoded [IPLD](https://github.com/ipld/ipld) block contains some basic information about a user and a pointer to the current root of the HAMT.

```ts
// dag-cbor encoded user root
type User = {
  name: string
  did: string
  nextPost: number
  postsRoot: CID
  follows: string[]
}

// stored in HAMT
type Post = {
  user: string
  text: string
}
```

The CID of the IPLD-encoded "User" block serves as the root of the datastructure.

## Server API
The server uses [Ucans](https://github.com/ucan-wg/ts-ucan/) for authorization.

### `POST /register`

**Body:**
```
{ 
  name: string
}
```

**Auth:**
A Ucan no attenuation. This token is just used to prove key ownership.

---

### `POST /update`

**Body:**
Binary [CAR file](https://github.com/ipld/go-car) representing a valid user store

**Auth:**
A valid Ucan with attenuation for the following resource:
```
{
  'twitter': '${USERNAME}'
  'cap': 'POST'
}
```

### `GET /user/:id`

**Params:**
- `id`: User's DID

**Returns:**
Binary [CAR file](https://github.com/ipld/go-car) representing the user's current user store

### `Get /.well-known/did.json`

**Returns:**
The server's DID
```
{
  id: "did:key:z6Mkmi4eUvWtRAP6PNB7MnGfUFdLkGe255ftW9sGo28uv44g"
}
```

### `Get /.well-known/webfinger?resource=${username}`

**Params:**
- `resource`: The user's name

**Returns:**
A (very sparse) webfinger document. It currently only contains the user's DID.
```
{
  id: "did:key:zAbc...."
}
```


