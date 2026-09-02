import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../src/app.js'
import { config } from '../src/config.js'
import { businessDateKey } from '../src/utils/date.js'

// API 回归测试固定走本地 Agent，避免读取开发者 .env 后产生真实模型费用。
config.ai.apiKey = ''

let token
const authorized = () => ({ Authorization: `Bearer ${token}` })

before(async () => {
  const response = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'SmartFactory@2026' })
  assert.equal(response.status, 200)
  token = response.body.data.token
})

test('健康检查公开且返回数据模式', async () => {
  const response = await request(app).get('/api/health')
  assert.equal(response.status, 200)
  assert.equal(response.body.data.status, 'ok')
  assert.equal(response.body.data.dataMode, 'demo')
})

test('业务接口拒绝未登录请求', async () => {
  const response = await request(app).get('/api/dashboard')
  assert.equal(response.status, 401)
})

test('登录后可读取看板和分页数据', async () => {
  const dashboard = await request(app).get('/api/dashboard').set(authorized())
  assert.equal(dashboard.status, 200)
  assert.ok(dashboard.body.data.stats.todayOutput > 0)

  const orders = await request(app).get('/api/orders?page=1&pageSize=5').set(authorized())
  assert.equal(orders.status, 200)
  assert.equal(orders.body.data.items.length, 5)
  assert.equal(orders.body.data.total, 20)
})

test('通知中心聚合业务预警，模型配置接口不泄露密钥', async () => {
  const originalKey = config.ai.apiKey
  config.ai.apiKey = 'test-secret-key-12345678'
  try {
    const [notificationResponse, configResponse] = await Promise.all([
      request(app).get('/api/notifications').set(authorized()),
      request(app).get('/api/ai/config').set(authorized())
    ])
    assert.equal(notificationResponse.status, 200)
    assert.ok(notificationResponse.body.data.total > 0)
    assert.ok(notificationResponse.body.data.items.some((item) => item.path === '/alerts'))
    assert.equal(configResponse.status, 200)
    assert.equal(configResponse.body.data.keyConfigured, true)
    assert.equal('apiKey' in configResponse.body.data, false)
    assert.equal(JSON.stringify(configResponse.body).includes('test-secret-key-12345678'), false)
  } finally {
    config.ai.apiKey = originalKey
  }
})

test('订单校验拒绝完成数量超过计划数量', async () => {
  const response = await request(app).post('/api/orders').set(authorized()).send({
    orderNo: 'ORD-INVALID', productName: '校验测试', quantity: 10, completedQuantity: 20,
    status: 'IN_PROGRESS', startDate: '2026-09-02', deadline: '2026-09-10'
  })
  assert.equal(response.status, 400)
})

test('生产报工同步更新订单进度和今日产量', async () => {
  const created = await request(app).post('/api/orders').set(authorized()).send({
    orderNo: 'ORD-REPORT-TEST', productName: '报工测试产品', quantity: 300,
    completedQuantity: 0, status: 'PENDING', startDate: businessDateKey(), deadline: '2026-12-31'
  })
  assert.equal(created.status, 201)
  const beforeDashboard = await request(app).get('/api/dashboard').set(authorized())
  const report = await request(app).post('/api/production-records').set(authorized()).send({
    orderId: created.body.data.id, date: businessDateKey(), plannedQuantity: 120, actualQuantity: 100
  })
  assert.equal(report.status, 201)
  assert.equal(report.body.data.order.completedQuantity, 100)
  assert.equal(report.body.data.order.status, 'IN_PROGRESS')
  const afterDashboard = await request(app).get('/api/dashboard').set(authorized())
  assert.equal(afterDashboard.body.data.stats.todayOutput, beforeDashboard.body.data.stats.todayOutput + 100)
})

test('AI 助手调用订单进度业务工具', async () => {
  const response = await request(app).post('/api/ai/chat').set(authorized()).send({ message: 'ORD2026001 完成多少了？', history: [] })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.toolCalls[0].name, 'getOrderProgress')
})

test('Agent 查询延期订单并记录 QUERY 审计', async () => {
  const response = await request(app).post('/api/ai/chat').set(authorized()).send({ message: '今天有哪些订单延期？', history: [] })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.toolCalls[0].name, 'getDelayedOrders')
  assert.equal(response.body.data.toolCalls[0].actionType, 'QUERY')
  assert.ok(response.body.data.toolCalls[0].result.length > 0)
})

test('Agent 写工具可更新设备状态并留下 MUTATION 审计', async () => {
  const response = await request(app).post('/api/ai/chat').set(authorized()).send({ message: '把设备 EQ-009 标记为维修', history: [] })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.toolCalls[0].name, 'updateEquipmentStatus')
  assert.equal(response.body.data.toolCalls[0].actionType, 'MUTATION')
  assert.equal(response.body.data.toolCalls[0].result.currentStatus, 'MAINTENANCE')

  const actions = await request(app).get('/api/agent/actions?pageSize=20').set(authorized())
  assert.equal(actions.status, 200)
  assert.ok(actions.body.data.items.some((item) => item.toolName === 'updateEquipmentStatus' && item.actionType === 'MUTATION'))
})

test('公开演示模式从服务端拦截 CRUD、模型配置和 Agent 写操作', async () => {
  const originalPublicDemo = config.publicDemo
  config.publicDemo = true
  try {
    const before = await request(app).get('/api/equipment?search=EQ-008').set(authorized())
    const equipment = before.body.data.items[0]
    const [crudResponse, configResponse, agentResponse, statusResponse] = await Promise.all([
      request(app).put(`/api/equipment/${equipment.id}`).set(authorized()).send({ status: 'MAINTENANCE' }),
      request(app).put('/api/ai/config').set(authorized()).send({ provider: 'deepseek', model: 'deepseek-v4-pro' }),
      request(app).post('/api/ai/chat').set(authorized()).send({ message: '把设备 EQ-008 标记为维修' }),
      request(app).get('/api/ai/status').set(authorized())
    ])
    assert.equal(crudResponse.status, 403)
    assert.equal(configResponse.status, 403)
    assert.equal(agentResponse.status, 403)
    assert.equal(statusResponse.body.data.publicDemo, true)
    assert.equal(statusResponse.body.data.configurable, false)
    const after = await request(app).get('/api/equipment?search=EQ-008').set(authorized())
    assert.equal(after.body.data.items[0].status, equipment.status)
  } finally {
    config.publicDemo = originalPublicDemo
  }
})

test('工业 RAG 返回相关手册片段和来源', async () => {
  const response = await request(app).post('/api/ai/chat').set(authorized()).send({ message: 'CNC 主轴过热应该怎么处理？', history: [] })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.toolCalls[0].name, 'searchIndustrialKnowledge')
  assert.equal(response.body.data.toolCalls[0].actionType, 'RAG')
  assert.equal(response.body.data.toolCalls[0].result.matches[0].section, '主轴过热处理')
  assert.match(response.body.data.reply, /来源：CNC 设备操作与维护手册/)
})

test('业务日期按上海时区计算', () => {
  assert.equal(businessDateKey('2026-09-01T17:30:00.000Z'), '2026-09-02')
})

test('CORS 不向非白名单来源授权', async () => {
  const response = await request(app).options('/api/dashboard').set('Origin', 'https://untrusted.example').set('Access-Control-Request-Method', 'GET')
  assert.equal(response.headers['access-control-allow-origin'], undefined)
})
