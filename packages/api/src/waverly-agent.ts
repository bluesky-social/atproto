import { AtpAgent } from './agent'

export class WaverlyAgent extends AtpAgent {
  get social() {
    return this.api.social
  }
}
