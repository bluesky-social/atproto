import { Repo, service } from '@adxp/common'
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

export const isSubscriber = async (
  db: Database,
  host: string,
  user: string,
): Promise<boolean> => {
  const hosts = await db.getSubscriptionsForUser(user)
  return hosts.indexOf(host) > -1
}

export const notifyOneOff = async (
  db: Database,
  ownHost: string,
  didToNotify: string,
  repo: Repo,
): Promise<void> => {
  const username = await service.getUsernameFromDidNetwork(didToNotify)
  if (!username) {
    console.error(`Could not find user on DID network: ${didToNotify}`)
    return
  }
  const [_, host] = username.split('@')
  if (host === ownHost) return

  const baseUrl = `http://${host}`
  // if it's a subscriber, we'll be notifying anyway
  if (!(await isSubscriber(db, host, repo.did))) {
    await attemptNotify(baseUrl, repo)
  }
}
