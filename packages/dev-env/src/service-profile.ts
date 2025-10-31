import { AtpAgent } from '@atproto/api'
import { TestPds } from './pds'

export type ServiceUserDetails = {
  email: string
  handle: string
  password: string
}

export type ServiceMigrationOptions = {
  services?: Record<string, unknown>
  verificationMethods?: Record<string, unknown>
}

export class ServiceProfile {
  protected constructor(
    protected pds: TestPds,
    /** @note assumes the session is already authenticated */
    protected client: AtpAgent,
    protected userDetails: ServiceUserDetails,
  ) {}

  get did() {
    return this.client.assertDid
  }

  async migrateTo(newPds: TestPds, options: ServiceMigrationOptions = {}) {
    const newClient = newPds.getClient()

    const newPdsDesc = await newClient.com.atproto.server.describeServer()
    const serviceAuth = await this.client.com.atproto.server.getServiceAuth({
      aud: newPdsDesc.data.did,
      lxm: 'com.atproto.server.createAccount',
    })

    const inviteCode = newPds.ctx.cfg.invites.required
      ? await newClient.com.atproto.server
          .createInviteCode(
            { useCount: 1 },
            {
              encoding: 'application/json',
              headers: newPds.adminAuthHeaders(),
            },
          )
          .then((res) => res.data.code)
      : undefined

    await newClient.createAccount(
      {
        ...this.userDetails,
        inviteCode,
        did: this.did,
      },
      {
        encoding: 'application/json',
        headers: { authorization: `Bearer ${serviceAuth.data.token}` },
      },
    )

    // The session manager will use the "didDoc" in the result of
    // "createAccount" in order to setup the pdsUrl. However, since are in the
    // process of migrating, that didDoc references the old PDS. In order to
    // avoid calling the old PDS, let's clear the pdsUrl, which will result in
    // the (new) serviceUrl being used.
    newClient.sessionManager.pdsUrl = undefined

    const newDidCredentialsRes =
      await newClient.com.atproto.identity.getRecommendedDidCredentials()

    await this.client.com.atproto.identity.requestPlcOperationSignature()
    const { token } = await this.pds.ctx.accountManager.db.db
      .selectFrom('email_token')
      .select('token')
      .where('did', '=', this.did)
      .where('purpose', '=', 'plc_operation')
      .executeTakeFirstOrThrow()

    const op = { ...newDidCredentialsRes.data, token }
    Object.assign((op.services ??= {}), options.services)
    Object.assign((op.verificationMethods ??= {}), options.verificationMethods)

    const signedPlcOperation =
      await this.client.com.atproto.identity.signPlcOperation(op)

    await newClient.com.atproto.identity.submitPlcOperation({
      operation: signedPlcOperation.data.operation,
    })

    await newClient.com.atproto.server.activateAccount()

    this.pds = newPds
    this.client = newClient
  }
}
