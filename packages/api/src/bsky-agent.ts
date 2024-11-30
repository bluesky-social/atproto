import { AtpAgent } from './atp-agent'

/** @deprecated use {@link AtpAgent} instead */
export class BskyAgent extends AtpAgent {
  clone(): this {
    if (this.constructor === BskyAgent) {
      const agent = new BskyAgent(this.sessionManager)
      return this.copyInto(agent as this)
    }

    // sub-classes should override this method
    throw new TypeError('Cannot clone a subclass of BskyAgent')
  }
}
