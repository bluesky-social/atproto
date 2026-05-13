import { dbLogger } from '../logger'
import { AccountDb } from './db'
import { WidAccountInventoryEntry } from './db/schema'

export class WidInventoryManager {
  /**
   * @param inventoryTtlDays How long (in days from created_at) a WID inventory
   *   entry is considered live. Sourced from PDS_WID_INVENTORY_TTL_DAYS;
   *   defaults to 30 if not set.
   */
  constructor(
    public db: AccountDb,
    private inventoryTtlDays: number = 30,
  ) {}

  /**
   * Allocate an available WID account from inventory for the given email.
   * Idempotent: if the email already has an 'allocated' row, returns it as-is.
   * This ensures that returning users (who never completed onboarding) get the
   * same QR code and JID rather than consuming a fresh inventory slot.
   * Returns null if no accounts are available.
   */
  async allocateAccount(
    email: string,
  ): Promise<WidAccountInventoryEntry | null> {
    const normalizedEmail = email.trim().toLowerCase()

    // Return any existing allocation for this email so the call is idempotent,
    // but only if the inventory entry is still within its TTL.
    // TTL is measured from created_at (the day the WID operator provisioned
    // the entry), not allocated_at, since the QR code lifetime starts at
    // provisioning time. If the entry has expired, fall through and allocate
    // a fresh one — the expired entry stays 'allocated' (its QR is stale/dead).
    const ttlCutoff = new Date(
      Date.now() - this.inventoryTtlDays * 24 * 60 * 60 * 1000,
    ).toISOString()

    const existing = await this.db.db
      .selectFrom('wid_account_inventory')
      .selectAll()
      .where('status', '=', 'allocated')
      .where('allocated_to_email', '=', normalizedEmail)
      .where('created_at', '>', ttlCutoff) // only return if still within TTL
      .orderBy('allocated_at', 'asc') // oldest first in the unlikely case of duplicates
      .limit(1)
      .executeTakeFirst()

    if (existing) {
      dbLogger.info(
        { did: existing.did, email: normalizedEmail },
        'Returning existing inventory allocation for email (still within TTL)',
      )
      return existing
    }

    // Find an available account
    const account = await this.db.db
      .selectFrom('wid_account_inventory')
      .selectAll()
      .where('status', '=', 'available')
      .orderBy('created_at', 'asc') // FIFO allocation
      .limit(1)
      .executeTakeFirst()

    if (!account) {
      dbLogger.warn('No WID accounts available in inventory')
      return null
    }

    // Allocate it
    const now = new Date().toISOString()
    await this.db.db
      .updateTable('wid_account_inventory')
      .set({
        status: 'allocated',
        allocated_at: now,
        allocated_to_email: normalizedEmail,
      })
      .where('did', '=', account.did)
      .execute()

    dbLogger.info(
      {
        did: account.did,
        email: normalizedEmail,
      },
      'Allocated WID account from inventory',
    )

    // Return updated account
    return {
      ...account,
      status: 'allocated',
      allocated_at: now,
      allocated_to_email: normalizedEmail,
    }
  }

  /**
   * Mark account as consumed after successful activation
   *
   * NOTE: Compares by UUID only (strips domain if present)
   * since received JID may include domain but stored DID is just the UUID
   */
  async markAccountConsumed(did: string): Promise<void> {
    // Extract just the UUID portion (local part before @)
    const didLocalPart = did.split('@')[0]

    // Fetch allocated accounts
    const accounts = await this.db.db
      .selectFrom('wid_account_inventory')
      .selectAll()
      .where('status', '=', 'allocated')
      .execute()

    // Find matching account by UUID comparison
    const matchingAccount = accounts.find((acct) => {
      const storedLocalPart = acct.did.split('@')[0]

      return storedLocalPart === didLocalPart
    })

    if (!matchingAccount) {
      dbLogger.warn(
        { did: did.substring(0, 8) + '...' },
        'No matching allocated account found to mark as consumed',
      )
      return
    }

    // Update the matching account
    await this.db.db
      .updateTable('wid_account_inventory')
      .set({ status: 'consumed' })
      .where('did', '=', matchingAccount.did)
      .where('status', '=', 'allocated')
      .execute()

    dbLogger.info(
      { did: matchingAccount.did },
      'Marked WID account as consumed',
    )
  }

