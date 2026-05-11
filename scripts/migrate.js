import { createClient } from '@libsql/client'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash, randomUUID } from 'crypto'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('TURSO_DATABASE_URL (or DATABASE_URL) is not set')
  process.exit(1)
}

const client = createClient({ url, authToken })

async function migrate() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  TEXT NOT NULL PRIMARY KEY,
      "checksum"            TEXT NOT NULL,
      "finished_at"         TEXT,
      "migration_name"      TEXT NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TEXT,
      "started_at"          TEXT NOT NULL DEFAULT (datetime('now')),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `)

  const { rows } = await client.execute(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
  )
  const applied = new Set(rows.map(r => r.migration_name))

  const migrationsDir = join(__dirname, '..', 'prisma', 'migrations')
  const entries = await readdir(migrationsDir, { withFileTypes: true })
  const dirs = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()

  let ran = 0
  for (const name of dirs) {
    if (applied.has(name)) {
      console.log(`  skip  ${name}`)
      continue
    }

    const sqlPath = join(migrationsDir, name, 'migration.sql')
    const sql = await readFile(sqlPath, 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const id = randomUUID()

    await client.execute({
      sql: `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
            VALUES (?, ?, ?, datetime('now'), 0)`,
      args: [id, checksum, name],
    })

    console.log(`  apply ${name}`)
    try {
      await client.executeMultiple(sql)
      await client.execute({
        sql: `UPDATE "_prisma_migrations"
              SET finished_at = datetime('now'), applied_steps_count = 1
              WHERE id = ?`,
        args: [id],
      })
      ran++
    } catch (err) {
      await client.execute({
        sql: `UPDATE "_prisma_migrations"
              SET logs = ?, rolled_back_at = datetime('now')
              WHERE id = ?`,
        args: [err.message, id],
      })
      throw new Error(`Migration "${name}" failed: ${err.message}`)
    }
  }

  if (ran === 0) {
    console.log('No pending migrations.')
  } else {
    console.log(`Applied ${ran} migration(s).`)
  }

  client.close()
}

migrate().catch(err => {
  console.error(err.message)
  process.exit(1)
})
