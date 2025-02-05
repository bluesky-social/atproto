import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { REASONMISLEADING } from '../dist/lexicon/types/com/atproto/moderation/defs'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'

describe('moderation subject content tagging', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_content_tagger_test',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const getStatus = async (subject: string) => {
    const { subjectStatuses } = await modClient.queryStatuses({
      subject,
    })

    return subjectStatuses[0]
  }

  describe('lang tagger', () => {
    it('Adds language tag to post from text', async () => {
      const createPostAndReport = async (text: string) => {
        const post = await sc.post(sc.dids.carol, text)
        await network.processAll()
        const report = await sc.createReport({
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.ref.uriStr,
            cid: post.ref.cidStr,
          },
          reportedBy: sc.dids.alice,
        })

        return { post, report }
      }
      const [japanesePost, greekPost] = await Promise.all([
        createPostAndReport('Xで有名な人達＋反AIや絵描きによくない'),
        createPostAndReport(
          'Λορεμ ιπσθμ δολορ σιτ αμετ, μει θτ vιδιτ νοστρθμ προπριαε',
        ),
      ])

      const [japanesePostStatus, greekPostStatus] = await Promise.all([
        getStatus(japanesePost.post.ref.uriStr),
        getStatus(greekPost.post.ref.uriStr),
      ])

      expect(japanesePostStatus.tags).toContain('lang:ja')
      expect(greekPostStatus.tags).toContain('lang:el')
    })

    it('Uses name/description text for language tag for list', async () => {
      const createListAndReport = async (
        name: string,
        description?: string,
      ) => {
        const list = await sc.createList(sc.dids.carol, name, 'mod', {
          description,
        })
        await network.processAll()
        const report = await sc.createReport({
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: list.uriStr,
            cid: list.cidStr,
          },
          reportedBy: sc.dids.alice,
        })
        return { list, report }
      }

      const [listWithDescription, listWithoutDescription] = await Promise.all([
        createListAndReport(
          'よくない',
          'Xで有名な人達＋反AIや絵描きによくない感情を持つ人達＋絵描き詐称',
        ),
        createListAndReport('人達＋反AIや絵描きによくない感情'),
      ])

      const [japaneseListStatus, chineseListStatus] = await Promise.all([
        getStatus(listWithDescription.list.uriStr),
        getStatus(listWithoutDescription.list.uriStr),
      ])

      expect(japaneseListStatus.tags).toContain('lang:ja')
      expect(chineseListStatus.tags).toContain('lang:ja')
    })
  })

  describe('embed tagger', () => {
    it('Adds image tag to post with image', async () => {
      const postWithImageMediaEmbed = sc.posts[sc.dids.carol][0]
      const postWithImageEmbed = sc.replies[sc.dids.bob][0]
      await Promise.all([
        sc.createReport({
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postWithImageMediaEmbed.ref.uriStr,
            cid: postWithImageMediaEmbed.ref.cidStr,
          },
          reportedBy: sc.dids.alice,
        }),
        sc.createReport({
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: postWithImageEmbed.ref.uriStr,
            cid: postWithImageEmbed.ref.cidStr,
          },
          reportedBy: sc.dids.alice,
        }),
      ])

      const [mediaImagePostStatus, imagePostStatus] = await Promise.all([
        getStatus(postWithImageMediaEmbed.ref.uriStr),
        getStatus(postWithImageEmbed.ref.uriStr),
      ])
      expect(mediaImagePostStatus.tags).toContain('embed:image')
      expect(imagePostStatus.tags).toContain('embed:image')
    })
  })

  describe('report tagger', () => {
    it('Adds report reason tag', async () => {
      await Promise.all([
        sc.createReport({
          reasonType: REASONSPAM,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          reportedBy: sc.dids.alice,
        }),
        sc.createReport({
          reasonType: REASONMISLEADING,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.carol,
          },
          reportedBy: sc.dids.alice,
        }),
      ])

      const accountStatus = await getStatus(sc.dids.carol)

      expect(accountStatus.tags).toContain('report:spam')
      expect(accountStatus.tags).toContain('report:misleading')
    })
  })
})
