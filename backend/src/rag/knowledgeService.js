import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const knowledgeDir = path.resolve(currentDir, '../../knowledge')
let cachedIndex

const synonymMap = new Map([
  ['过热', '温度 冷却 润滑 主轴'],
  ['离线', '通信 传感器 网络 掉线'],
  ['维修', '检修 维护 停机 挂牌'],
  ['安全', '急停 防护 上锁 挂牌 LOTO'],
  ['振动', '异响 轴承 刀具 动平衡'],
  ['复机', '恢复 试运行 联锁 验证']
])

function tokenize(text) {
  const normalized = String(text).toLowerCase().replace(/[^\p{Script=Han}a-z0-9]+/gu, ' ')
  const english = normalized.match(/[a-z0-9]+/g) || []
  const chineseRuns = normalized.match(/[\p{Script=Han}]+/gu) || []
  const chinese = chineseRuns.flatMap((run) => {
    if (run.length === 1) return [run]
    return Array.from({ length: run.length - 1 }, (_, index) => run.slice(index, index + 2))
  })
  return [...english, ...chinese]
}

function expandQuery(query) {
  let expanded = query
  for (const [keyword, addition] of synonymMap) {
    if (query.includes(keyword)) expanded += ` ${addition}`
  }
  return expanded
}

function parseDocument(fileName) {
  const raw = fs.readFileSync(path.join(knowledgeDir, fileName), 'utf8')
  const lines = raw.split(/\r?\n/)
  const title = lines.find((line) => line.startsWith('# '))?.slice(2).trim() || fileName
  const chunks = []
  let section = title
  let buffer = []
  const flush = () => {
    const content = buffer.join('\n').trim()
    if (content.length >= 20) chunks.push({ source: fileName, title, section, content })
    buffer = []
  }
  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush()
      section = line.slice(3).trim()
    } else if (!line.startsWith('# ') && !line.startsWith('文档编号：') && !line.startsWith('适用')) {
      if (!line.trim() && buffer.length) flush()
      else if (line.trim()) buffer.push(line.trim())
    }
  }
  flush()
  return chunks
}

function buildIndex() {
  const files = fs.readdirSync(knowledgeDir).filter((file) => file.endsWith('.md')).sort()
  const chunks = files.flatMap(parseDocument).map((chunk, id) => ({ ...chunk, id, tokens: tokenize(`${chunk.section} ${chunk.content}`) }))
  const documentFrequency = new Map()
  for (const chunk of chunks) {
    for (const token of new Set(chunk.tokens)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1)
  }
  return { chunks, documentFrequency }
}

function getIndex() {
  cachedIndex ||= buildIndex()
  return cachedIndex
}

export const knowledgeService = {
  search(query, limit = 3) {
    const { chunks, documentFrequency } = getIndex()
    const queryTokens = [...new Set(tokenize(expandQuery(query)))]
    const scored = chunks.map((chunk) => {
      const frequency = new Map()
      chunk.tokens.forEach((token) => frequency.set(token, (frequency.get(token) || 0) + 1))
      const score = queryTokens.reduce((total, token) => {
        const tf = frequency.get(token) || 0
        if (!tf) return total
        const idf = Math.log((chunks.length + 1) / ((documentFrequency.get(token) || 0) + 0.5)) + 1
        return total + (tf / (tf + 1.2)) * idf
      }, 0)
      const headingBoost = queryTokens.some((token) => tokenize(chunk.section).includes(token)) ? 1.5 : 0
      return { ...chunk, score: Number((score + headingBoost).toFixed(3)) }
    })
    return scored.filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(5, Math.max(1, limit))).map(({ tokens, ...chunk }) => chunk)
  },

  sources() {
    return [...new Set(getIndex().chunks.map((chunk) => chunk.source))]
  },

  reset() { cachedIndex = undefined }
}
