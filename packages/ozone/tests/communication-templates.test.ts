import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

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
    const { data } = await agent.tools.ozone.communication.listTemplates(
      {},
      {
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneCommunicationListTemplates,
          'moderator',
        ),
      },
    )
    return data.communicationTemplates
  }

  describe('create templates', () => {
    it('only allows admins to create new templates', async () => {
      const moderatorReq = agent.tools.ozone.communication.createTemplate(
        { ...templateOne, createdBy: sc.dids.bob },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneCommunicationCreateTemplate,
            'triage',
          ),
        },
      )
      await expect(moderatorReq).rejects.toThrow(
        'Must be a moderator to create a communication template',
      )
      const modReq = await agent.tools.ozone.communication.createTemplate(
        { ...templateOne, createdBy: sc.dids.bob },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneCommunicationCreateTemplate,
            'admin',
          ),
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
      await agent.tools.ozone.communication.createTemplate(
        { ...templateTwo, createdBy: sc.dids.bob },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneCommunicationCreateTemplate,
            'admin',
          ),
        },
      )

      const listAfter = await listTemplates()
      expect(listAfter.length).toEqual(2)
      expect(listAfter[1]).toMatchObject(templateTwo)
    })
  })
  describe('update template', () => {
    it('allows moderators to update a template by id', async () => {
      const { data } = await agent.tools.ozone.communication.updateTemplate(
        { id: '1', updatedBy: sc.dids.bob, name: '1 Test template' },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneCommunicationUpdateTemplate,
            'admin',
          ),
        },
      )

      expect(data.name).not.toEqual(templateOne.name)
      expect(data.name).toEqual('1 Test template')
    })
  })
  describe('delete template', () => {
    it('allows admins to remove a template by id', async () => {
      const modReq = agent.tools.ozone.communication.deleteTemplate(
        { id: '1' },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneCommunicationDeleteTemplate,
            'triage',
          ),
        },
      )

      await expect(modReq).rejects.toThrow(
        'Must be a moderator to delete a communication template',
      )

      await agent.tools.ozone.communication.deleteTemplate(
        { id: '1' },
        {
          encoding: 'application/json',
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneCommunicationDeleteTemplate,
            'moderator',
          ),
        },
      )
      const list = await listTemplates()
      expect(list.length).toEqual(1)
    })
  })
})
