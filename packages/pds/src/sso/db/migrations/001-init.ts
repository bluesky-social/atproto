import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("auth_callback")
    .addColumn("state", "varchar", (col) => col.primaryKey())
    .addColumn("scope", "varchar", (col) => col.notNull())
    .addColumn("nonce", "varchar", (col) => col.notNull())
    .addColumn("idpId", "varchar", (col) => col.notNull())
    .addColumn("redirectUri", "varchar", (col) => col.notNull())
    .addColumn("codeVerifier", "varchar")
    .execute();

  await db.schema
    .createTable("auth_claims")
    .addColumn("did", "varchar", (col) => col.notNull())
    .addColumn("idpId", "varchar", (col) => col.notNull())
    .addColumn("sub", "varchar", (col) => col.notNull())
    .addColumn("picture", "varchar")
    .addColumn("email", "varchar")
    .execute();

  await db.schema
    .createTable("identity_provider")
    .addColumn("id", "varchar", (col) => col.primaryKey())
    .addColumn("name", "varchar")
    .addColumn("icon", "varchar")
    .addColumn("issuer", "varchar", (col) => col.notNull())
    .addColumn("clientId", "varchar", (col) => col.notNull())
    .addColumn("clientSecret", "varchar")
    .addColumn("scope", "varchar", (col) => col.notNull())
    .addColumn("usePkce", "integer", (col) => col.notNull())
    .addColumn("discoverable", "integer", (col) => col.notNull())
    .addColumn("metadata", "varchar")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("auth_callback").execute();
  await db.schema.dropTable("auth_claims").execute();
  await db.schema.dropTable("identity_provider").execute();
}
