import { PrismaClient } from '@prisma/client'
import { demoStore } from '../src/data/demoData.js'

const prisma = new PrismaClient()
const asDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)

async function main() {
  await prisma.agentAction.deleteMany()
  await prisma.productionRecord.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.productionOrder.deleteMany()
  await prisma.equipment.deleteMany()
  await prisma.inventory.deleteMany()

  await prisma.productionOrder.createMany({
    data: demoStore.orders.map(({ id, ...item }) => ({ ...item, startDate: asDate(item.startDate), deadline: asDate(item.deadline) }))
  })
  await prisma.equipment.createMany({ data: demoStore.equipment.map(({ id, ...item }) => item) })
  await prisma.inventory.createMany({ data: demoStore.inventory.map(({ id, ...item }) => item) })

  const orderMap = new Map((await prisma.productionOrder.findMany()).map((item) => [item.orderNo, item.id]))
  const equipmentMap = new Map((await prisma.equipment.findMany()).map((item) => [item.equipmentNo, item.id]))

  await prisma.productionRecord.createMany({
    data: demoStore.records.map(({ id, orderId, ...item }) => ({
      ...item,
      orderId: orderMap.get(demoStore.orders.find((order) => order.id === orderId).orderNo),
      date: asDate(item.date)
    }))
  })
  await prisma.alert.createMany({
    data: demoStore.alerts.map(({ id, equipmentId, ...item }) => ({
      ...item,
      equipmentId: equipmentMap.get(demoStore.equipment.find((equipment) => equipment.id === equipmentId).equipmentNo),
      createdAt: new Date(item.createdAt)
    }))
  })
  console.log('SmartFactory 演示数据写入完成：20 个订单、10 台设备、20 种物料。')
}

main().catch((error) => { console.error(error); process.exit(1) }).finally(() => prisma.$disconnect())
