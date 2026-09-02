import { config } from '../config.js'
import { executeTool, toolCatalog, toolDefinitions } from './tools.js'

const systemPrompt = `你是 SmartFactory 工业 AI Agent。你通过工具连接 MES 实时数据和工业知识库，不能编造订单、设备、库存或操作结果。

路由规则：
1. 订单进度、延期订单、今日生产、设备当前状态、告警、库存属于实时业务数据，必须调用 MES 查询工具。
2. 故障处理步骤、设备维护方法、安全规范属于知识问题，必须调用 searchIndustrialKnowledge，并在答案中以“【来源：文档名 / 章节】”标注依据。
3. updateEquipmentStatus 是写操作。只有用户明确要求“把/将某设备设置或标记为某状态”时才能调用；分析、建议或模糊表达不能触发写操作。
4. 工具返回空结果时如实说明，不得补造数据。多个工具可以组合调用。

回答使用简洁、专业的中文，先给结论，再列关键数据或步骤。状态含义：RUNNING运行中、STOPPED已停机、FAULT故障、MAINTENANCE维修中；PENDING待生产、IN_PROGRESS生产中、COMPLETED已完成、PAUSED已暂停。`

const toolTrace = (name, args, result) => ({
  name,
  label: toolCatalog[name]?.label || name,
  actionType: toolCatalog[name]?.actionType || 'QUERY',
  arguments: args,
  result
})

function equipmentNumber(message) {
  return message.match(/EQ\s*-?\s*\d+/i)?.[0]?.replace(/\s/g, '').toUpperCase()
}

function mutationAuthorized(message, args) {
  const requestedEquipment = equipmentNumber(message)
  const targetEquipment = String(args.equipmentNo || '').replace(/\s/g, '').toUpperCase()
  const explicitVerb = /(设置|设为|标记|改成|切换|更新)/.test(message)
  const requestedStatus = /维修|维护/.test(message) ? 'MAINTENANCE'
    : /停机|停止/.test(message) ? 'STOPPED'
      : /故障/.test(message) ? 'FAULT'
        : /运行|启动|正常/.test(message) ? 'RUNNING' : null
  return Boolean(explicitVerb && requestedEquipment && requestedEquipment === targetEquipment && requestedStatus === args.status)
}

function localIntent(message) {
  const equipmentNo = equipmentNumber(message)
  const writeRequest = /(设置|设为|标记|改成|切换|更新)/.test(message) && equipmentNo
  if (writeRequest) {
    const status = /维修|维护/.test(message) ? 'MAINTENANCE'
      : /停机|停止/.test(message) ? 'STOPPED'
        : /故障/.test(message) ? 'FAULT'
          : /运行|启动|正常/.test(message) ? 'RUNNING' : null
    if (status) return { name: 'updateEquipmentStatus', args: { equipmentNo, status, reason: message } }
  }

  if (/(怎么|如何|处理步骤|维修方法|操作规范|安全规范|手册|注意事项|过热|上锁挂牌|loto)/i.test(message)) {
    return { name: 'searchIndustrialKnowledge', args: { query: message, limit: 3 } }
  }
  if (/(延期|逾期|超期)/.test(message)) return { name: 'getDelayedOrders', args: {} }
  const orderNo = message.match(/ORD\s*-?\s*\d+/i)?.[0]?.replace(/\s|-/g, '').toUpperCase()
  if (orderNo || /订单.*(进度|完成|情况)/.test(message)) return { name: 'getOrderProgress', args: { orderNo: orderNo || 'ORD2026001' } }
  if (/(缺料|低库存|库存不足|快没|预警物料)/.test(message)) return { name: 'getLowStockMaterials', args: {} }
  if (/(异常|告警|故障)/.test(message)) return { name: 'getEquipmentAlerts', args: { today: /今天|今日/.test(message), openOnly: !/全部|历史/.test(message) } }
  if (/(设备|运行|停机|维护)/.test(message)) return { name: 'getEquipmentStatus', args: { ...(equipmentNo ? { equipmentNo } : {}) } }
  if (/(生产|产量|完成率|达成率)/.test(message)) return { name: 'getProductionSummary', args: {} }
  return null
}

