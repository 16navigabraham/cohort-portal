import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './src/routes/auth.js'
import adminRouter from './src/routes/admin.js'
import studentRouter from './src/routes/student.js'
import { requestLogger, errorLogger } from './src/middleware/logger.js'

const app = express()
const PORT = process.env.PORT || 3012

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())
app.use(requestLogger)

app.use('/auth', authRouter)
app.use('/admin', adminRouter)
app.use('/student', studentRouter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.use(errorLogger)
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
