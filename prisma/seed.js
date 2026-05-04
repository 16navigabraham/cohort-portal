import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcrypt'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true })

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
  const prisma = new PrismaClient({ adapter })

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Admin already exists:', email)
    await prisma.$disconnect()
    return
  }

  const name = process.env.ADMIN_NAME ?? 'Web3Nova Admin'
  const hashed = await bcrypt.hash(password, 10)
  const admin = await prisma.user.create({
    data: { name, email, password: hashed, role: 'ADMIN' }
  })

  console.log('Super admin created:', admin.email)
  await prisma.$disconnect()
}

main().catch(console.error)
