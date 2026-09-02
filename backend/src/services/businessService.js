import { config } from '../config.js'
import { prisma } from '../db/prisma.js'
import { demoStore, nextId } from '../data/demoData.js'
import { addBusinessDays, businessDateKey, businessDayRange, databaseDate } from '../utils/date.js'
import { AppError, assertFound } from '../utils/errors.js'

const clean = (value) => String(value || '').trim().toLowerCase()
const normalizeDate = (value) => businessDateKey(value)

const demoAlertWithEquipment = (alert) => ({
  ...alert,
  equipment: demoStore.equipment.find((item) => item.id === alert.equipmentId) || null
})

const validateOrder = (candidate) => {
  if (candidate.completedQuantity > candidate.quantity) throw new AppError('已完成数量不能超过计划数量')
  if (candidate.startDate && candidate.deadline && normalizeDate(candidate.deadline) < normalizeDate(candidate.startDate)) {
    throw new AppError('交付日期不能早于开始日期')
  }
  if (candidate.status === 'COMPLETED' && candidate.completedQuantity !== candidate.quantity) {
    throw new AppError('订单标记为已完成时，完成数量必须等于计划数量')
  }
  return candidate
}

export const businessService = {
  async listOrders({ search = '', status = '' } = {}) {
    if (!config.demoMode) {
      return prisma.productionOrder.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(search ? { OR: [{ orderNo: { contains: search } }, { productName: { contains: search } }] } : {})
        },
        orderBy: { id: 'desc' }
      })
    }
    const keyword = clean(search)
    return demoStore.orders
      .filter((item) => !status || item.status === status)
      .filter((item) => !keyword || clean(item.orderNo).includes(keyword) || clean(item.productName).includes(keyword))
      .toReversed()
  },

  async getOrderByNo(orderNo) {
    if (!config.demoMode) return prisma.productionOrder.findUnique({ where: { orderNo } })
    return demoStore.orders.find((item) => item.orderNo.toLowerCase() === orderNo.toLowerCase()) || null
  },

  async listDelayedOrders() {
    const today = businessDateKey()
    const orders = await this.listOrders()
    return orders.filter((item) => item.status !== 'COMPLETED' && normalizeDate(item.deadline) < today).map((item) => ({
      ...item,
      daysOverdue: Math.floor((databaseDate(today) - databaseDate(item.deadline)) / 86400000),
      completionRate: Number((item.completedQuantity / item.quantity * 100).toFixed(1))
    })).sort((a, b) => b.daysOverdue - a.daysOverdue)
  },

  async createOrder(data) {
    const candidate = validateOrder({ completedQuantity: 0, status: 'PENDING', ...data })
    if (!config.demoMode) {
      return prisma.productionOrder.create({
        data: { ...candidate, startDate: databaseDate(candidate.startDate), deadline: databaseDate(candidate.deadline) }
      })
    }
    if (demoStore.orders.some((item) => item.orderNo.toLowerCase() === candidate.orderNo.toLowerCase())) {
      throw new AppError('订单编号已存在', 409)
    }
    const item = { id: nextId(demoStore.orders), ...candidate, startDate: normalizeDate(candidate.startDate), deadline: normalizeDate(candidate.deadline) }
    demoStore.orders.push(item)
    return item
  },

  async updateOrder(id, data) {
    if (!config.demoMode) {
      const current = assertFound(await prisma.productionOrder.findUnique({ where: { id } }), '订单不存在')
      const candidate = validateOrder({ ...current, ...data })
      return prisma.productionOrder.update({
        where: { id },
        data: {
          ...data,
          ...(data.startDate ? { startDate: databaseDate(data.startDate) } : {}),
          ...(data.deadline ? { deadline: databaseDate(data.deadline) } : {})
        }
      })
    }
    const index = demoStore.orders.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.orders[index] : null, '订单不存在')
    if (data.orderNo && demoStore.orders.some((item) => item.id !== id && item.orderNo.toLowerCase() === data.orderNo.toLowerCase())) {
      throw new AppError('订单编号已存在', 409)
    }
    const candidate = validateOrder({ ...demoStore.orders[index], ...data, id })
    demoStore.orders[index] = {
      ...candidate,
      ...(data.startDate ? { startDate: normalizeDate(data.startDate) } : {}),
      ...(data.deadline ? { deadline: normalizeDate(data.deadline) } : {})
    }
    return demoStore.orders[index]
  },

  async deleteOrder(id) {
    if (!config.demoMode) return prisma.productionOrder.delete({ where: { id } })
    const index = demoStore.orders.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.orders[index] : null, '订单不存在')
    for (let i = demoStore.records.length - 1; i >= 0; i -= 1) {
      if (demoStore.records[i].orderId === id) demoStore.records.splice(i, 1)
    }
    return demoStore.orders.splice(index, 1)[0]
  },

  async listEquipment({ search = '', status = '' } = {}) {
    if (!config.demoMode) {
      return prisma.equipment.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(search ? { OR: [{ equipmentNo: { contains: search } }, { name: { contains: search } }] } : {})
        }, orderBy: { id: 'asc' }
      })
    }
    const keyword = clean(search)
    return demoStore.equipment
      .filter((item) => !status || item.status === status)
      .filter((item) => !keyword || clean(item.equipmentNo).includes(keyword) || clean(item.name).includes(keyword))
  },

  async getEquipmentByNo(equipmentNo) {
    if (!config.demoMode) return prisma.equipment.findUnique({ where: { equipmentNo } })
    return demoStore.equipment.find((item) => item.equipmentNo.toLowerCase() === equipmentNo.toLowerCase()) || null
  },

  async updateEquipmentStatusByNo(equipmentNo, status) {
    const current = assertFound(await this.getEquipmentByNo(equipmentNo), `未找到设备 ${equipmentNo}`)
    const updated = await this.updateEquipment(current.id, { status })
    return {
      equipmentNo: updated.equipmentNo,
      name: updated.name,
      productionLine: updated.productionLine,
      previousStatus: current.status,
      currentStatus: updated.status,
      updatedAt: new Date().toISOString()
    }
  },

  async createEquipment(data) {
    if (!config.demoMode) return prisma.equipment.create({ data })
    if (demoStore.equipment.some((item) => item.equipmentNo.toLowerCase() === data.equipmentNo.toLowerCase())) throw new AppError('设备编号已存在', 409)
    const item = { id: nextId(demoStore.equipment), runtimeHours: 0, utilizationRate: 0, status: 'STOPPED', ...data }
    demoStore.equipment.push(item)
    return item
  },

  async updateEquipment(id, data) {
    if (!config.demoMode) return prisma.equipment.update({ where: { id }, data })
    const index = demoStore.equipment.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.equipment[index] : null, '设备不存在')
    if (data.equipmentNo && demoStore.equipment.some((item) => item.id !== id && item.equipmentNo.toLowerCase() === data.equipmentNo.toLowerCase())) throw new AppError('设备编号已存在', 409)
    demoStore.equipment[index] = { ...demoStore.equipment[index], ...data, id }
    return demoStore.equipment[index]
  },

  async deleteEquipment(id) {
    if (!config.demoMode) return prisma.equipment.delete({ where: { id } })
    const index = demoStore.equipment.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.equipment[index] : null, '设备不存在')
    demoStore.alerts.forEach((item) => { if (item.equipmentId === id) item.equipmentId = null })
    return demoStore.equipment.splice(index, 1)[0]
  },

  async listInventory({ search = '', lowStock = false } = {}) {
    if (!config.demoMode) {
      const items = await prisma.inventory.findMany({
        where: search ? { OR: [{ materialNo: { contains: search } }, { materialName: { contains: search } }] } : {},
        orderBy: { id: 'asc' }
      })
      return lowStock ? items.filter((item) => item.quantity <= item.safetyStock) : items
    }
    const keyword = clean(search)
    return demoStore.inventory
      .filter((item) => !lowStock || item.quantity <= item.safetyStock)
      .filter((item) => !keyword || clean(item.materialNo).includes(keyword) || clean(item.materialName).includes(keyword))
  },

  async createInventory(data) {
    if (!config.demoMode) return prisma.inventory.create({ data })
    if (demoStore.inventory.some((item) => item.materialNo.toLowerCase() === data.materialNo.toLowerCase())) throw new AppError('物料编号已存在', 409)
    const item = { id: nextId(demoStore.inventory), ...data }
    demoStore.inventory.push(item)
    return item
  },

  async updateInventory(id, data) {
    if (!config.demoMode) return prisma.inventory.update({ where: { id }, data })
    const index = demoStore.inventory.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.inventory[index] : null, '物料不存在')
    if (data.materialNo && demoStore.inventory.some((item) => item.id !== id && item.materialNo.toLowerCase() === data.materialNo.toLowerCase())) throw new AppError('物料编号已存在', 409)
    demoStore.inventory[index] = { ...demoStore.inventory[index], ...data, id }
    return demoStore.inventory[index]
  },

  async deleteInventory(id) {
    if (!config.demoMode) return prisma.inventory.delete({ where: { id } })
    const index = demoStore.inventory.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.inventory[index] : null, '物料不存在')
    return demoStore.inventory.splice(index, 1)[0]
  },

  async listAlerts({ status = '', level = '', today = false } = {}) {
    if (!config.demoMode) {
      const range = businessDayRange()
      return prisma.alert.findMany({
        where: {
          ...(status ? { status } : {}), ...(level ? { level } : {}),
          ...(today ? { createdAt: { gte: range.start, lt: range.end } } : {})
        }, include: { equipment: true }, orderBy: { createdAt: 'desc' }
      })
    }
    return demoStore.alerts
      .filter((item) => !status || item.status === status)
      .filter((item) => !level || item.level === level)
      .filter((item) => !today || businessDateKey(item.createdAt) === businessDateKey())
      .map(demoAlertWithEquipment).toReversed()
  },

  async createAlert(data) {
    if (data.equipmentId) assertFound((await this.listEquipment()).find((item) => item.id === data.equipmentId), '关联设备不存在')
    if (!config.demoMode) return prisma.alert.create({ data, include: { equipment: true } })
    const item = { id: nextId(demoStore.alerts), status: 'OPEN', createdAt: new Date().toISOString(), ...data }
    demoStore.alerts.push(item)
    return demoAlertWithEquipment(item)
  },

  async updateAlert(id, data) {
    if (!config.demoMode) return prisma.alert.update({ where: { id }, data, include: { equipment: true } })
    const index = demoStore.alerts.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.alerts[index] : null, '异常记录不存在')
    demoStore.alerts[index] = { ...demoStore.alerts[index], ...data, id }
    return demoAlertWithEquipment(demoStore.alerts[index])
  },

  async deleteAlert(id) {
    if (!config.demoMode) return prisma.alert.delete({ where: { id } })
    const index = demoStore.alerts.findIndex((item) => item.id === id)
    assertFound(index >= 0 ? demoStore.alerts[index] : null, '异常记录不存在')
    return demoStore.alerts.splice(index, 1)[0]
  },

  async listProductionRecords({ orderId, date } = {}) {
    if (!config.demoMode) {
      return prisma.productionRecord.findMany({
        where: { ...(orderId ? { orderId } : {}), ...(date ? { date: databaseDate(date) } : {}) },
        include: { order: true }, orderBy: { date: 'desc' }
      })
    }
    return demoStore.records
      .filter((item) => !orderId || item.orderId === orderId)
      .filter((item) => !date || normalizeDate(item.date) === normalizeDate(date))
      .map((item) => ({ ...item, order: demoStore.orders.find((order) => order.id === item.orderId) || null }))
      .toReversed()
  },

  async recordProduction(data) {
    const date = normalizeDate(data.date)
    if (!config.demoMode) {
      return prisma.$transaction(async (tx) => {
        const order = assertFound(await tx.productionOrder.findUnique({ where: { id: data.orderId } }), '订单不存在')
        const dbDate = databaseDate(date)
        const existing = await tx.productionRecord.findUnique({ where: { orderId_date: { orderId: data.orderId, date: dbDate } } })
        const delta = data.actualQuantity - (existing?.actualQuantity || 0)
        const completedQuantity = order.completedQuantity + delta
        if (completedQuantity > order.quantity) throw new AppError(`报工后完成数量将超过订单计划，当前最多还可报工 ${order.quantity - order.completedQuantity + (existing?.actualQuantity || 0)} 件`)
        if (completedQuantity < 0) throw new AppError('报工数量不能使订单完成数量小于 0')
        const status = completedQuantity === order.quantity ? 'COMPLETED' : completedQuantity > 0 ? 'IN_PROGRESS' : order.status
        const record = await tx.productionRecord.upsert({
          where: { orderId_date: { orderId: data.orderId, date: dbDate } },
          create: { ...data, date: dbDate }, update: { plannedQuantity: data.plannedQuantity, actualQuantity: data.actualQuantity }
        })
        const updatedOrder = await tx.productionOrder.update({ where: { id: data.orderId }, data: { completedQuantity, status } })
        return { record, order: updatedOrder }
      })
    }
    const order = assertFound(demoStore.orders.find((item) => item.id === data.orderId), '订单不存在')
    const index = demoStore.records.findIndex((item) => item.orderId === data.orderId && normalizeDate(item.date) === date)
    const previousActual = index >= 0 ? demoStore.records[index].actualQuantity : 0
    const delta = data.actualQuantity - previousActual
    const completedQuantity = order.completedQuantity + delta
    if (completedQuantity > order.quantity) throw new AppError(`报工后完成数量将超过订单计划，当前最多还可报工 ${order.quantity - order.completedQuantity + previousActual} 件`)
    if (completedQuantity < 0) throw new AppError('报工数量不能使订单完成数量小于 0')
    order.completedQuantity = completedQuantity
    order.status = completedQuantity === order.quantity ? 'COMPLETED' : completedQuantity > 0 ? 'IN_PROGRESS' : order.status
    const record = { id: index >= 0 ? demoStore.records[index].id : nextId(demoStore.records), ...data, date }
    if (index >= 0) demoStore.records[index] = record
    else demoStore.records.push(record)
    return { record, order }
  },

  async logAgentAction(data) {
    const item = {
      toolName: data.toolName,
      actionType: data.actionType,
      arguments: JSON.parse(JSON.stringify(data.arguments || {})),
      result: data.result === undefined ? null : JSON.parse(JSON.stringify(data.result)),
      status: data.status,
      username: data.username || null
    }
    if (!config.demoMode) return prisma.agentAction.create({ data: item })
    const action = { id: nextId(demoStore.agentActions), ...item, createdAt: new Date().toISOString() }
    demoStore.agentActions.push(action)
    return action
  },

  async listAgentActions() {
    if (!config.demoMode) return prisma.agentAction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return demoStore.agentActions.toReversed().slice(0, 100)
  },

  async getNotifications() {
    const [alerts, lowStock, delayedOrders] = await Promise.all([
      this.listAlerts(), this.listInventory({ lowStock: true }), this.listDelayedOrders()
    ])
    const openAlerts = alerts.filter((item) => item.status !== 'RESOLVED')
    const items = [
      ...openAlerts.slice(0, 5).map((item) => ({
        id: `alert-${item.id}`, category: 'ALERT', level: item.level,
        title: `${item.equipment?.equipmentNo || '生产现场'} · ${item.alertType}`,
        description: item.description, path: '/alerts', createdAt: item.createdAt
      })),
      ...lowStock.slice(0, 5).map((item) => ({
        id: `stock-${item.id}`, category: 'STOCK', level: item.quantity === 0 ? 'CRITICAL' : 'MEDIUM',
        title: `${item.materialName} 库存预警`,
        description: `当前 ${item.quantity} ${item.unit}，安全库存 ${item.safetyStock} ${item.unit}`,
        path: '/inventory', createdAt: null
      })),
      ...delayedOrders.slice(0, 5).map((item) => ({
        id: `order-${item.id}`, category: 'ORDER', level: item.daysOverdue >= 3 ? 'HIGH' : 'MEDIUM',
        title: `${item.orderNo} 已延期 ${item.daysOverdue} 天`,
        description: `${item.productName} · 完成率 ${item.completionRate}%`,
        path: '/orders', createdAt: null
      }))
    ]
    return {
      total: openAlerts.length + lowStock.length + delayedOrders.length,
      summary: { alerts: openAlerts.length, lowStock: lowStock.length, delayedOrders: delayedOrders.length },
      items: items.slice(0, 12)
    }
  },

  async getProductionSummary() {
    const date = businessDateKey()
    const records = await this.listProductionRecords({ date })
    const plannedQuantity = records.reduce((sum, item) => sum + item.plannedQuantity, 0)
    const actualQuantity = records.reduce((sum, item) => sum + item.actualQuantity, 0)
    const completionRate = plannedQuantity ? Number((actualQuantity / plannedQuantity * 100).toFixed(1)) : 0
    return { date, plannedQuantity, actualQuantity, completionRate }
  },

  async getDashboard() {
    const [orders, equipment, inventory, alerts, production] = await Promise.all([
      this.listOrders(), this.listEquipment(), this.listInventory(), this.listAlerts({ today: true }), this.getProductionSummary()
    ])
    const since = addBusinessDays(businessDateKey(), -6)
    let records
    if (!config.demoMode) {
      records = await prisma.productionRecord.findMany({ where: { date: { gte: databaseDate(since) } }, orderBy: { date: 'asc' } })
    } else {
      records = demoStore.records.filter((item) => normalizeDate(item.date) >= since)
    }
    const trendMap = new Map(Array.from({ length: 7 }, (_, index) => {
      const date = addBusinessDays(since, index)
      return [date, { date, planned: 0, actual: 0 }]
    }))
    for (const record of records) {
      const key = normalizeDate(record.date)
      const current = trendMap.get(key)
      if (!current) continue
      current.planned += record.plannedQuantity
      current.actual += record.actualQuantity
    }
    const runningCount = equipment.filter((item) => item.status === 'RUNNING').length
    return {
      stats: {
        todayOutput: production.actualQuantity,
        activeOrders: orders.filter((item) => item.status === 'IN_PROGRESS').length,
        equipmentRate: equipment.length ? Number((runningCount / equipment.length * 100).toFixed(1)) : 0,
        todayAlerts: alerts.length
      },
      production, trend: [...trendMap.values()], equipment,
      lowStock: inventory.filter((item) => item.quantity <= item.safetyStock),
      recentAlerts: alerts.slice(0, 5)
    }
  }
}
