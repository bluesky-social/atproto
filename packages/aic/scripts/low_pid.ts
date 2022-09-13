import { pid } from '../src/pid'

//@TODO put this in a bench file
const run = async () => {
  let min_p = 'z'
  const tic = Number(new Date())
  const iterations = 100_000_000
  for (let i = 0; i < iterations; i++) {
    const data = {
      nonce: Math.random() * (Number.MAX_SAFE_INTEGER + 1),
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
    const p = await pid(data)
    if (p < min_p) {
      min_p = p
      console.log('\n', i, min_p, data)
    }
    if (i % 500_000 == 0) {
      process.stdout.write(
        `\r${i} ${min_p} hashrate ${i / (Number(new Date()) - tic)} KH/s`,
      )
    }
  }
  const toc = Number(new Date())
  console.log(
    'time',
    toc - tic,
    'iterations',
    iterations,
    'hashrate KH/s',
    iterations / (toc - tic),
  )
}

run()
