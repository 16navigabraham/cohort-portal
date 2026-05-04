import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { createClient } from '@libsql/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true })

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrationsDir = path.resolve(__dirname, 'migrations')
const dirs = fs.readdirSync(migrationsDir).sort()

for (const dir of dirs) {
  const sqlPath = path.join(migrationsDir, dir, 'migration.sql')
  if (!fs.existsSync(sqlPath)) continue
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log(`Applying: ${dir}`)
  await client.executeMultiple(sql)
  console.log(`  Done.`)
}

console.log('All migrations applied to Turso.')
client.close()
