# @adx/did-sdk

## API

### `resolve(uri: string): Promise<ReadOnlyDidDocAPI>`

TODO

### `create(method: 'ion' | 'key', opts: any): Promise<DidDocAPI>`

TODO

### `inst(method: 'ion' | 'key', state: any): Promise<DidDocAPI>`

TODO

### `createDidWebServer(port = 9999): Promise<DidWebServer>`

TODO

### `DidDocAPI.getURI(): string`

TODO

### `DidDocAPI.listPublicKeys(purpose?: DidKeyPurpose): TODO`

TODO

### `DidDocAPI.getPublicKey(purpose: DidKeyPurpose, offset = 0): TODO`

TODO

### `DidDocAPI.getKeyPair(id: string): TODO`

TODO

### `DidDocAPI.listServices(): TODO`

TODO

### `DidDocAPI.getService(type: string): TODO`

TODO

### `DidWebServer.put(doc: DidDoc): void`

TODO

### `DidWebServer.delete(doc: string|DidDoc): void`

TODO

### `DidWebServer.close(): Promise<void>`

TODO