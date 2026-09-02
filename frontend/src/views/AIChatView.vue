<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ChatDotRound, MagicStick, Promotion, Cpu, Connection, ArrowRight, Setting, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { aiApi } from '../api/index.js'

const input = ref('')
const sending = ref(false)
const chatBody = ref()
const agentStatus = ref({ mode: 'local', model: null, tools: 8, writeTools: 1, ragSources: [], publicDemo: false, configurable: true })
const aiConfig = ref({ provider: 'deepseek', baseUrl: '', model: '', mode: 'local', keyConfigured: false, maskedKey: '' })
const recentActions = ref([])
const settingsVisible = ref(false)
const settingsSaving = ref(false)
const settingsTesting = ref(false)
const settingsForm = reactive({ provider: 'deepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', apiKey: '' })
const messages = ref([{
  role: 'assistant',
  content: '你好，我是 SmartFactory 工业 AI Agent。我可以查询 MES 实时数据、执行明确的设备状态操作，并从工业手册中检索故障处理依据。',
  welcome: true
}])
const suggestions = ['今天有哪些订单延期？', '把设备 EQ-002 标记为维修', 'CNC 主轴过热应该怎么处理？', 'ORD2026001 完成多少了？']
const deepseekModels = ['deepseek-v4-flash', 'deepseek-v4-pro']
const toolLabels = { getOrderProgress: '订单进度', getDelayedOrders: '延期订单', getProductionSummary: '生产汇总', getEquipmentStatus: '设备状态', getEquipmentAlerts: '异常查询', getLowStockMaterials: '库存预警', updateEquipmentStatus: '设备操作', searchIndustrialKnowledge: '知识检索' }
const latestActionType = computed(() => recentActions.value[0]?.actionType || 'QUERY')

async function scrollBottom() {
  await nextTick()
  if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight
}

async function loadActions() {
  try {
    const result = await aiApi.actions({ page: 1, pageSize: 5 })
    recentActions.value = result.items
  } catch { /* 审计列表不影响聊天 */ }
}

async function loadAgentMeta() {
  const [status, currentConfig] = await Promise.all([aiApi.status(), aiApi.config()])
  agentStatus.value = status
  aiConfig.value = currentConfig
}

async function openSettings() {
  try {
    const current = await aiApi.config()
    aiConfig.value = current
    Object.assign(settingsForm, { provider: current.provider, baseUrl: current.baseUrl, model: current.model, apiKey: '' })
    settingsVisible.value = true
  } catch (error) { ElMessage.error(error.message) }
}

function changeProvider(provider) {
  if (provider === 'deepseek') {
    settingsForm.baseUrl = 'https://api.deepseek.com'
    if (!settingsForm.model.startsWith('deepseek-')) settingsForm.model = 'deepseek-v4-flash'
  }
}

const configPayload = () => ({
  provider: settingsForm.provider,
  baseUrl: settingsForm.baseUrl.trim(),
  model: settingsForm.model.trim(),
  ...(settingsForm.apiKey.trim() ? { apiKey: settingsForm.apiKey.trim() } : {})
})

async function testSettings() {
  settingsTesting.value = true
  try {
    const result = await aiApi.testConfig(configPayload())
    ElMessage.success(`连接成功：${result.model} · ${result.latencyMs} ms`)
  } catch (error) { ElMessage.error(error.message) } finally { settingsTesting.value = false }
}

async function saveSettings() {
  settingsSaving.value = true
  try {
    aiConfig.value = await aiApi.updateConfig(configPayload())
    settingsForm.apiKey = ''
    await loadAgentMeta()
    settingsVisible.value = false
    ElMessage.success('模型配置已保存并立即生效')
  } catch (error) { ElMessage.error(error.message) } finally { settingsSaving.value = false }
}

async function disableModel() {
  try {
    await ElMessageBox.confirm('停用后将切换为本地 Agent 模式，确定继续吗？', '停用大模型', { type: 'warning' })
    aiConfig.value = await aiApi.updateConfig({ ...configPayload(), clearApiKey: true })
    await loadAgentMeta()
    settingsVisible.value = false
    ElMessage.success('已切换为本地 Agent 模式')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message)
  }
}

