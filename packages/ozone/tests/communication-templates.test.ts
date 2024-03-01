import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'

describe('communication-templates', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_communication_templates',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const templateOne = {
    name: 'Test name 1',
    subject: 'Test subject 1',
    contentMarkdown: 'Test content 1',
  }

  const listTemplates = async () => {
    const { data } =
      await agent.api.com.atproto.admin.listCommunicationTemplates(
        {},
        {
          headers: await network.ozone.modHeaders('moderator'),
        },
      )
    return data.communicationTemplates
  }

  describe('create templates', () => {
    it('only allows admins to create new templates', async () => {
      const moderatorReq =
        agent.api.com.atproto.admin.createCommunicationTemplate(
          { ...templateOne, createdBy: sc.dids.bob },
          {
            encoding: 'application/json',
            headers: await network.ozone.modHeaders('moderator'),
          },
        )
      await expect(moderatorReq).rejects.toThrow(
        'Must be an admin to create a communication template',
      )
      const modReq =
        await agent.api.com.atproto.admin.createCommunicationTemplate(
          { ...templateOne, createdBy: sc.dids.bob },
          {
            encoding: 'application/json',
            headers: await network.ozone.modHeaders('admin'),
          },
        )

      expect(modReq.data).toMatchObject({
        ...templateOne,
        lastUpdatedBy: sc.dids.bob,
      })
    })
  })
  describe('list templates', () => {
    it('returns all saved templates', async () => {
      const listBefore = await listTemplates()
      expect(listBefore.length).toEqual(1)
      expect(listBefore[0]).toMatchObject(templateOne)

      const templateTwo = {
        ...templateOne,
        name: 'Test template 2',
      }
      await agent.api.com.atproto.admin.createCommunicationTemplate(
        { ...templateTwo, createdBy: sc.dids.bob },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders('admin'),
        },
      )

      const listAfter = await listTemplates()
      expect(listAfter.length).toEqual(2)
      expect(listAfter[1]).toMatchObject(templateTwo)
    })
  })
  describe('update template', () => {
    it('allows moderators to update a template by id', async () => {
      const { data } =
        await agent.api.com.atproto.admin.updateCommunicationTemplate(
          { id: '1', updatedBy: sc.dids.bob, name: '1 Test template' },
          {
            encoding: 'application/json',
            headers: await network.ozone.modHeaders('admin'),
          },
        )

      expect(data.name).not.toEqual(templateOne.name)
      expect(data.name).toEqual('1 Test template')
    })
  })
  describe('delete template', () => {
    it('allows admins to remove a template by id', async () => {
      const modReq = agent.api.com.atproto.admin.deleteCommunicationTemplate(
        { id: '1' },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders('moderator'),
        },
      )

      await expect(modReq).rejects.toThrow(
        'Must be an admin to delete a communication template',
      )

      await agent.api.com.atproto.admin.deleteCommunicationTemplate(
        { id: '1' },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders('admin'),
        },
      )
      const list = await listTemplates()
      expect(list.length).toEqual(1)
    })
  })
})
