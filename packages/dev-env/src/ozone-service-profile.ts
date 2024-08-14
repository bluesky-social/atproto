import { TestPds } from './pds'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'

export class OzoneServiceProfile {
  did?: string
  key?: Secp256k1Keypair
  thirdPartyPdsClient: AtpAgent

  modUserDetails = {
    email: 'mod-authority@test.com',
    handle: 'mod-authority.test',
    password: 'hunter2',
  }

  public constructor(public thirdPartyPds: TestPds) {
    this.thirdPartyPdsClient = this.thirdPartyPds.getClient()
  }

  async createDidAndKey() {
    await this.thirdPartyPdsClient.createAccount(this.modUserDetails)

    this.did = this.thirdPartyPdsClient.accountDid
    this.key = await Secp256k1Keypair.create({ exportable: true })
    return { did: this.did, key: this.key }
  }

  async createServiceDetails(
    pds: TestPds,
    ozoneUrl: string,
    userDetails: { inviteCode?: string } = {},
  ) {
    if (!this.did || !this.key) {
      throw new Error('No DID/key found!')
    }
    const pdsClient = pds.getClient()
    const describeRes = await pdsClient.com.atproto.server.describeServer()
    const newServerDid = describeRes.data.did

    const serviceJwtRes =
      await this.thirdPartyPdsClient.com.atproto.server.getServiceAuth({
        aud: newServerDid,
        lxm: 'com.atproto.server.createAccount',
      })
    const serviceJwt = serviceJwtRes.data.token

    await pdsClient.createAccount(
      {
        ...this.modUserDetails,
        ...userDetails,
        did: this.did,
      },
      {
        headers: { authorization: `Bearer ${serviceJwt}` },
        encoding: 'application/json',
      },
    )

    // For some reason, the tests fail if the client uses the PDS URL to make
    // its requests. This is a workaround to make the tests pass by simulating
    // old behavior (that was not relying on the session management).
    pdsClient.sessionManager.pdsUrl = undefined

    const getDidCredentials =
      await pdsClient.com.atproto.identity.getRecommendedDidCredentials()

    await this.thirdPartyPdsClient.com.atproto.identity.requestPlcOperationSignature()

    const tokenRes = await this.thirdPartyPds.ctx.accountManager.db.db
      .selectFrom('email_token')
      .selectAll()
      .where('did', '=', this.did)
      .where('purpose', '=', 'plc_operation')
      .executeTakeFirst()
    const token = tokenRes?.token
    const plcOperationData = {
      token,
      ...getDidCredentials.data,
    }

    if (!plcOperationData.services) plcOperationData.services = {}
    plcOperationData.services['atproto_labeler'] = {
      type: 'AtprotoLabeler',
      endpoint: ozoneUrl,
    }
    if (!plcOperationData.verificationMethods)
      plcOperationData.verificationMethods = {}
    plcOperationData.verificationMethods['atproto_label'] = this.key.did()

    const plcOp =
      await this.thirdPartyPdsClient.com.atproto.identity.signPlcOperation(
        plcOperationData,
      )

    await pdsClient.com.atproto.identity.submitPlcOperation({
      operation: plcOp.data.operation,
    })

    await pdsClient.com.atproto.server.activateAccount()

    await pdsClient.app.bsky.actor.profile.create(
      { repo: this.did },
      {
        displayName: 'Dev-env Moderation',
        description: `The pretend version of mod.bsky.app`,
      },
    )

    await pdsClient.app.bsky.labeler.service.create(
      { repo: this.did, rkey: 'self' },
      {
        policies: {
          labelValues: [
            '!hide',
            '!warn',
            'porn',
            'sexual',
            'nudity',
            'sexual-figurative',
            'graphic-media',
            'self-harm',
            'sensitive',
            'extremist',
            'intolerant',
            'threat',
            'rude',
            'illicit',
            'security',
            'unsafe-link',
            'impersonation',
            'misinformation',
            'scam',
            'engagement-farming',
            'spam',
            'rumor',
            'misleading',
            'inauthentic',
          ],
          labelValueDefinitions: [
            {
              identifier: 'spam',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Spam',
                  description:
                    'Unwanted, repeated, or unrelated actions that bother users.',
                },
              ],
            },
            {
              identifier: 'impersonation',
              blurs: 'none',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Impersonation',
                  description:
                    'Pretending to be someone else without permission.',
                },
              ],
            },
            {
              identifier: 'scam',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Scam',
                  description: 'Scams, phishing & fraud.',
                },
              ],
            },
            {
              identifier: 'intolerant',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Intolerance',
                  description: 'Discrimination against protected groups.',
                },
              ],
            },
            {
              identifier: 'self-harm',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Self-Harm',
                  description:
                    'Promotes self-harm, including graphic images, glorifying discussions, or triggering stories.',
                },
              ],
            },
            {
              identifier: 'security',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Security Concerns',
                  description:
                    'May be unsafe and could harm your device, steal your info, or get your account hacked.',
                },
              ],
            },
            {
              identifier: 'misleading',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misleading',
                  description:
                    'Altered images/videos, deceptive links, or false statements.',
                },
              ],
            },
            {
              identifier: 'threat',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Threats',
                  description:
                    'Promotes violence or harm towards others, including threats, incitement, or advocacy of harm.',
                },
              ],
            },
            {
              identifier: 'unsafe-link',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Unsafe link',
                  description:
                    'Links to harmful sites with malware, phishing, or violating content that risk security and privacy.',
                },
              ],
            },
            {
              identifier: 'illicit',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Illicit',
                  description:
                    'Promoting or selling potentially illicit goods, services, or activities.',
                },
              ],
            },
            {
              identifier: 'misinformation',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misinformation',
                  description:
                    'Spreading false or misleading info, including unverified claims and harmful conspiracy theories.',
                },
              ],
            },
            {
              identifier: 'rumor',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rumor',
                  description:
                    'Approach with caution, as these claims lack evidence from credible sources.',
                },
              ],
            },
            {
              identifier: 'rude',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rude',
                  description:
                    'Rude or impolite, including crude language and disrespectful comments, without constructive purpose.',
                },
              ],
            },
            {
              identifier: 'extremist',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Extremist',
                  description:
                    'Radical views advocating violence, hate, or discrimination against individuals or groups.',
                },
              ],
            },
            {
              identifier: 'sensitive',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Sensitive',
                  description:
                    'May be upsetting, covering topics like substance abuse or mental health issues, cautioning sensitive viewers.',
                },
              ],
            },
            {
              identifier: 'engagement-farming',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Engagement Farming',
                  description:
                    'Insincere content or bulk actions aimed at gaining followers, including frequent follows, posts, and likes.',
                },
              ],
            },
            {
              identifier: 'inauthentic',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Inauthentic Account',
                  description: 'Bot or a person pretending to be someone else.',
                },
              ],
            },
            {
              identifier: 'sexual-figurative',
              blurs: 'media',
              severity: 'none',
              defaultSetting: 'show',
              adultOnly: true,
              locales: [
                {
                  lang: 'en',
                  name: 'Sexually Suggestive (Cartoon)',
                  description:
                    'Art with explicit or suggestive sexual themes, including provocative imagery or partial nudity.',
                },
              ],
            },
          ],
        },
        createdAt: new Date().toISOString(),
      },
    )
  }
}