async function send(text = input.value) {
  const content = String(text).trim()
  if (!content || sending.value) return
  messages.value.push({ role: 'user', content })
  input.value = ''
  sending.value = true
  scrollBottom()
  try {
    const history = messages.value.filter((item) => !item.welcome).slice(0, -1).map(({ role, content: messageContent }) => ({ role, content: messageContent }))
    const result = await aiApi.chat({ message: content, history })
    messages.value.push({ role: 'assistant', content: result.reply, toolCalls: result.toolCalls, mode: result.mode })
    loadActions()
  } catch (error) {
    ElMessage.error(error.message)
    messages.value.push({ role: 'assistant', content: `抱歉，执行失败：${error.message}`, error: true })
  } finally {
    sending.value = false
    scrollBottom()
  }
}

function reset() { messages.value = [messages.value[0]] }
function formatTime(value) { return new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) }

onMounted(async () => {
  try { await loadAgentMeta() } catch { /* 保留本地模式提示 */ }
  loadActions()
})
</script>

<template>
  <div class="ai-layout">
    <div class="chat-card panel-card">
      <div class="chat-head">
        <div class="ai-avatar"><el-icon :size="22"><MagicStick /></el-icon><i></i></div>
        <div><strong>SmartFactory Agent</strong><span>MES Tools + Industrial RAG · {{ agentStatus.mode === 'llm' ? `大模型模式（${agentStatus.model}）` : '本地 Agent 模式' }}{{ agentStatus.publicDemo ? ' · 公开只读' : '' }}</span></div>
        <div class="chat-actions"><el-button v-if="agentStatus.configurable" :icon="Setting" text @click="openSettings">模型设置</el-button><el-button text @click="reset">清空会话</el-button></div>
      </div>

      <div ref="chatBody" class="chat-body">
        <div v-for="(message, index) in messages" :key="index" class="message" :class="message.role">
          <div class="message-avatar"><el-icon><component :is="message.role === 'assistant' ? Cpu : ChatDotRound" /></el-icon></div>
          <div class="message-content">
            <div class="bubble" :class="{ error: message.error }">{{ message.content }}</div>
            <div v-if="message.toolCalls?.length" class="tool-stack">
              <details v-for="(call, callIndex) in message.toolCalls" :key="callIndex" class="tool-call" :class="String(call.actionType || 'QUERY').toLowerCase()">
                <summary>
                  <span><el-icon><Connection /></el-icon></span>
                  <div><small>{{ call.actionType === 'MUTATION' ? '已执行 MES 写操作' : call.actionType === 'RAG' ? '已检索工业知识库' : '已调用 MES 查询工具' }}</small><strong>{{ call.label || call.name }}</strong></div>
                  <em>{{ call.actionType || 'QUERY' }}</em><code>{{ call.name }}()</code><el-icon><ArrowRight /></el-icon>
                </summary>
                <div v-if="call.actionType === 'RAG' && call.result?.matches?.length" class="source-list">
                  <span v-for="source in call.result.matches" :key="`${source.source}-${source.id}`">{{ source.title }} / {{ source.section }}</span>
                </div>
                <pre>{{ JSON.stringify({ arguments: call.arguments, result: call.result }, null, 2) }}</pre>
              </details>
            </div>
            <small v-if="message.mode === 'local'" class="mode-tip">规则路由 + MES Tools + 本地 RAG（配置模型 Key 后切换为 LLM 自主 Tool Calling）</small>
          </div>
        </div>
        <div v-if="sending" class="message assistant"><div class="message-avatar"><el-icon><Cpu /></el-icon></div><div class="bubble typing"><i></i><i></i><i></i><span>正在路由并执行 Agent 工具</span></div></div>
      </div>

      <div class="suggestions"><button v-for="item in suggestions" :key="item" @click="send(item)">{{ item }}</button></div>
      <div class="composer"><el-input v-model="input" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" resize="none" placeholder="查询实时数据、操作设备，或询问工业故障处理方法" @keydown.enter.exact.prevent="send()" /><el-button type="primary" :icon="Promotion" :loading="sending" @click="send()">发送</el-button></div>
      <div class="composer-tip">写操作仅响应明确指令；知识回答会标注手册来源</div>
    </div>

    <aside class="ai-sidebar">
      <div class="content-card agent-control">
        <div class="control-kicker"><span>AGENT CONTROL</span><i :class="agentStatus.mode"></i></div>
        <div class="model-row"><div class="model-logo"><el-icon><Cpu /></el-icon></div><div><strong>{{ agentStatus.mode === 'llm' ? agentStatus.model : 'Local Router' }}</strong><span>{{ agentStatus.publicDemo ? '公开演示 · 只读保护' : agentStatus.mode === 'llm' ? '模型已连接 · Tool Calling' : '本地规则路由模式' }}</span></div><el-button v-if="agentStatus.configurable" circle text :icon="Setting" aria-label="模型设置" @click="openSettings" /></div>
        <div class="agent-metrics"><div><strong>6</strong><span>查询工具</span></div><div><strong>{{ agentStatus.writeTools }}</strong><span>业务操作</span></div><div><strong>{{ agentStatus.ragSources.length }}</strong><span>知识文档</span></div></div>
        <div class="capability-tags"><span>MES 实时数据</span><span>{{ agentStatus.publicDemo ? '公开只读保护' : '安全写操作' }}</span><span>来源引用</span></div>
      </div>
      <div class="agent-flow panel-card">
        <div class="side-title"><div><strong>执行链路</strong><span>当前路由：{{ latestActionType }}</span></div></div>
        <div class="flow-line"><span><b>1</b>理解意图</span><i></i><span><b>2</b>选择工具</span><i></i><span :class="latestActionType.toLowerCase()"><b>3</b>{{ latestActionType === 'RAG' ? '知识检索' : latestActionType === 'MUTATION' ? '业务写入' : '数据查询' }}</span><i></i><span><b>4</b>生成回答</span></div>
      </div>
      <div class="content-card audit-card">
        <div class="side-title"><div><strong>执行审计</strong><span>最近 5 次工具调用</span></div><el-button circle text :icon="Refresh" aria-label="刷新审计" @click="loadActions" /></div>
        <div v-if="recentActions.length" class="audit-list"><div v-for="action in recentActions" :key="action.id"><span :class="action.actionType.toLowerCase()">{{ action.actionType[0] }}</span><div><strong>{{ toolLabels[action.toolName] || action.toolName }}</strong><code>{{ action.toolName }}()</code><small>{{ formatTime(action.createdAt) }} · {{ action.username || 'system' }}</small></div><i :class="action.status.toLowerCase()">{{ action.status }}</i></div></div>
        <div v-else class="audit-empty">完成一次提问后显示审计记录</div>
      </div>
    </aside>
  </div>

  <el-dialog v-model="settingsVisible" title="模型与 API 配置" width="520px" destroy-on-close>
    <div class="settings-intro"><span><el-icon><Setting /></el-icon></span><div><strong>配置 OpenAI 兼容模型</strong><p>密钥仅保存于后端环境文件，浏览器不会保存或读取明文。</p></div></div>
    <el-form label-position="top" class="settings-form">
      <el-form-item label="服务提供方"><el-segmented v-model="settingsForm.provider" :options="[{ label: 'DeepSeek', value: 'deepseek' }, { label: '自定义兼容服务', value: 'custom' }]" block @change="changeProvider" /></el-form-item>
      <el-form-item label="模型名称"><el-select v-model="settingsForm.model" filterable allow-create default-first-option placeholder="选择或输入模型名称"><el-option v-for="model in (settingsForm.provider === 'deepseek' ? deepseekModels : [])" :key="model" :label="model" :value="model" /></el-select></el-form-item>
      <el-form-item label="API Base URL"><el-input v-model="settingsForm.baseUrl" :disabled="settingsForm.provider === 'deepseek'" placeholder="https://example.com/v1" /></el-form-item>
      <el-form-item label="API Key"><el-input v-model="settingsForm.apiKey" type="password" show-password autocomplete="new-password" :placeholder="aiConfig.keyConfigured ? `已配置 ${aiConfig.maskedKey}，留空表示保留` : '请输入 API Key'" /><small class="field-tip">设置接口永远不会向前端返回完整密钥。</small></el-form-item>
    </el-form>
    <template #footer><div class="settings-footer"><el-button v-if="aiConfig.keyConfigured" type="danger" text @click="disableModel">停用模型</el-button><span></span><el-button :loading="settingsTesting" @click="testSettings">测试连接</el-button><el-button type="primary" :loading="settingsSaving" @click="saveSettings">保存并生效</el-button></div></template>
  </el-dialog>
