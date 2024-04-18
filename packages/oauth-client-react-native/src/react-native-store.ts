import { GenericStore, Value } from '@atproto-labs/caching'

// TODO: implement this using the app's safe storage
export class ReactNativeStore<V extends Value>
  implements GenericStore<string, V>
{
  constructor(
    /**
     * Allows defining, at storage time, when the value should expire. This
     * allows the store to automatically delete the values when they expire.
     */
    protected valueExpiresAt: (value: V) => null | Date,
  ) {
    throw new Error('Not implemented')
  }

  async get(key: string): Promise<V | undefined> {
    throw new Error('Not implemented')
  }

  async set(key: string, value: V): Promise<void> {
    throw new Error('Not implemented')
  }

  async del(key: string): Promise<void> {
    throw new Error('Not implemented')
  }
}
