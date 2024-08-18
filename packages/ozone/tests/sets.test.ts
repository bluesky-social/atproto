import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent, {
  ToolsOzoneSetDefs,
  ToolsOzoneSetQuerySets,
} from '@atproto/api'
import { forSnapshot } from './_util'

describe('ozone-sets', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const sampleSet1 = {
    name: 'test-set-1',
    description: 'Test set 1',
  }

  const sampleSet2 = {
    name: 'test-set-2',
  }

  const sampleSet3 = {
    name: 'another-set',
    description: 'Another test set',
  }

  const upsertSet = async (set: ToolsOzoneSetDefs.Set) => {
    const { data } = await agent.tools.ozone.set.upsertSet(set, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders('admin'),
    })

    return data
  }

  const removeSet = async (name: string) => {
    await agent.tools.ozone.set.deleteSet(
      { name },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders('admin'),
      },
    )
  }

  const addToSet = async (name: string, values: string[]) => {
    await agent.tools.ozone.set.addValues(
      { name, values },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders('admin'),
      },
    )
  }

  const getSet = async (name: string) => {
    const { data } = await agent.tools.ozone.set.getValues(
      { name },
      {
        headers: await network.ozone.modHeaders('moderator'),
      },
    )
    return data
  }

  const querySets = async (params: ToolsOzoneSetQuerySets.QueryParams) => {
    const { data } = await agent.tools.ozone.set.querySets(params, {
      headers: await network.ozone.modHeaders('moderator'),
    })
    return data
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_sets',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('querySets', () => {
    beforeAll(async () => {
      await Promise.all([
        upsertSet(sampleSet1),
        upsertSet(sampleSet2),
        upsertSet(sampleSet3),
      ])
    })
    afterAll(async () => {
      await Promise.all([
        removeSet(sampleSet1.name),
        removeSet(sampleSet2.name),
        removeSet(sampleSet3.name),
      ])
    })
    it('returns all sets when no parameters are provided', async () => {
      const result = await querySets({})
      expect(result.sets.length).toBe(3)
      expect(forSnapshot(result.sets)).toMatchSnapshot()
    })

    it('limits the number of returned sets', async () => {
      const result = await querySets({ limit: 2 })
      expect(result.sets.length).toBe(2)
      expect(result.cursor).toBeDefined()
    })

    it('returns sets after the cursor', async () => {
      const firstPage = await querySets({ limit: 2 })
      const secondPage = await querySets({ cursor: firstPage.cursor })
      expect(secondPage.sets.length).toBe(1)
      expect(secondPage.sets[0].name).toBe('test-set-2')
    })

    it('filters sets by name prefix', async () => {
      const result = await querySets({ namePrefix: 'test-' })
      expect(result.sets.length).toBe(2)
      expect(result.sets.map((s) => s.name)).toEqual([
        'test-set-1',
        'test-set-2',
      ])
    })

    it('sorts sets by given column and direction', async () => {
      const sortedByName = await querySets({ sortBy: 'name' })
      expect(sortedByName.sets.map((s) => s.name)).toEqual([
        'another-set',
        'test-set-1',
        'test-set-2',
      ])
      const reverseSortedByName = await querySets({
        sortBy: 'name',
        sortDirection: 'desc',
      })
      expect(reverseSortedByName.sets.map((s) => s.name)).toEqual([
        'test-set-2',
        'test-set-1',
        'another-set',
      ])
    })
  })

  describe('upsertSet', () => {
    afterAll(async () => {
      await removeSet('new-test-set')
    })
    it('creates a new set', async () => {
      const result = await upsertSet({
        name: 'new-test-set',
        description: 'A new test set',
      })
      expect(forSnapshot(result)).toMatchSnapshot()
    })

    it('updates an existing set', async () => {
      const result = await upsertSet({
        name: 'new-test-set',
        description: 'Updated description',
      })
      expect(forSnapshot(result)).toMatchSnapshot()
    })

    it('allows setting empty description', async () => {
      const result = await upsertSet({
        name: 'new-test-set',
        description: '',
      })
      expect(result.description).toBeUndefined()
    })
  })

  describe('add', () => {
    beforeAll(async () => {
      await upsertSet(sampleSet1)
      await upsertSet(sampleSet2)
    })
    afterAll(async () => {
      await removeSet('test-set-1')
      await removeSet('test-set-2')
    })
    it('adds new values to an existing set', async () => {
      const setName = 'test-set-1'
      const newValues = ['value1', 'value2', 'value3']
      await addToSet(setName, newValues)

      const result = await getSet(setName)
      expect(result.values).toEqual(expect.arrayContaining(newValues))
    })

    it('does not duplicate existing values', async () => {
      const setName = 'test-set-2'
      const initialValues = ['initial1', 'initial2']
      await addToSet(setName, initialValues)

      const newValues = ['initial2', 'new1', 'new2']
      await addToSet(setName, newValues)

      const result = await getSet(setName)
      expect(result.values).toEqual(
        expect.arrayContaining([...initialValues, 'new1', 'new2']),
      )
      expect(result.values.filter((v) => v === 'initial2').length).toBe(1)
    })
  })
})
