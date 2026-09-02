import { businessService } from '../services/businessService.js'
import { knowledgeService } from '../rag/knowledgeService.js'
import { AppError } from '../utils/errors.js'
import { config } from '../config.js'

export const toolCatalog = {
  getOrderProgress: { label: '查询订单进度', actionType: 'QUERY' },
  getDelayedOrders: { label: '查询延期订单', actionType: 'QUERY' },
  getProductionSummary: { label: '查询今日生产', actionType: 'QUERY' },
  getEquipmentStatus: { label: '查询设备状态', actionType: 'QUERY' },
  getEquipmentAlerts: { label: '查询设备异常', actionType: 'QUERY' },
  getLowStockMaterials: { label: '查询低库存物料', actionType: 'QUERY' },
  updateEquipmentStatus: { label: '更新设备状态', actionType: 'MUTATION' },
  searchIndustrialKnowledge: { label: '检索工业知识库', actionType: 'RAG' }
}

export const toolDefinitions = [
  {
    type: 'function', function: {
      name: 'getOrderProgress', description: '根据生产订单号查询订单总数量、已完成数量、状态和完成率',
      parameters: { type: 'object', properties: { orderNo: { type: 'string', description: '订单号，例如 ORD2026001' } }, required: ['orderNo'], additionalProperties: false }
    }
  },
  {
    type: 'function', function: {
      name: 'getDelayedOrders', description: '查询截止今天仍未完成的延期生产订单，并返回延期天数和完成率',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function', function: {
      name: 'getProductionSummary', description: '查询今天的计划产量、实际产量和完成率',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function', function: {
      name: 'getEquipmentStatus', description: '查询设备运行状态，可按设备编号或状态筛选',
      parameters: {
        type: 'object', properties: {
          equipmentNo: { type: 'string', description: '设备编号，例如 EQ-002' },
          status: { type: 'string', enum: ['RUNNING', 'STOPPED', 'FAULT', 'MAINTENANCE'] }
        }, additionalProperties: false
      }
    }
  },
  {
    type: 'function', function: {
      name: 'getEquipmentAlerts', description: '查询设备异常和告警，可查询今天、指定级别或只看未解决异常',
      parameters: {
        type: 'object', properties: {
          today: { type: 'boolean' }, level: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }, openOnly: { type: 'boolean' }
        }, additionalProperties: false
      }
    }
  },
  {
    type: 'function', function: {
      name: 'getLowStockMaterials', description: '查询库存数量小于或等于安全库存的物料',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function', function: {
      name: 'updateEquipmentStatus',
      description: '根据用户明确指令更新 MES 中的设备状态。这是写操作，只能在用户直接要求修改某台设备状态时调用，不能根据分析结果自行执行。',
      parameters: {
        type: 'object', properties: {
          equipmentNo: { type: 'string', description: '设备编号，例如 EQ-002' },
          status: { type: 'string', enum: ['RUNNING', 'STOPPED', 'FAULT', 'MAINTENANCE'] },
          reason: { type: 'string', description: '用户给出的修改原因或请求摘要' }
        }, required: ['equipmentNo', 'status'], additionalProperties: false
      }
    }
  },
  {
    type: 'function', function: {
      name: 'searchIndustrialKnowledge',
      description: '从 CNC 设备手册、工业故障处理手册和安全生产规范中检索处理步骤。用于“怎么处理、如何维修、安全规范”等知识问题，不用于查询设备实时状态。',
      parameters: {
        type: 'object', properties: {
          query: { type: 'string', description: '需要检索的完整工业知识问题' },
          limit: { type: 'integer', minimum: 1, maximum: 5, description: '返回知识片段数量，默认 3' }
        }, required: ['query'], additionalProperties: false
      }
    }
  }
]

async function executeRawTool(name, args) {
  switch (name) {
    case 'getOrderProgress': {
      const order = await businessService.getOrderByNo(args.orderNo)
      if (!order) return { found: false, message: `未找到订单 ${args.orderNo}` }
      return {
        found: true, orderNo: order.orderNo, productName: order.productName,
        totalQuantity: order.quantity, completedQuantity: order.completedQuantity,
        completionRate: Number((order.completedQuantity / order.quantity * 100).toFixed(1)),
        status: order.status, deadline: order.deadline
      }
    }
    case 'getDelayedOrders':
      return businessService.listDelayedOrders()
    case 'getProductionSummary':
      return businessService.getProductionSummary()
    case 'getEquipmentStatus': {
      const items = await businessService.listEquipment({ status: args.status || '' })
      return args.equipmentNo ? items.filter((item) => item.equipmentNo.toLowerCase() === args.equipmentNo.toLowerCase()) : items
    }
    case 'getEquipmentAlerts': {
      let items = await businessService.listAlerts({ today: Boolean(args.today), level: args.level || '' })
      if (args.openOnly) items = items.filter((item) => item.status !== 'RESOLVED')
      return items.map((item) => ({
        equipmentNo: item.equipment?.equipmentNo || '未知设备', equipmentName: item.equipment?.name || '未知设备',
        type: item.alertType, description: item.description, level: item.level, status: item.status, createdAt: item.createdAt
      }))
    }
    case 'getLowStockMaterials':
      return businessService.listInventory({ lowStock: true })
    case 'updateEquipmentStatus': {
      const allowed = ['RUNNING', 'STOPPED', 'FAULT', 'MAINTENANCE']
      if (!args.equipmentNo || !allowed.includes(args.status)) throw new AppError('设备编号或目标状态不正确')
      return businessService.updateEquipmentStatusByNo(args.equipmentNo, args.status)
    }
    case 'searchIndustrialKnowledge': {
      if (!args.query?.trim()) throw new AppError('工业知识检索问题不能为空')
      const matches = knowledgeService.search(args.query, args.limit || 3)
      return { query: args.query, matches, sources: [...new Set(matches.map((item) => item.source))] }
    }
    default:
      throw new AppError(`未知工具：${name}`)
  }
}

export async function executeTool(name, args = {}, context = {}) {
  const meta = toolCatalog[name]
  if (!meta) throw new AppError(`未知工具：${name}`)
  try {
    if (meta.actionType === 'MUTATION' && config.publicDemo) {
      throw new AppError('公开演示环境为只读模式，业务写操作已禁用', 403)
    }
    if (meta.actionType === 'MUTATION' && context.allowMutation !== true) {
      throw new AppError('写操作已拒绝：用户未明确授权修改设备状态', 403)
    }
    const result = await executeRawTool(name, args)
    await businessService.logAgentAction({ toolName: name, actionType: meta.actionType, arguments: args, result, status: 'SUCCESS', username: context.username })
    return result
  } catch (error) {
    try {
      await businessService.logAgentAction({ toolName: name, actionType: meta.actionType, arguments: args, result: { message: error.message }, status: 'FAILED', username: context.username })
    } catch (auditError) {
      console.error('Agent 审计日志写入失败', auditError)
    }
    throw error
  }
}
