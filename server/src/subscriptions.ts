import { Repo } from '@bluesky-demo/common'
import Database from './db'

export const attemptNotify = async (
  host: string,
  repo: Repo,
): Promise<void> => {
  try {
    await repo.push(host)
  } catch (err) {
    // log an error, but don't throw
    console.error(`Could not notify ${host} about update to repo: ${repo.did}`)
  }
}

export const notifyHosts = async (
  hosts: string[],
  repo: Repo,
): Promise<void> => {
  await Promise.all(hosts.map((h) => attemptNotify(h, repo)))
}

export const notifySubscribers = async (
  db: Database,
  repo: Repo,
): Promise<void> => {
  const hosts = await db.getSubscriptionsForUser(repo.did)
  await notifyHosts(hosts, repo)
}
