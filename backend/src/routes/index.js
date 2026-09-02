import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { businessService } from '../services/businessService.js'
import { chat } from '../agent/agentService.js'
import { config } from '../config.js'
import { prisma } from '../db/prisma.js'
import { login, requireAuth } from '../middleware/auth.js'
import { knowledgeService } from '../rag/knowledgeService.js'
import { aiConfigService } from '../services/aiConfigService.js'

const router = Router()
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next)
const idOf = (req) => z.coerce.number().int().positive().parse(req.params.id)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
const limiterHandler = (req, res) => res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' })
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, handler: limiterHandler })
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: limiterHandler })

const orderFields = {
  orderNo: z.string().trim().min(3).max(30), productName: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().int().positive(), completedQuantity: z.coerce.number().int().min(0).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED']).optional(),
  startDate: dateSchema, deadline: dateSchema
}
const checkOrderDates = (data, context) => {
  if (data.startDate && data.deadline && data.deadline < data.startDate) context.addIssue({ code: 'custom', path: ['deadline'], message: '交付日期不能早于开始日期' })
  if (data.quantity !== undefined && data.completedQuantity !== undefined && data.completedQuantity > data.quantity) context.addIssue({ code: 'custom', path: ['completedQuantity'], message: '已完成数量不能超过计划数量' })
}
const orderCreateSchema = z.object(orderFields).superRefine(checkOrderDates)
const orderUpdateSchema = z.object(Object.fromEntries(Object.entries(orderFields).map(([key, value]) => [key, value.optional()]))).superRefine(checkOrderDates)
const equipmentSchema = z.object({
  equipmentNo: z.string().trim().min(3).max(30), name: z.string().trim().min(1).max(100),
  status: z.enum(['RUNNING', 'STOPPED', 'FAULT', 'MAINTENANCE']).optional(),
  productionLine: z.string().trim().min(1).max(50), runtimeHours: z.coerce.number().min(0).optional(),
  utilizationRate: z.coerce.number().min(0).max(100).optional()
})
const inventorySchema = z.object({
  materialNo: z.string().trim().min(3).max(30), materialName: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().int().min(0), safetyStock: z.coerce.number().int().min(0), unit: z.string().trim().min(1).max(10)
})
const alertSchema = z.object({
  equipmentId: z.coerce.number().int().positive().nullable().optional(), alertType: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(500), level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  status: z.enum(['OPEN', 'PROCESSING', 'RESOLVED']).optional()
})
const reportSchema = z.object({
  orderId: z.coerce.number().int().positive(), date: dateSchema,
  plannedQuantity: z.coerce.number().int().min(0), actualQuantity: z.coerce.number().int().min(0)
})
const aiBaseUrlSchema = z.string().trim().url().refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)
}, '模型地址必须使用 HTTPS；本机服务可使用 localhost')
const aiConfigSchema = z.object({
  provider: z.enum(['deepseek', 'custom']), baseUrl: aiBaseUrlSchema.optional(),
  model: z.string().trim().min(2).max(100),
  apiKey: z.string().trim().min(8).max(500).regex(/^[^\r\n]+$/).optional(),
  clearApiKey: z.boolean().optional()
}).superRefine((data, context) => {
  if (data.provider === 'custom' && !data.baseUrl) context.addIssue({ code: 'custom', path: ['baseUrl'], message: '自定义服务必须填写接口地址' })
})

const paginated = (items, query) => {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '10', 10) || 10))
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}

router.get('/health', wrap(async (req, res) => {
  if (!config.demoMode) await prisma.$queryRaw`SELECT 1`
  res.json({ success: true, data: { status: 'ok', dataMode: config.demoMode ? 'demo' : 'mysql', time: new Date().toISOString() } })
}))
router.get('/auth/status', (req, res) => res.json({ success: true, data: { enabled: config.auth.enabled, demoMode: config.demoMode } }))
router.post('/auth/login', loginLimiter, wrap(async (req, res) => {
  const credentials = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).parse(req.body)
  const result = login(credentials.username, credentials.password)
  if (!result) return res.status(401).json({ success: false, message: '用户名或密码错误' })
  res.json({ success: true, data: result })
}))

