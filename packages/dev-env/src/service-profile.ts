import { AtpAgent } from '@atproto/api'
import { DidString, isDidString } from '@atproto/lex'
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
    protected agent: AtpAgent,
    protected userDetails: ServiceUserDetails,
  ) {}

  get did(): DidString {
    const { assertDid } = this.agent
    if (!isDidString(assertDid)) {
      throw new Error('Agent is not authenticated')
    }
    return assertDid
  }

  async migrateTo(newPds: TestPds, options: ServiceMigrationOptions = {}) {
    const newAgent = newPds.getAgent()

    const newPdsDesc = await newAgent.com.atproto.server.describeServer()
    const serviceAuth = await this.agent.com.atproto.server.getServiceAuth({
      aud: newPdsDesc.data.did,
      lxm: 'com.atproto.server.createAccount',
    })

    const inviteCode = newPds.ctx.cfg.invites.required
      ? await newAgent.com.atproto.server
          .createInviteCode(
            { useCount: 1 },
            {
              encoding: 'application/json',
              headers: newPds.adminAuthHeaders(),
            },
          )
          .then((res) => res.data.code)
      : undefined

    await newAgent.createAccount(
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
    newAgent.sessionManager.pdsUrl = undefined

    const newDidCredentialsRes =
      await newAgent.com.atproto.identity.getRecommendedDidCredentials()

    await this.agent.com.atproto.identity.requestPlcOperationSignature()
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
      await this.agent.com.atproto.identity.signPlcOperation(op)

    await newAgent.com.atproto.identity.submitPlcOperation({
      operation: signedPlcOperation.data.operation,
    })

    await newAgent.com.atproto.server.activateAccount()

    this.pds = newPds
    this.agent = newAgent
  }
}
