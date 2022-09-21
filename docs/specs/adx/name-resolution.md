# Name Resolution

"User" names in ADX are mapped to domain names. A name resolves to a DID, which in turn resolves to a DID Document containing the user's signing pubkey and hosting service.

## XRPC Resolution

Name resolution uses the [`todo.adx.resolveName`](./methods.md#todoadxresolvename) xrpc method. The method call should be sent to the server identified by the username, and the name should be passed as a parameter.

Here is the algorithm in pseudo-typescript:

```typescript
async function resolveName(name: string) {
  const origin = `https://${name}`
  const res = await xrpc(origin, 'todo.adx.resolveName', {name})
  assert(typeof res?.did === 'string' && res.did.startsWith('did:'))
  return res.did
}
```

In development & testing environments, it can be helpful to run name servers which provide temporary username mappings. This can be accomplished by sending the request to the name server.

```typescript
async function resolveName(name: string, nameServer?: string) {
  const origin = nameServer || `https://${name}`
  const res = await xrpc(origin, 'todo.adx.resolveName', {name})
  assert(typeof res?.did === 'string' && res.did.startsWith('did:'))
  return res.did
}
resolveName('bob.com', 'http://localhost:1234') // resolve using my local debug nameserver
```

## Resolution

TODO: deprecate this in favor of XRPC resolution above?

Here is the algorithm in pseudo-javascript:

```js
const WELL_KNOWN_PATH = '/.well-known/adx-did'

function resolveName(name: string) {
  let origin
  if (name === 'localhost' || name.endsWith('.localhost')) {
    origin = 'http://localhost'
  } else {
    origin = `https://${name}`
  }

  const res = fetch(`${origin}${WELL_KNOWN_PATH}`, {
    headers: { Accept: 'text/plain', Host: name },
  })
  
  assert(typeof res === 'string' && res.startsWith('did:'))
  return res
}
```

An HTTPS GET request is sent to the server identified by the name. The path of the request is `/.well-known/adx-did`. The `Host` header must be populated with the target name. A `text/plain` responses is expected which contains the user's DID.

An exception to the specified behavior is for localhost and its subdomains, in which case the request is sent via HTTP.