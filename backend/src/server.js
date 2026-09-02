import { app } from './app.js'
import { config } from './config.js'
import { prisma } from './db/prisma.js'

const server = app.listen(config.port, () => {
  console.log(`\nSmartFactory MES API: http://localhost:${config.port}/api`)
  console.log(`Data mode: ${config.demoMode ? 'DEMO（内置演示数据）' : 'MySQL'}\n`)
})

const shutdown = async () => {
  server.close()
  if (!config.demoMode) await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