function formatLocalReply(name, result) {
  if (name === 'getOrderProgress') {
    if (!result.found) return result.message
    return `订单 ${result.orderNo}（${result.productName}）当前已完成 ${result.completedQuantity} / ${result.totalQuantity} 件，完成率 ${result.completionRate}%，状态为 ${result.status}。`
  }
  if (name === 'getDelayedOrders') {
    if (!result.length) return '当前没有延期未完成的生产订单。'
    return `当前共有 ${result.length} 个延期订单：\n\n${result.map((item) => `${item.orderNo} ${item.productName}：延期 ${item.daysOverdue} 天，完成率 ${item.completionRate}%`).join('\n')}`
  }
  if (name === 'getProductionSummary') return `今日计划生产 ${result.plannedQuantity} 件，当前已完成 ${result.actualQuantity} 件，生产完成率为 ${result.completionRate}%。`
  if (name === 'getEquipmentStatus') {
    if (!result.length) return '未找到符合条件的设备。'
    const faults = result.filter((item) => item.status === 'FAULT').length
    const running = result.filter((item) => item.status === 'RUNNING').length
    return `共查询到 ${result.length} 台设备，其中运行 ${running} 台、故障 ${faults} 台。\n\n${result.map((item) => `${item.equipmentNo} ${item.name}：${item.status}`).join('\n')}`
  }
  if (name === 'getEquipmentAlerts') {
    if (!result.length) return '当前没有符合条件的设备异常。'
    return `共发现 ${result.length} 条符合条件的异常：\n\n${result.map((item) => `${item.equipmentNo} ${item.equipmentName}：${item.type}（${item.level}）— ${item.description}`).join('\n')}`
  }
  if (name === 'getLowStockMaterials') {
    if (!result.length) return '当前没有低于安全库存的物料。'
    return `当前有 ${result.length} 种物料需要补货：\n\n${result.map((item) => `${item.materialNo} ${item.materialName}：${item.quantity} ${item.unit}（安全库存 ${item.safetyStock}）`).join('\n')}`
  }
  if (name === 'updateEquipmentStatus') {
    return `设备 ${result.equipmentNo}（${result.name}）状态已从 ${result.previousStatus} 更新为 ${result.currentStatus}。该写操作已记录到 Agent 审计日志。`
  }
  if (name === 'searchIndustrialKnowledge') {
    if (!result.matches.length) return '工业知识库中没有检索到足够相关的处理依据，建议联系设备工程师进一步确认。'
    const steps = result.matches.map((item, index) => `${index + 1}. ${item.content}`).join('\n')
    const sources = result.matches.map((item) => `【来源：${item.title} / ${item.section}】`).filter((item, index, list) => list.indexOf(item) === index).join('\n')
    return `根据工业知识库，建议按以下顺序处理：\n\n${steps}\n\n${sources}`
  }
  return '工具执行完成。'
}

async function localToolChat(message, user) {
  const intent = localIntent(message)
  if (!intent) {
    return {
      reply: '我可以查询生产数据、执行明确的设备状态修改，并检索工业设备手册。你可以问：“今天有哪些订单延期？”或“主轴过热怎么处理？”',
      toolCalls: [], mode: 'local'
    }
  }
  const result = await executeTool(intent.name, intent.args, { username: user?.username, allowMutation: intent.name === 'updateEquipmentStatus' })
  return { reply: formatLocalReply(intent.name, result), toolCalls: [toolTrace(intent.name, intent.args, result)], mode: 'local' }
}

async function requestModel(messages) {
  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.apiKey}` },
    body: JSON.stringify({ model: config.ai.model, messages, tools: toolDefinitions, tool_choice: 'auto', temperature: 0.15 })
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`模型接口请求失败（${response.status}）：${body.slice(0, 300)}`)
  }
  return response.json()
}

export async function chat({ message, history = [], user }) {
  if (!config.ai.apiKey) return localToolChat(message, user)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: message }
  ]
  const executed = []
  for (let round = 0; round < 5; round += 1) {
    const data = await requestModel(messages)
    const assistant = data.choices?.[0]?.message
    if (!assistant) throw new Error('模型接口未返回有效消息')
    messages.push(assistant)
    if (!assistant.tool_calls?.length) return { reply: assistant.content || '工具执行完成。', toolCalls: executed, mode: 'llm' }
    for (const toolCall of assistant.tool_calls) {
      const name = toolCall.function.name
      let args = {}
      try { args = JSON.parse(toolCall.function.arguments || '{}') } catch { args = {} }
      const result = await executeTool(name, args, {
        username: user?.username,
        allowMutation: name === 'updateEquipmentStatus' && mutationAuthorized(message, args)
      })
      executed.push(toolTrace(name, args, result))
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
    }
  }
  throw new Error('AI 工具调用轮次过多，请换一种问法')
}