  /**
   * Get inventory status counts
   */
  async getInventoryStatus(): Promise<{
    available: number
    allocated: number
    consumed: number
    total: number
  }> {
    const [availableResult, allocatedResult, consumedResult, totalResult] =
      await Promise.all([
        this.db.db
          .selectFrom('wid_account_inventory')
          .select((eb) => eb.fn.count('did').as('count'))
          .where('status', '=', 'available')
          .executeTakeFirst(),
        this.db.db
          .selectFrom('wid_account_inventory')
          .select((eb) => eb.fn.count('did').as('count'))
          .where('status', '=', 'allocated')
          .executeTakeFirst(),
        this.db.db
          .selectFrom('wid_account_inventory')
          .select((eb) => eb.fn.count('did').as('count'))
          .where('status', '=', 'consumed')
          .executeTakeFirst(),
        this.db.db
          .selectFrom('wid_account_inventory')
          .select((eb) => eb.fn.count('did').as('count'))
          .executeTakeFirst(),
      ])

    return {
      available: Number(availableResult?.count || 0),
      allocated: Number(allocatedResult?.count || 0),
      consumed: Number(consumedResult?.count || 0),
      total: Number(totalResult?.count || 0),
    }
  }

  /**
   * Get detailed inventory list (for admin)
   */
  async getInventoryList(opts?: {
    status?: 'available' | 'allocated' | 'consumed'
    limit?: number
    offset?: number
  }): Promise<WidAccountInventoryEntry[]> {
    let query = this.db.db
      .selectFrom('wid_account_inventory')
      .selectAll()
      .orderBy('created_at', 'desc')

    if (opts?.status) {
      query = query.where('status', '=', opts.status)
    }

    if (opts?.limit) {
      query = query.limit(opts.limit)
    }

    if (opts?.offset) {
      query = query.offset(opts.offset)
    }

    return await query.execute()
  }

  /**
   * Check if inventory is below threshold
   */
  async isInventoryLow(threshold: number): Promise<boolean> {
    const status = await this.getInventoryStatus()
    return status.available < threshold
  }

  /**
   * Get account by DID (for admin lookups)
   */
  async getAccountByDid(did: string): Promise<WidAccountInventoryEntry | null> {
    return await this.db.db
      .selectFrom('wid_account_inventory')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()
      .then((row) => row || null)
  }

  /**
   * Load accounts into inventory from batch import
   * Returns counts of loaded and skipped (duplicate) accounts
   */
  async loadAccounts(
    accounts: Array<{
      did: string
      onboardingUrl: string
      qrCodeUrl: string
      preferredHandle?: string
    }>,
    batchName?: string,
  ): Promise<{ loaded: number; skipped: number; total: number }> {
    const now = new Date().toISOString()
    let loaded = 0
    let skipped = 0

    for (const account of accounts) {
      // Check if account already exists
      const existing = await this.getAccountByDid(account.did)

      if (existing) {
        dbLogger.info({ did: account.did }, 'Skipping duplicate account')
        skipped++
        continue
      }

      // Insert new account
      await this.db.db
        .insertInto('wid_account_inventory')
        .values({
          did: account.did,
          onboarding_url: account.onboardingUrl,
          qr_code_url: account.qrCodeUrl,
          preferred_handle: account.preferredHandle || null,
          created_at: now,
          status: 'available',
          allocated_at: null,
          allocated_to_email: null,
        })
        .execute()

      loaded++
    }

    dbLogger.info(
      { loaded, skipped, total: accounts.length, batchName },
      'Loaded WID accounts into inventory',
    )

    return {
      loaded,
      skipped,
      total: accounts.length,
    }
  }

  /**
   * Clear available WID accounts from inventory
   * Optionally filter by age (olderThanDays)
   */
  async clearAvailableAccounts(
    olderThanDays?: number,
  ): Promise<{ deleted: number }> {
    let query = this.db.db
      .deleteFrom('wid_account_inventory')
      .where('status', '=', 'available')

    // Apply age filter if specified
    if (olderThanDays !== undefined && olderThanDays > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
      const cutoffIso = cutoffDate.toISOString()
      query = query.where('created_at', '<', cutoffIso)
    }

    const result = await query.executeTakeFirst()

    const deleted = Number(result.numDeletedRows ?? 0)

    dbLogger.info(
      {
        deleted,
        olderThanDays: olderThanDays ?? 'all',
      },
      'Cleared available WID accounts from inventory',
    )

    return { deleted }
  }
}