</template>

<style scoped>
.ai-layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:16px; height:calc(100vh - 117px); min-height:590px; }
.chat-card { display:flex; flex-direction:column; overflow:hidden; }
.chat-head { height:68px; flex:none; border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 20px; gap:11px; }
.ai-avatar { width:39px; height:39px; background:linear-gradient(145deg,#327cf5,#8758e8); color:white; border-radius:12px; display:grid; place-items:center; position:relative; }
.ai-avatar i { position:absolute; width:8px; height:8px; background:#25ca8a; border:2px solid white; border-radius:50%; right:-2px; bottom:-1px; }
.chat-head>div:nth-child(2) { display:flex; flex-direction:column; gap:3px; }.chat-head strong { font-size:14px; }.chat-head span { font-size:10px; color:var(--text-muted); }.chat-actions { margin-left:auto; display:flex; align-items:center; }
.chat-body { flex:1; overflow:auto; padding:22px 24px; background:linear-gradient(180deg,#fbfcfe 0,#fff 100%); scroll-behavior:smooth; }
.message { display:flex; gap:10px; margin-bottom:20px; max-width:90%; }.message.user { margin-left:auto; flex-direction:row-reverse; }
.message-avatar { width:30px; height:30px; border-radius:9px; background:#edf3ff; color:#3177e7; display:grid; place-items:center; flex:none; }.user .message-avatar { background:#eaf9f3; color:#13a472; }
.message-content { min-width:0; }.bubble { background:white; border:1px solid var(--border); box-shadow:0 4px 14px rgba(40,56,85,.045); padding:12px 14px; border-radius:4px 13px 13px 13px; white-space:pre-wrap; font-size:13px; line-height:1.75; color:#344158; }.user .bubble { background:#2c73ed; color:white; border-color:#2c73ed; border-radius:13px 4px 13px 13px; }.bubble.error { color:#d64b4b; background:#fff8f8; }
.mode-tip { display:block; color:var(--text-light); font-size:9px; margin:5px 4px; }.tool-stack { margin-top:7px; display:flex; flex-direction:column; gap:6px; }
.tool-call { border:1px solid #dfe8f7; border-radius:9px; background:#f7faff; overflow:hidden; }.tool-call summary { list-style:none; display:flex; align-items:center; gap:8px; padding:8px 10px; cursor:pointer; }.tool-call summary>span { width:26px; height:26px; border-radius:7px; background:#e5efff; color:#2f74e8; display:grid; place-items:center; }.tool-call.mutation summary>span { background:#fff0e8; color:#e46d2f; }.tool-call.rag summary>span { background:#f2edff; color:#7b54dc; }
.tool-call summary div { display:flex; flex-direction:column; }.tool-call small { font-size:8px; color:var(--text-light); }.tool-call strong { font-size:10px; }.tool-call summary em { font-size:7px; font-style:normal; padding:2px 5px; border-radius:5px; background:#eaf2ff; color:#2c70da; }.tool-call.mutation summary em { background:#fff0e8; color:#d95e28; }.tool-call.rag summary em { background:#f2edff; color:#754dcf; }.tool-call code { margin-left:auto; font-size:9px; color:#6b7e9c; }.tool-call summary>.el-icon { transform:rotate(90deg); color:#91a0b4; }.tool-call[open] summary>.el-icon { transform:rotate(-90deg); }
.source-list { display:flex; flex-wrap:wrap; gap:5px; padding:0 10px 8px; }.source-list span { font-size:8px; padding:3px 6px; border-radius:5px; background:#eee9ff; color:#6848b9; }.tool-call pre { margin:0; border-top:1px solid #dfe8f7; padding:10px; max-height:200px; overflow:auto; background:#152034; color:#c9d5e8; font:10px/1.55 Consolas,monospace; }
.typing { display:flex; align-items:center; gap:4px; }.typing i { width:5px; height:5px; border-radius:50%; background:#6e82a2; animation:bounce 1.2s infinite; }.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}.typing span{margin-left:6px;font-size:10px;color:var(--text-muted)}@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
.suggestions { display:flex; gap:7px; padding:10px 20px 0; border-top:1px solid var(--border); overflow:auto; }.suggestions button { white-space:nowrap; border:1px solid #dce5f3; background:#f8faff; color:#60738f; border-radius:15px; padding:5px 10px; font-size:10px; cursor:pointer; }.suggestions button:hover { color:var(--primary); border-color:#b9d1fa; }.composer { padding:10px 20px 6px; display:flex; align-items:flex-end; gap:9px; }.composer .el-button { height:36px; }.composer-tip { text-align:center; color:var(--text-light); font-size:9px; padding-bottom:9px; }
.ai-sidebar { display:flex; flex-direction:column; gap:14px; overflow-y:auto; padding-right:2px; }
.agent-control { padding:18px; background:linear-gradient(155deg,#fff 58%,#f3f7ff); }.control-kicker { display:flex; align-items:center; justify-content:space-between; color:#8390a4; font-size:8px; font-weight:700; letter-spacing:1.6px; }.control-kicker i { width:8px; height:8px; border-radius:50%; background:#aab5c5; box-shadow:0 0 0 4px #eef1f5; }.control-kicker i.llm { background:#20bd82; box-shadow:0 0 0 4px #e6f8f1; }
.model-row { display:flex; align-items:center; gap:10px; padding:15px 0 14px; }.model-logo { width:38px; height:38px; border-radius:11px; display:grid; place-items:center; color:white; background:linear-gradient(145deg,#317cf5,#775ce3); box-shadow:0 8px 18px #4772dc33; }.model-row>div:nth-child(2) { display:flex; flex-direction:column; min-width:0; flex:1; gap:3px; }.model-row strong { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.model-row span { font-size:8px; color:#8390a4; }.agent-metrics { display:grid; grid-template-columns:repeat(3,1fr); background:#f6f8fc; border-radius:10px; padding:10px 4px; }.agent-metrics div { display:flex; flex-direction:column; align-items:center; gap:2px; border-right:1px solid #e4e9f1; }.agent-metrics div:last-child { border:0; }.agent-metrics strong { font-size:16px; color:#253651; }.agent-metrics span { font-size:8px; color:#8a97aa; }.capability-tags { display:flex; gap:5px; margin-top:11px; }.capability-tags span { flex:1; text-align:center; border:1px solid #e0e8f5; background:#fff; color:#617895; border-radius:6px; padding:5px 2px; font-size:7px; }
.agent-flow { padding:17px 18px; }.side-title { display:flex; justify-content:space-between; align-items:center; }.side-title>div { display:flex; flex-direction:column; gap:3px; }.side-title strong { font-size:12px; }.side-title span { color:#8d99aa; font-size:8px; }.flow-line { margin-top:15px; display:flex; align-items:flex-start; }.flow-line span { width:52px; flex:none; display:flex; flex-direction:column; align-items:center; gap:5px; color:#73849d; font-size:7px; text-align:center; }.flow-line b { width:23px; height:23px; border-radius:7px; display:grid; place-items:center; color:#3477e8; background:#edf4ff; font-size:8px; }.flow-line span.mutation b { background:#fff0e8; color:#dc642e; }.flow-line span.rag b { background:#f1ecff; color:#7550d1; }.flow-line i { flex:1; height:1px; background:#dbe3ef; margin-top:11px; }
.audit-card { padding:17px 18px; }.audit-list { display:flex; flex-direction:column; margin-top:10px; }.audit-list>div { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #edf1f5; }.audit-list>div:last-child { border:0; }.audit-list>div>span { width:23px; height:23px; border-radius:7px; display:grid; place-items:center; background:#eaf2ff; color:#2d71dc; font-size:8px; font-weight:700; }.audit-list>div>span.mutation { background:#fff0e8; color:#dc632e; }.audit-list>div>span.rag { background:#f1ecff; color:#7651d2; }.audit-list div div { display:flex; flex-direction:column; min-width:0; flex:1; }.audit-list strong { font-size:9px; }.audit-list code { font-size:7px; color:#8492a6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.audit-list small { font-size:7px; color:var(--text-light); }.audit-list>div>i { font-size:7px; font-style:normal; color:#16a170; }.audit-list>div>i.failed { color:#e14f4f; }.audit-empty { font-size:9px; color:var(--text-light); text-align:center; padding:22px 12px 10px; }
.settings-intro { display:flex; gap:11px; padding:13px; margin-bottom:18px; border-radius:10px; background:#f4f8ff; }.settings-intro>span { width:34px; height:34px; border-radius:9px; background:#e3eeff; color:#3476e6; display:grid; place-items:center; flex:none; }.settings-intro>div { display:flex; flex-direction:column; gap:3px; }.settings-intro strong { font-size:12px; }.settings-intro p { margin:0; color:#75849a; font-size:9px; }.settings-form :deep(.el-select),.settings-form :deep(.el-segmented) { width:100%; }.field-tip { display:block; margin-top:6px; color:#8a97a8; font-size:9px; }.settings-footer { width:100%; display:flex; align-items:center; }.settings-footer>span { flex:1; }
@media(max-width:1000px){.ai-layout{grid-template-columns:1fr;height:auto}.chat-card{height:680px}.ai-sidebar{display:grid;grid-template-columns:1fr 1fr}}@media(max-width:650px){.ai-sidebar{grid-template-columns:1fr}.message{max-width:96%}.chat-body{padding:18px 12px}.suggestions,.composer{padding-left:12px;padding-right:12px}}
</style>
