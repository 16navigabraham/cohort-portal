import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './src/routes/auth.js'
import adminRouter from './src/routes/admin.js'
import studentRouter from './src/routes/student.js'

const app = express()
const PORT = process.env.PORT || 3012

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)
app.use('/admin', adminRouter)
app.use('/student', studentRouter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
