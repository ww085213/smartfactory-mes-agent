<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, User, Cpu, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { authApi } from '../api/index.js'
import { authStore } from '../utils/auth.js'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const formRef = ref()
const form = reactive({ username: 'admin', password: 'SmartFactory@2026' })

async function submit() {
  await formRef.value.validate()
  loading.value = true
  try {
    const result = await authApi.login(form)
    authStore.save(result)
    ElMessage.success('登录成功')
    router.replace(String(route.query.redirect || '/'))
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-visual">
      <div class="visual-content">
        <div class="visual-logo"><el-icon><Cpu /></el-icon></div>
        <p>SMART MANUFACTURING</p>
        <h1>让生产数据<br><span>真正驱动决策</span></h1>
        <div class="visual-flow"><span>生产订单</span><i></i><span>实时设备</span><i></i><span>AI 决策</span></div>
      </div>
      <div class="grid-lines"></div>
    </section>
    <section class="login-panel">
      <div class="login-box">
        <div class="mobile-logo"><el-icon><Cpu /></el-icon><strong>SmartFactory</strong></div>
        <small>WELCOME BACK</small>
        <h2>登录生产管理系统</h2>
        <p>使用管理员账户访问 MES 业务数据</p>
        <el-form ref="formRef" :model="form" label-position="top" @keyup.enter="submit">
          <el-form-item label="用户名" prop="username" :rules="[{ required: true, message: '请输入用户名' }]">
            <el-input v-model="form.username" size="large" :prefix-icon="User" autocomplete="username" />
          </el-form-item>
          <el-form-item label="密码" prop="password" :rules="[{ required: true, message: '请输入密码' }]">
            <el-input v-model="form.password" size="large" type="password" show-password :prefix-icon="Lock" autocomplete="current-password" />
          </el-form-item>
          <el-button type="primary" size="large" :loading="loading" @click="submit">进入系统 <el-icon><Right /></el-icon></el-button>
        </el-form>
        <div class="demo-account"><strong>演示账号</strong><span>admin</span><i>/</i><span>SmartFactory@2026</span></div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page{min-height:100vh;display:grid;grid-template-columns:minmax(460px,1.15fr) minmax(440px,.85fr);background:white}.login-visual{position:relative;overflow:hidden;background:radial-gradient(circle at 70% 28%,#2563eb66,transparent 30%),linear-gradient(145deg,#101b31,#13294d 64%,#17478d);color:white;display:flex;align-items:center;padding:10% 12%}.visual-content{position:relative;z-index:2}.visual-logo{width:58px;height:58px;border-radius:17px;background:linear-gradient(145deg,#438cff,#6b64ef);display:grid;place-items:center;font-size:30px;box-shadow:0 16px 40px #0a54da66}.visual-content>p{margin:25px 0 13px;color:#75a9f7;font-size:11px;letter-spacing:4px}.visual-content h1{font-size:46px;line-height:1.35;margin:0;letter-spacing:-2px}.visual-content h1 span{color:#6ea9ff}.visual-flow{margin-top:46px;display:flex;align-items:center;gap:12px;color:#b7c8df;font-size:11px}.visual-flow span{padding:8px 12px;border:1px solid #ffffff22;border-radius:8px;background:#ffffff0c}.visual-flow i{width:26px;height:1px;background:#5486c5}.grid-lines{position:absolute;inset:0;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:55px 55px;opacity:.025;transform:perspective(500px) rotateX(12deg) scale(1.2)}.login-panel{display:flex;align-items:center;justify-content:center;padding:50px}.login-box{width:min(390px,100%)}.mobile-logo{display:none}.login-box>small{color:#3478ed;font-weight:700;letter-spacing:2px}.login-box h2{font-size:28px;margin:12px 0 8px;letter-spacing:-.7px}.login-box>p{font-size:13px;color:var(--text-muted);margin:0 0 32px}.login-box .el-form-item{margin-bottom:21px}.login-box .el-button{width:100%;margin-top:6px;display:flex;gap:8px}.demo-account{margin-top:24px;padding:11px 13px;background:#f4f7fb;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:10px;color:#65748a}.demo-account strong{color:#2f70dc}.demo-account i{font-style:normal;color:#b3bdca}.demo-account span{font-family:Consolas,monospace}@media(max-width:850px){.login-page{grid-template-columns:1fr}.login-visual{display:none}.login-panel{padding:30px}.mobile-logo{display:flex;align-items:center;gap:9px;margin-bottom:45px;color:#2d72e6}.mobile-logo .el-icon{font-size:28px}.mobile-logo strong{color:#17233a;font-size:16px}}
</style>
