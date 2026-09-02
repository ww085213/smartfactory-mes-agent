import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'
import { ZodError } from 'zod'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import routes from './routes/index.js'
import { config } from './config.js'

export const app = express()

app.use(helmet())
app.use(cors({
  credentials: true,
  origin: (origin, callback) => callback(null, !origin || config.corsOrigins.includes(origin))
}))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' })
}), routes)

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDist = path.resolve(currentDir, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')))
}

app.use((req, res) => res.status(404).json({ success: false, message: '接口不存在' }))
app.use((error, req, res, next) => {
  const isValidation = error instanceof ZodError
  const isDuplicate = error?.code === 'P2002'
  const isMissing = error?.code === 'P2025'
  const status = isValidation ? 400 : isDuplicate ? 409 : isMissing ? 404 : error.status || 500
  if (status >= 500) console.error(error)
  res.status(status).json({
    success: false,
    message: isValidation ? '请求参数不正确' : isDuplicate ? '编号已存在，请更换后重试' : isMissing ? '数据不存在' : error.message || '服务器内部错误',
    ...(isValidation ? { details: error.issues } : {})
  })
})

app.locals.mode = config.demoMode ? 'demo' : 'mysql'
