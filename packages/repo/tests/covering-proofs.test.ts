import { CID } from 'multiformats'
import { MST } from '../src/mst'
import { MemoryBlockstore } from '../src/storage'
import * as k from './_keys'
import { BlockMap } from '../src'

describe('covering proofs', () => {
  /**
   *
   *                *                                  *
   *       _________|________                      ____|____
   *       |   |    |    |   |                    |    |    |
   *       *   b  __*__  f   *       ->         __*__  d  __*__
   *       |     |     |     |                 |  |  |   |  |  |
   *       a     c     e     g                 *  b  *   *  f  *
   *                                           |     |   |     |
   *                                           a     c   e     g
   *
   *
   *
   */
  it('two deep split ', async () => {
    const storage = new MemoryBlockstore()
    const cid = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )

    let mst = await MST.create(storage)
    mst = await mst.add(k.A0, cid)
    mst = await mst.add(k.B1, cid)
    mst = await mst.add(k.C0, cid)
    mst = await mst.add(k.E0, cid)
    mst = await mst.add(k.F1, cid)
    mst = await mst.add(k.G0, cid)

    const pointerBeforeOp = await mst.getPointer()

    mst = await mst.add(k.D2, cid)
    const proof = await mst.getCoveringProof(k.D2)

    const proofStorage = new MemoryBlockstore(proof)
    let proofMst = await MST.load(proofStorage, await mst.getPointer())
    proofMst = await proofMst.delete(k.D2)
    const pointerAfterInvert = await proofMst.getPointer()
    expect(pointerAfterInvert.equals(pointerBeforeOp)).toBe(true)
  })

  /**
   *
   *                *                               *
   *           _____|_____                      ____|____
   *           |  |   |  |                      |   |   |
   *           a  b   d  e       ->             *   c   *
   *                                            |       |
   *                                          __*__   __*__
   *                                          |   |   |   |
   *                                          a   b   d   e
   *
   *
   *
   */
  it('two deep leafless splits ', async () => {
    const storage = new MemoryBlockstore()
    const cid = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )

    let mst = await MST.create(storage)
    mst = await mst.add(k.A0, cid)
    mst = await mst.add(k.B0, cid)
    mst = await mst.add(k.D0, cid)
    mst = await mst.add(k.E0, cid)

    const pointerBeforeOp = await mst.getPointer()

    mst = await mst.add(k.C2, cid)
    const proof = await mst.getCoveringProof(k.C2)

    const proofStorage = new MemoryBlockstore(proof)
    let proofMst = await MST.load(proofStorage, await mst.getPointer())
    proofMst = await proofMst.delete(k.C2)
    const pointerAfterInvert = await proofMst.getPointer()
    expect(pointerAfterInvert.equals(pointerBeforeOp)).toBe(true)
  })

  // This complex multi op commit includes:
  // - a two deep split
  // - a two deep merge
  // - an addition that requires knowledge of a leaf two deeper
  /**
   *
   *                *                               *
   *           _____|_____                    ______|_______
   *          |  |  |  |  |                  |  |  |  |  |  |
   *          *  c  *  e  *     ->           a  *  e  *  g  *
   *          |     |    _|_                    |     |     |
   *          *     *   |   |                  _*_    *     *
   *          b     d   f   h                 |   |   |     |
   *                                          b   d   f     h
   *
   *
   *
   */
  it('complex multi-op commit', async () => {
    const storage = new MemoryBlockstore()
    const cid = CID.parse(
      'bafyreie5cvv4h45feadgeuwhbcutmh6t2ceseocckahdoe6uat64zmz454',
    )

    let mst = await MST.create(storage)
    mst = await mst.add(k.B0, cid)
    mst = await mst.add(k.C2, cid)
    mst = await mst.add(k.D0, cid)
    mst = await mst.add(k.E2, cid)
    mst = await mst.add(k.F0, cid)
    mst = await mst.add(k.H0, cid)

    const pointerBeforeOp = await mst.getPointer()

    mst = await mst.add(k.A2, cid)
    mst = await mst.add(k.G2, cid)
    mst = await mst.delete(k.C2)

    const proofs = await Promise.all([
      mst.getCoveringProof(k.A2),
      mst.getCoveringProof(k.G2),
      mst.getCoveringProof(k.C2),
    ])
    const proof = proofs.reduce((acc, cur) => acc.addMap(cur), new BlockMap())
    const proofStorage = new MemoryBlockstore(proof)

    const delA = async (mst: MST) => mst.delete(k.A2)
    const delG = async (mst: MST) => mst.delete(k.G2)
    const addC = async (mst: MST) => mst.add(k.C2, cid)

    const testOrder = async (fns: ((mst: MST) => Promise<MST>)[]) => {
      let proofMst = await MST.load(proofStorage, await mst.getPointer())
      for (const fn of fns) {
        proofMst = await fn(proofMst)
      }
      const pointerAfterInvert = await proofMst.getPointer()
      expect(pointerAfterInvert.equals(pointerBeforeOp)).toBe(true)
    }

    // test that the operations work in any order
    await testOrder([delA, delG, addC])
    await testOrder([delA, addC, delG])
    await testOrder([delG, delA, addC])
    await testOrder([delG, addC, delA])
    await testOrder([addC, delA, delG])
    await testOrder([addC, delG, delA])
  })
})
