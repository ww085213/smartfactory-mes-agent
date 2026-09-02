import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { AppError } from '../utils/errors.js'

const envPath = fileURLToPath(new URL('../../.env', import.meta.url))

const maskKey = (key) => key ? `${key.slice(0, 3)}••••••••${key.slice(-4)}` : ''

function publicConfig() {
  return {
    provider: config.ai.provider,
    baseUrl: config.ai.baseUrl,
    model: config.ai.model,
    mode: config.ai.apiKey ? 'llm' : 'local',
    keyConfigured: Boolean(config.ai.apiKey),
    maskedKey: maskKey(config.ai.apiKey)
  }
}

async function persistEnv(values) {
  let source = ''
  try { source = await readFile(envPath, 'utf8') } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${String(value ?? '')}`
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    source = pattern.test(source) ? source.replace(pattern, line) : `${source.trimEnd()}\n${line}\n`
  }
  await writeFile(envPath, source.replace(/^\n/, ''), { encoding: 'utf8', mode: 0o600 })
}

function normalizeInput(input) {
  const provider = input.provider === 'deepseek' ? 'deepseek' : 'custom'
  const baseUrl = (provider === 'deepseek' ? 'https://api.deepseek.com' : input.baseUrl).replace(/\/$/, '')
  return { provider, baseUrl, model: input.model.trim() }
}

async function testConnection({ baseUrl, model, apiKey }) {
  if (!apiKey) throw new AppError('请先填写 API Key')
  const startedAt = Date.now()
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: '只回复 OK' }], max_tokens: 16, temperature: 0 })
  })
  if (!response.ok) {
    const body = await response.text()
    throw new AppError(`模型连接失败（${response.status}）：${body.slice(0, 240)}`, 502)
  }
  const data = await response.json()
  if (!data.choices?.[0]?.message) throw new AppError('模型接口返回格式不正确', 502)
  return { success: true, model: data.model || model, latencyMs: Date.now() - startedAt }
}

export const aiConfigService = {
  getPublic: publicConfig,

  async test(input) {
    const normalized = normalizeInput(input)
    return testConnection({ ...normalized, apiKey: input.apiKey || config.ai.apiKey })
  },

  async update(input, { persist = true } = {}) {
    const normalized = normalizeInput(input)
    const apiKey = input.clearApiKey ? '' : (input.apiKey || config.ai.apiKey || '')
    if (persist) {
      await persistEnv({
        LLM_PROVIDER: normalized.provider,
        LLM_API_KEY: apiKey,
        LLM_BASE_URL: normalized.baseUrl,
        LLM_MODEL: normalized.model
      })
    }
    config.ai.provider = normalized.provider
    config.ai.baseUrl = normalized.baseUrl
    config.ai.model = normalized.model
    config.ai.apiKey = apiKey
    return publicConfig()
  }
}
