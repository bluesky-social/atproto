/**
 * Module declarations for CJS packages that use `export default` but don't
 * resolve correctly under Node16 module resolution. These packages set
 * `__esModule = true` and `exports.default = ...` in their CJS output, but
 * TypeScript's Node16 resolution doesn't interpret the default import correctly.
 */

declare module 'nodemailer/lib/mailer' {
  namespace Mail {
    interface Options {
      from?: string | { name?: string; address: string }
      to?: string | string[]
      subject?: string
      text?: string
      html?: string
      [key: string]: any
    }
  }
  class Mail {
    constructor(transporter: any)
  }
  export = Mail
}

declare module 'key-encoder' {
  export default class KeyEncoder {
    constructor(algorithmOrOptions: string | object)
    encodePublic(
      key: string | Buffer,
      originalEncoding: string,
      destinationEncoding: string,
    ): string
    encodePrivate(
      key: string | Buffer,
      originalEncoding: string,
      destinationEncoding: string,
    ): string
  }
}

declare module 'typed-emitter' {
  type EventMap = {
    [key: string]: (...args: any[]) => void
  }

  interface TypedEventEmitter<Events extends EventMap> {
    addListener<E extends keyof Events>(event: E, listener: Events[E]): this
    on<E extends keyof Events>(event: E, listener: Events[E]): this
    once<E extends keyof Events>(event: E, listener: Events[E]): this
    prependListener<E extends keyof Events>(event: E, listener: Events[E]): this
    prependOnceListener<E extends keyof Events>(
      event: E,
      listener: Events[E],
    ): this
    off<E extends keyof Events>(event: E, listener: Events[E]): this
    removeAllListeners<E extends keyof Events>(event?: E): this
    removeListener<E extends keyof Events>(event: E, listener: Events[E]): this
    emit<E extends keyof Events>(
      event: E,
      ...args: Parameters<Events[E]>
    ): boolean
    eventNames(): (keyof Events | string | symbol)[]
    rawListeners<E extends keyof Events>(event: E): Events[E][]
    listeners<E extends keyof Events>(event: E): Events[E][]
    listenerCount<E extends keyof Events>(event: E): number
    getMaxListeners(): number
    setMaxListeners(maxListeners: number): this
  }

  export default TypedEventEmitter
}
