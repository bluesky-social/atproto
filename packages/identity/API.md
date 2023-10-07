# @atproto/identity API Documentation

<!-- TSDOC_START -->

## :toolbox: Functions

- [getDid](#gear-getdid)
- [getKey](#gear-getkey)
- [getHandle](#gear-gethandle)
- [getPds](#gear-getpds)
- [getFeedGen](#gear-getfeedgen)
- [getNotif](#gear-getnotif)
- [parseToAtprotoDocument](#gear-parsetoatprotodocument)
- [ensureAtpDocument](#gear-ensureatpdocument)

### :gear: getDid

| Function | Type |
| ---------- | ---------- |
| `getDid` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => string` |

### :gear: getKey

| Function | Type |
| ---------- | ---------- |
| `getKey` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => string` |

### :gear: getHandle

| Function | Type |
| ---------- | ---------- |
| `getHandle` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => string` |

### :gear: getPds

| Function | Type |
| ---------- | ---------- |
| `getPds` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => string` |

### :gear: getFeedGen

| Function | Type |
| ---------- | ---------- |
| `getFeedGen` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => string` |

### :gear: getNotif

| Function | Type |
| ---------- | ---------- |
| `getNotif` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => string` |

### :gear: parseToAtprotoDocument

| Function | Type |
| ---------- | ---------- |
| `parseToAtprotoDocument` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => Partial<...>` |

### :gear: ensureAtpDocument

| Function | Type |
| ---------- | ---------- |
| `ensureAtpDocument` | `(doc: { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }) => AtprotoData` |


## :wrench: Constants

- [verificationMethod](#gear-verificationmethod)
- [service](#gear-service)
- [didDocument](#gear-diddocument)

### :gear: verificationMethod

| Constant | Type |
| ---------- | ---------- |
| `verificationMethod` | `ZodObject<{ id: ZodString; type: ZodString; controller: ZodString; publicKeyMultibase: ZodOptional<ZodString>; }, "strip", ZodTypeAny, { ...; }, { ...; }>` |

### :gear: service

| Constant | Type |
| ---------- | ---------- |
| `service` | `ZodObject<{ id: ZodString; type: ZodString; serviceEndpoint: ZodUnion<[ZodString, ZodRecord<ZodString, ZodUnknown>]>; }, "strip", ZodTypeAny, { ...; }, { ...; }>` |

### :gear: didDocument

| Constant | Type |
| ---------- | ---------- |
| `didDocument` | `ZodObject<{ id: ZodString; alsoKnownAs: ZodOptional<ZodArray<ZodString, "many">>; verificationMethod: ZodOptional<ZodArray<ZodObject<{ id: ZodString; type: ZodString; controller: ZodString; publicKeyMultibase: ZodOptional<...>; }, "strip", ZodTypeAny, { ...; }, { ...; }>, "many">>; service: ZodOptional<...>; }, "str...` |


## :factory: DidNotFoundError

## :factory: PoorlyFormattedDidError

## :factory: UnsupportedDidMethodError

## :factory: PoorlyFormattedDidDocumentError

## :factory: UnsupportedDidWebPathError

## :factory: HandleResolver

Resolves a handle (domain name) to a DID.

Calling code must validate handle/DID pariing against the DID document itself.

### Methods

- [parseDnsResult](#gear-parsednsresult)

#### :gear: parseDnsResult

| Method | Type |
| ---------- | ---------- |
| `parseDnsResult` | `(chunkedResults: string[][]) => string` |


## :factory: BaseResolver

### Methods

- [validateDidDoc](#gear-validatediddoc)

#### :gear: validateDidDoc

Throws if argument is not a valid DidDocument.

Only checks type structure, does not parse internal fields.

| Method | Type |
| ---------- | ---------- |
| `validateDidDoc` | `(did: string, val: unknown) => { id?: string; alsoKnownAs?: string[]; verificationMethod?: { id?: string; type?: string; controller?: string; publicKeyMultibase?: string; }[]; service?: { id?: string; type?: string; serviceEndpoint?: string or Record<...>; }[]; }` |

Parameters:

* `did`: - DID to verify against field in the document itself
* `val`: - object to verify structure as a DidDocument



## :factory: DidWebResolver

Resolves did:web DIDs.

Supports only top-level (domain) DIDs, not paths (with additional ":" segments in the DID). UnsupportedDidWebPathError will be thrown if path segments are detected.

## :factory: DidPlcResolver

## :factory: DidResolver

## :factory: IdResolver

Wrapper of a DID resolver and handle resolver.

Calling code is responsible for cross-validate handle/DID pairing.

## :factory: MemoryCache

Tiered in-memory cache.

Entries older than maxTTL are considered invalid and not returned. Entries older than staleTTL are returned, marked as stale.

<!-- TSDOC_END -->
