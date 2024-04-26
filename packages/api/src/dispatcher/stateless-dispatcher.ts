import { AtpDispatcher } from './atp-dispatcher'

export type StatelessDispatcherOptions = {
  service: string | URL
  headers?: { [_ in string]?: null | string }
}

export class StatelessDispatcher extends AtpDispatcher {
  getServiceUrl: () => URL | PromiseLike<URL>

  constructor({ service, headers }: StatelessDispatcherOptions) {
    super({ service, headers })
    this.getServiceUrl = () => new URL(service)
  }

  async getDid(): Promise<string> {
    throw new Error('Not logged in')
  }
}
