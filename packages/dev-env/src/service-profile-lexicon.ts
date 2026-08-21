import type { LexiconDoc } from '@atproto/lexicon'
import type { TestPds } from './pds.js'
import { ServiceProfile } from './service-profile.js'

const LEXICONS: readonly LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'com.atproto.moderation.basePermissions',
    defs: {
      main: {
        type: 'permission-set',
        title: 'Moderation',
        'title:lang': { fr: 'Modération' },
        detail: 'Create moderation reports',
        'detail:lang': {
          'fr-FR': 'Créer des rapports de modération',
        },
        permissions: [
          {
            type: 'permission',
            resource: 'rpc',
            aud: '*',
            lxm: ['com.atproto.moderation.createReport'],
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.calendar.basePermissions',
    defs: {
      main: {
        type: 'permission-set',
        title: 'Calendar',
        'title:lang': { fr: 'Calendrier' },
        detail: 'Manage your events and RSVPs',
        'detail:lang': {
          'fr-BE': 'Gérer vos événements et réponses',
        },
        permissions: [
          {
            type: 'permission',
            resource: 'rpc',
            inheritAud: true,
            lxm: [
              'com.example.calendar.listEvents',
              'com.example.calendar.getEventDetails',
              'com.example.calendar.getEventRsvps',
            ],
          },
          {
            type: 'permission',
            resource: 'repo',
            collection: [
              'com.example.calendar.event',
              'com.example.calendar.rsvp',
            ],
          },
          {
            type: 'permission',
            resource: 'blob',
            accept: ['image/*', 'video/*'],
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.example.spaceRecord',
    defs: {
      main: {
        type: 'record',
        key: 'any',
        record: {
          type: 'object',
          required: ['text', 'createdAt'],
          properties: {
            text: { type: 'string', maxLength: 20 },
            createdAt: { type: 'string', format: 'datetime' },
          },
        },
      },
    },
  },
  // A `space` declaration. The OAuth provider resolves this at token issuance to
  // expand a bare `space:com.example.group` grant into the space type's declared
  // collections, so a test that grants a bare space scope needs the doc to be
  // resolvable.
  {
    lexicon: 1,
    id: 'com.example.group',
    defs: {
      main: {
        type: 'space',
        key: 'any',
        name: 'Example Group',
        description: 'A permissioned group space, for dev and tests',
        'name:lang': { fr: 'Groupe Exemple' },
        collections: ['com.example.groupPost', 'com.example.groupNote'],
      },
    },
  },
]

export class LexiconAuthorityProfile extends ServiceProfile {
  public static async create(
    pds: TestPds,
    userDetails = {
      email: 'lex-authority@test.com',
      handle: 'lex-authority.test',
      password: 'hunter2',
    },
  ) {
    const agent = pds.getAgent()
    await agent.createAccount(userDetails)

    return new LexiconAuthorityProfile(pds, agent, userDetails)
  }

  async createRecords() {
    await this.agent.app.bsky.actor.profile.create(
      { repo: this.did },
      {
        displayName: 'Lexicon Authority',
        description: `the repo containing all the lexicons that can be resolved in dev`,
      },
    )

    for (const doc of LEXICONS) {
      await this.agent.com.atproto.repo.createRecord({
        repo: this.did,
        collection: 'com.atproto.lexicon.schema',
        rkey: doc.id,
        record: doc,
      })
    }
  }
}
