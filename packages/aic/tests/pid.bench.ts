import { bitStrength, pid } from '../src/pid'

describe('PID Benchmark', () => {
  let found = 'z'
  const start = Number(new Date())
  const iterations = 10_000_000

  it('benchmarks finding a strong PID', async () => {
    for (let i = 0; i < iterations; i++) {
      const data = {
        nonce: Math.random() * Number.MAX_SAFE_INTEGER + 1,
        a: 1,
        b: 2,
        c: 3,
        'adx/account_keys': [
          'did:key:zDnaeycJUNQugcrag1WmLePtK9agLYLyXvscnQM4FHm1ASiRV',
        ],
        'adx/recovery_keys': [
          'did:key:zDnaepvdtQ3jDLU15JihZwmMghuRugJArN8x9rm6Czt9BkHEM',
        ],
        'adx/tick_keys': [
          'did:key:zDnaenyrpzvz4VNQVRTSRUwQWM8wLNcUeh1mmoBiTb1PLQrht',
        ],
        'adx/consortium_keys': [
          'did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh',
        ],
        'adx/home': ['https://blueskyweb.xyz/'],
      }
      const newPid = await pid(data)
      if (newPid < found) {
        found = newPid
      }
      if (i % 500_000 == 0) {
        const hashrate = i / (Number(new Date()) - start)
        console.log(`Iterations: ${i}
Found: ${found}
Bit Strength: ${bitStrength(found)}
Hashrate: ${hashrate.toFixed(3)} KH/s
        `)
      }
    }
    const end = Number(new Date())
    console.log(`Time: ${end - start}
Iterations: ${iterations}
Found: ${found}
Bit Strength: ${bitStrength(found)}
Hashrate: ${iterations / (end - start)} KH/s
    `)
  })
})
