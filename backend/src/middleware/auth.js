import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

const safeEqual = (left, right) => {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest()
  const rightHash = crypto.createHash('sha256').update(String(right)).digest()
  return crypto.timingSafeEqual(leftHash, rightHash)
}

export function login(username, password) {
  if (!safeEqual(username, config.auth.username) || !safeEqual(password, config.auth.password)) return null
  const user = { id: 1, username: config.auth.username, name: '生产管理员', role: 'ADMIN' }
  return { user, token: jwt.sign(user, config.auth.jwtSecret, { expiresIn: config.auth.expiresIn }) }
}

export function requireAuth(req, res, next) {
  if (!config.auth.enabled) return next()
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return res.status(401).json({ success: false, message: '请先登录' })
  try {
    req.user = jwt.verify(token, config.auth.jwtSecret)
    next()
  } catch {
    res.status(401).json({ success: false, message: '登录已过期，请重新登录' })
  }
}
