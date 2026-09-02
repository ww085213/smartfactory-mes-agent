import { addBusinessDays, businessDateKey } from '../utils/date.js'

const dateOnly = (offset = 0) => addBusinessDays(businessDateKey(), offset)

const orderProducts = [
  '伺服电机 A', '工业机器人关节', '变频器 V8', '精密减速机', 'PLC 控制柜',
  '视觉检测模组', '智能传感器', '直线导轨', '数控主轴', '电动执行器'
]

const statusCycle = ['IN_PROGRESS', 'IN_PROGRESS', 'PENDING', 'COMPLETED', 'PAUSED']

export const demoStore = {
  orders: Array.from({ length: 20 }, (_, index) => {
    const quantity = 500 + (index % 6) * 200
    const status = statusCycle[index % statusCycle.length]
    const completedQuantity = status === 'COMPLETED'
      ? quantity
      : status === 'PENDING' ? 0 : Math.round(quantity * (0.28 + (index % 5) * 0.13))
    return {
      id: index + 1,
      orderNo: `ORD2026${String(index + 1).padStart(3, '0')}`,
      productName: orderProducts[index % orderProducts.length],
      quantity,
      completedQuantity: Math.min(completedQuantity, quantity),
      status,
      startDate: dateOnly(-8 + (index % 6)),
      deadline: dateOnly(index % 7 === 0 ? -2 - Math.floor(index / 7) : 2 + (index % 12))
    }
  }),
  equipment: [
    ['EQ-001', '数控加工中心 01', 'RUNNING', '生产线 1', 4280, 92.4],
    ['EQ-002', '伺服压装机 02', 'FAULT', '生产线 1', 3760, 68.5],
    ['EQ-003', '六轴机器人 03', 'RUNNING', '生产线 1', 5120, 88.6],
    ['EQ-004', '自动装配机 04', 'RUNNING', '生产线 2', 2980, 86.2],
    ['EQ-005', '视觉检测台 05', 'MAINTENANCE', '生产线 2', 1840, 73.8],
    ['EQ-006', '激光焊接机 06', 'RUNNING', '生产线 2', 3350, 90.1],
    ['EQ-007', '物料输送线 07', 'FAULT', '生产线 3', 6200, 61.3],
    ['EQ-008', '自动包装机 08', 'RUNNING', '生产线 3', 2710, 84.7],
    ['EQ-009', 'AGV 搬运车 09', 'STOPPED', '仓储区', 1560, 55.4],
    ['EQ-010', '环境监测站 10', 'RUNNING', '仓储区', 7050, 96.2]
  ].map(([equipmentNo, name, status, productionLine, runtimeHours, utilizationRate], index) => ({
    id: index + 1, equipmentNo, name, status, productionLine, runtimeHours, utilizationRate
  })),
  inventory: [
    ['MAT-001', '伺服电机', 12, 20, '台'], ['MAT-002', '温度传感器', 8, 15, '个'],
    ['MAT-003', '精密轴承', 120, 50, '套'], ['MAT-004', '铝合金外壳', 46, 60, '件'],
    ['MAT-005', '控制主板', 35, 30, '块'], ['MAT-006', '工业相机', 6, 10, '台'],
    ['MAT-007', '编码器', 42, 25, '个'], ['MAT-008', '减速机', 18, 12, '台'],
    ['MAT-009', '线束组件', 260, 100, '套'], ['MAT-010', '急停按钮', 75, 30, '个'],
    ['MAT-011', 'PLC 模块', 14, 18, '块'], ['MAT-012', '触摸屏', 24, 10, '台'],
    ['MAT-013', '气动接头', 360, 120, '个'], ['MAT-014', '导轨滑块', 88, 40, '套'],
    ['MAT-015', '润滑油', 55, 20, 'L'], ['MAT-016', '工业网线', 300, 100, 'm'],
    ['MAT-017', '继电器', 150, 60, '个'], ['MAT-018', '光电开关', 9, 16, '个'],
    ['MAT-019', '防护罩', 32, 15, '件'], ['MAT-020', '包装托盘', 420, 180, '个']
  ].map(([materialNo, materialName, quantity, safetyStock, unit], index) => ({
    id: index + 1, materialNo, materialName, quantity, safetyStock, unit
  })),
  alerts: [
    { id: 1, equipmentId: 2, alertType: '温度异常', description: '主轴电机温度达到 87℃，超过预警阈值', level: 'HIGH', status: 'OPEN', createdAt: `${dateOnly()}T08:25:00.000Z` },
    { id: 2, equipmentId: 7, alertType: '通信中断', description: '输送线 3 号节点传感器离线', level: 'CRITICAL', status: 'PROCESSING', createdAt: `${dateOnly()}T09:40:00.000Z` },
    { id: 3, equipmentId: 5, alertType: '定期保养', description: '视觉检测台累计运行时间达到保养周期', level: 'MEDIUM', status: 'PROCESSING', createdAt: `${dateOnly(-1)}T06:10:00.000Z` },
    { id: 4, equipmentId: 3, alertType: '节拍波动', description: '装配节拍连续 5 次超出标准值', level: 'LOW', status: 'RESOLVED', createdAt: `${dateOnly()}T03:16:00.000Z` },
    { id: 5, equipmentId: 1, alertType: '刀具寿命', description: '当前刀具剩余寿命低于 10%', level: 'MEDIUM', status: 'OPEN', createdAt: `${dateOnly(-2)}T11:20:00.000Z` },
    { id: 6, equipmentId: 8, alertType: '耗材不足', description: '包装膜余量不足，请及时补充', level: 'LOW', status: 'RESOLVED', createdAt: `${dateOnly(-3)}T05:45:00.000Z` }
  ],
  records: Array.from({ length: 7 }, (_, index) => {
    const orderIds = [index * 2 + 3, index * 2 + 4]
    return orderIds.map((orderId, pairIndex) => {
      const orderQuantity = 500 + ((orderId - 1) % 6) * 200
      return {
        id: index * 2 + pairIndex + 1,
        orderId,
        date: dateOnly(index - 6),
        plannedQuantity: Math.round(orderQuantity * 0.9),
        actualQuantity: Math.round(orderQuantity * (0.74 + (index % 3) * 0.02))
      }
    })
  }).flat(),
  agentActions: []
}

for (const record of demoStore.records) {
  const order = demoStore.orders.find((item) => item.id === record.orderId)
  if (!order) continue
  order.completedQuantity = Math.max(order.completedQuantity, record.actualQuantity)
  if (order.status === 'PENDING') order.status = 'IN_PROGRESS'
}

export const nextId = (collection) => Math.max(0, ...collection.map((item) => item.id)) + 1
