# Name Resolution

"User" names in ADX are mapped to domain names. A name resolves to a DID, which in turn resolves to a DID Document containing the user's signing pubkey and hosting service.

## Resolution

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