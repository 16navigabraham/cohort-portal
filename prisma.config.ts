import { defineConfig } from 'prisma/config'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
  migrate: {
    adapter: () => new PrismaLibSql({
      url: process.env.DATABASE_URL ?? 'file:./dev.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
})
