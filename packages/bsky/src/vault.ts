import { BsyncClient } from './bsync'
import { Method } from './proto/bsync_pb'

export const createVaultClient = (bsyncClient: BsyncClient): VaultClient => {
  return new VaultClient(bsyncClient)
}

export class VaultClient {
  constructor(private readonly bsyncClient: BsyncClient) {}

  create(input: CreateInput) {
    return this.putOperation(Method.CREATE, input)
  }

  update(input: UpdateInput) {
    return this.putOperation(Method.UPDATE, input)
  }

  delete(input: DeleteInput) {
    return this.putOperation(Method.DELETE, { ...input, payload: undefined })
  }

  private async putOperation(method: Method, input: PutOperationInput) {
    const { actorDid, namespace, key, payload } = input
    await this.bsyncClient.putOperation({
      actorDid,
      namespace,
      key,
      method,
      payload: payload ? Buffer.from(JSON.stringify(payload)) : undefined,
    })
  }
}

type PutOperationInput = {
  actorDid: string
  namespace: string
  key: string
  payload: Record<string, unknown> | undefined
}

type CreateInput = {
  actorDid: string
  namespace: string
  key: string
  payload: Record<string, unknown>
}

type UpdateInput = CreateInput

type DeleteInput = {
  actorDid: string
  namespace: string
  key: string
}
