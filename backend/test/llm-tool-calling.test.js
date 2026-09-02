import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { config } from '../src/config.js'
import { chat } from '../src/agent/agentService.js'
import { businessService } from '../src/services/businessService.js'

test('OpenAI 兼容接口完成模型选工具、工具回传和最终回答闭环', async () => {
  const receivedBodies = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      const payload = JSON.parse(body)
      receivedBodies.push(payload)
      const hasToolResult = payload.messages.some((message) => message.role === 'tool')
      const message = hasToolResult
        ? { role: 'assistant', content: '已根据 MES 实时数据完成延期订单分析。' }
        : {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_delayed_orders', type: 'function', function: { name: 'getDelayedOrders', arguments: '{}' } }]
          }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message }] }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const original = { ...config.ai }
  config.ai.apiKey = 'integration-test-key'
  config.ai.baseUrl = `http://127.0.0.1:${address.port}/v1`
  config.ai.model = 'mock-tool-model'
  try {
    const result = await chat({ message: '今天有哪些订单延期？', user: { username: 'test-admin' } })
    assert.equal(result.mode, 'llm')
    assert.equal(result.toolCalls[0].name, 'getDelayedOrders')
    assert.equal(result.reply, '已根据 MES 实时数据完成延期订单分析。')
    assert.equal(receivedBodies.length, 2)
    assert.ok(receivedBodies[0].tools.some((tool) => tool.function.name === 'updateEquipmentStatus'))
    assert.ok(receivedBodies[1].messages.some((message) => message.role === 'tool' && message.tool_call_id === 'call_delayed_orders'))
  } finally {
    Object.assign(config.ai, original)
    await new Promise((resolve) => server.close(resolve))
  }
})

test('模型在用户未明确授权时误调用写 Tool 会被服务端拒绝', async () => {
  const server = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      const message = {
        role: 'assistant', content: null,
        tool_calls: [{ id: 'unsafe_write', type: 'function', function: { name: 'updateEquipmentStatus', arguments: '{"equipmentNo":"EQ-003","status":"MAINTENANCE"}' } }]
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message }] }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const original = { ...config.ai }
  config.ai.apiKey = 'integration-test-key'
  config.ai.baseUrl = `http://127.0.0.1:${address.port}/v1`
  config.ai.model = 'unsafe-mock-model'
  const before = await businessService.getEquipmentByNo('EQ-003')
  try {
    await assert.rejects(
      chat({ message: 'EQ-003 最近运行得怎么样？', user: { username: 'test-admin' } }),
      /用户未明确授权/
    )
    const after = await businessService.getEquipmentByNo('EQ-003')
    assert.equal(after.status, before.status)
  } finally {
    Object.assign(config.ai, original)
    await new Promise((resolve) => server.close(resolve))
  }
})