router.use(requireAuth)
router.get('/auth/me', (req, res) => res.json({ success: true, data: req.user || { name: '演示用户', role: 'ADMIN' } }))
router.get('/dashboard', wrap(async (req, res) => res.json({ success: true, data: await businessService.getDashboard() })))
router.get('/notifications', wrap(async (req, res) => res.json({ success: true, data: await businessService.getNotifications() })))

router.get('/orders', wrap(async (req, res) => res.json({ success: true, data: paginated(await businessService.listOrders(req.query), req.query) })))
router.post('/orders', wrap(async (req, res) => res.status(201).json({ success: true, data: await businessService.createOrder(orderCreateSchema.parse(req.body)) })))
router.put('/orders/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.updateOrder(idOf(req), orderUpdateSchema.parse(req.body)) })))
router.delete('/orders/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.deleteOrder(idOf(req)) })))

router.get('/equipment', wrap(async (req, res) => res.json({ success: true, data: paginated(await businessService.listEquipment(req.query), req.query) })))
router.post('/equipment', wrap(async (req, res) => res.status(201).json({ success: true, data: await businessService.createEquipment(equipmentSchema.parse(req.body)) })))
router.put('/equipment/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.updateEquipment(idOf(req), equipmentSchema.partial().parse(req.body)) })))
router.delete('/equipment/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.deleteEquipment(idOf(req)) })))

router.get('/inventory', wrap(async (req, res) => res.json({ success: true, data: paginated(await businessService.listInventory({ ...req.query, lowStock: req.query.lowStock === 'true' }), req.query) })))
router.post('/inventory', wrap(async (req, res) => res.status(201).json({ success: true, data: await businessService.createInventory(inventorySchema.parse(req.body)) })))
router.put('/inventory/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.updateInventory(idOf(req), inventorySchema.partial().parse(req.body)) })))
router.delete('/inventory/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.deleteInventory(idOf(req)) })))

router.get('/alerts', wrap(async (req, res) => res.json({ success: true, data: paginated(await businessService.listAlerts({ ...req.query, today: req.query.today === 'true' }), req.query) })))
router.post('/alerts', wrap(async (req, res) => res.status(201).json({ success: true, data: await businessService.createAlert(alertSchema.parse(req.body)) })))
router.put('/alerts/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.updateAlert(idOf(req), alertSchema.partial().parse(req.body)) })))
router.delete('/alerts/:id', wrap(async (req, res) => res.json({ success: true, data: await businessService.deleteAlert(idOf(req)) })))

router.get('/production-records', wrap(async (req, res) => {
  const filters = z.object({ orderId: z.coerce.number().int().positive().optional(), date: dateSchema.optional() }).parse(req.query)
  res.json({ success: true, data: paginated(await businessService.listProductionRecords(filters), req.query) })
}))
router.post('/production-records', wrap(async (req, res) => res.status(201).json({ success: true, data: await businessService.recordProduction(reportSchema.parse(req.body)) })))

router.get('/knowledge/search', wrap(async (req, res) => {
  const query = z.object({ q: z.string().trim().min(2).max(500), limit: z.coerce.number().int().min(1).max(5).optional() }).parse(req.query)
  res.json({ success: true, data: { query: query.q, matches: knowledgeService.search(query.q, query.limit || 3) } })
}))
router.get('/agent/actions', wrap(async (req, res) => res.json({ success: true, data: paginated(await businessService.listAgentActions(), req.query) })))
router.get('/ai/status', (req, res) => res.json({
  success: true,
  data: {
    mode: config.ai.apiKey ? 'llm' : 'local', model: config.ai.apiKey ? config.ai.model : null,
    tools: 8, writeTools: 1, ragSources: knowledgeService.sources()
  }
}))
router.get('/ai/config', (req, res) => res.json({ success: true, data: aiConfigService.getPublic() }))
router.post('/ai/config/test', aiLimiter, wrap(async (req, res) => {
  res.json({ success: true, data: await aiConfigService.test(aiConfigSchema.parse(req.body)) })
}))
router.put('/ai/config', wrap(async (req, res) => {
  res.json({ success: true, data: await aiConfigService.update(aiConfigSchema.parse(req.body)) })
}))
router.post('/ai/chat', aiLimiter, wrap(async (req, res) => {
  const input = z.object({
    message: z.string().trim().min(1).max(1000),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(10).optional()
  }).parse(req.body)
  res.json({ success: true, data: await chat({ ...input, user: req.user }) })
}))

export default router
