import { Client, type DidString, type HandleString } from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'
import { com } from './lexicons/index.js'
import type { TestPds } from './pds.js'

export type ServiceUserDetails = {
  email: string
  handle: HandleString
  password: string
}

export type ServiceMigrationOptions = {
  services?: Record<string, unknown>
  verificationMethods?: Record<string, unknown>
}

export class ServiceProfile {
  protected client: Client

  protected constructor(
    protected pds: TestPds,
    /** @note assumes the session is already authenticated */
    protected session: PasswordSession,
    protected userDetails: ServiceUserDetails,
  ) {
    this.client = new Client(session)
  }

  get did(): DidString {
    return this.session.did
  }

  async migrateTo(newPds: TestPds, options: ServiceMigrationOptions = {}) {
    const newPdsClient = newPds.getClient()

    const newPdsDesc = await newPdsClient.call(
      com.atproto.server.describeServer,
    )
    const serviceAuth = await this.client.call(
      com.atproto.server.getServiceAuth,
      {
        aud: newPdsDesc.did,
        lxm: com.atproto.server.createAccount.$lxm,
      },
    )

    const inviteCode = newPds.ctx.cfg.invites.required
      ? await newPdsClient
          .call(
            com.atproto.server.createInviteCode,
            { useCount: 1 },
            { headers: newPds.adminAuthHeaders() },
          )
          .then((res) => res.code)
      : undefined

    const { body: sessionData } = await newPdsClient.xrpc(
      com.atproto.server.createAccount,
      {
        body: {
          ...this.userDetails,
          inviteCode,
          did: this.did,
        },
        headers: { authorization: `Bearer ${serviceAuth.token}` },
      },
    )

    // The "didDoc" returned by "createAccount" still references the old PDS,
    // since we are in the process of migrating. Dropping it makes the session
    // address the (new) service URL instead of calling the old PDS.
    const newSession = new PasswordSession({
      ...sessionData,
      didDoc: undefined,
      service: newPds.url,
    })
    const newClient = new Client(newSession)

    const newDidCredentials = await newClient.call(
      com.atproto.identity.getRecommendedDidCredentials,
    )

    await this.client.call(com.atproto.identity.requestPlcOperationSignature)
    const { token } = await this.pds.ctx.accountManager.db.db
      .selectFrom('email_token')
      .select('token')
      .where('did', '=', this.did)
      .where('purpose', '=', 'plc_operation')
      .executeTakeFirstOrThrow()

    const op = { ...newDidCredentials, token }
    Object.assign((op.services ??= {}), options.services)
    Object.assign((op.verificationMethods ??= {}), options.verificationMethods)

    const { operation } = await this.client.call(
      com.atproto.identity.signPlcOperation,
      op,
    )

    await newClient.call(com.atproto.identity.submitPlcOperation, { operation })

    await newClient.call(com.atproto.server.activateAccount)

    this.pds = newPds
    this.session = newSession
    this.client = newClient
  }
}
