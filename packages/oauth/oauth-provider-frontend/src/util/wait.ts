import { sleep } from './sleep'

export async function wait<T>(delay: number, promise: T) {
  const [result] = await Promise.all([promise, sleep(delay)])
  return result
}
