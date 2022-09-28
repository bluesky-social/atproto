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

## Example cases

### Hosting service

Consider a scenario where a hosting service is using PLC and is providing the username for the user as a subdomain:

- The username: `alice.pds.com`
- The DID: `did:plc:12345`
- The hosting service: `https://pds.com`

At first, all we know is `alice.pds.com`, so we call `todo.adx.resolveName()` on `alice.pds.com`. This tells us the DID.

```typescript
await xrpc.service('https://alice.pds.com').todo.adx.resolveName() // => {did: 'did:plc:12345'}
```

Next we call the PLC resolution method on the returned DID so that we can learn the hosting service's endpoint and the user's key material.

```typescript
await didPlc.resolve('did:pcl:12345') /* => {
  id: 'did:pcl:12345',
  alsoKnownAs: `https://alice.pds.com`,
  verificationMethod: [...],
  service: [{serviceEndpoint: 'https://pds.com', ...}]
}*/
```

We can now communicate with `https://pds.com` to access Alice's data.

### Hosting service (separate domain name)

Suppose we have the same scenario as before, except the user has supplied their own domain name:

- The username: `alice.com` (this differs from before)
- The DID: `did:plc:12345`
- The hosting service: `https://pds.com`

We call `todo.adx.resolveName()` on `alice.com` to get the DID.

```typescript
await xrpc.service('https://alice.com').todo.adx.resolveName() // => {did: 'did:plc:12345'}
```

Then we resolve the DID as before:

```typescript
await didPlc.resolve('did:pcl:12345') /* => {
  id: 'did:pcl:12345',
  alsoKnownAs: `https://alice.com`,
  verificationMethod: [...],
  service: [{serviceEndpoint: 'https://pds.com', ...}]
}*/
```

We can now communicate with `https://pds.com` to access Alice's data. The `https://alice.com` endpoint only serves to handle the `todo.adx.resolveName()` call. The actual userdata lives on `pds.com`.

### Self-hosted

Let's consider a self-hosting scenario. If using did:plc, it would look something like:

- The username: `alice.com`
- The DID: `did:plc:12345`
- The hosting service: `https://alice.com`

However, **if the self-hoster is confident they will retain ownership of the domain name**, they can use did:web instead of did:plc:

- The username: `alice.com`
- The DID: `did:web:alice.com`
- The hosting service: `https://alice.com`

We call `todo.adx.resolveName()` on `alice.com` to get the DID.

```typescript
await xrpc.service('https://alice.com').todo.adx.resolveName() // => {did: 'did:web:alice.com'}
```

We then resolve using did:web:

```typescript
await didWeb.resolve('did:web:alice.com') /* => {
  id: 'did:web:alice.com',
  alsoKnownAs: `https://alice.com`,
  verificationMethod: [...],
  service: [{serviceEndpoint: 'https://alice.com', ...}]
}*/
```
