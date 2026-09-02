import 'dotenv/config'

const booleanValue = (value, fallback) => {
  if (value === undefined) return fallback
  return value.toLowerCase() === 'true'
}

const demoMode = booleanValue(process.env.DEMO_MODE, true)

export const config = {
  port: Number(process.env.PORT || 3000),
  demoMode,
  businessTimezone: process.env.BUSINESS_TIMEZONE || 'Asia/Shanghai',
  databaseUrl: process.env.DATABASE_URL,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map((item) => item.trim()).filter(Boolean),
  auth: {
    enabled: booleanValue(process.env.AUTH_ENABLED, true),
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'SmartFactory@2026',
    jwtSecret: process.env.JWT_SECRET || (demoMode ? 'smartfactory-demo-secret-change-before-deploy' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  ai: {
    provider: process.env.LLM_PROVIDER || ((process.env.LLM_BASE_URL || '').includes('deepseek.com') ? 'deepseek' : 'custom'),
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
}

if (config.auth.enabled && !config.auth.jwtSecret) {
  throw new Error('启用鉴权时必须配置 JWT_SECRET')
}
