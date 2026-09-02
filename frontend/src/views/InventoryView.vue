<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Search, Refresh, Warning, Box } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { inventoryApi } from '../api/index.js'

const rows=ref([]),loading=ref(false),dialogVisible=ref(false),editingId=ref(null),formRef=ref()
const filters=reactive({search:'',lowStock:false})
const pagination=reactive({page:1,pageSize:20,total:0})
const emptyForm=()=>({materialNo:'',materialName:'',quantity:0,safetyStock:10,unit:'个'})
const form=reactive(emptyForm())
const lowCount=computed(()=>rows.value.filter(i=>i.quantity<=i.safetyStock).length)
const totalQuantity=computed(()=>rows.value.reduce((s,i)=>s+i.quantity,0))
async function load(){loading.value=true;try{const result=await inventoryApi.list({search:filters.search,lowStock:filters.lowStock,page:pagination.page,pageSize:pagination.pageSize});rows.value=result.items;pagination.total=result.total}catch(e){ElMessage.error(e.message)}finally{loading.value=false}}
function applyFilters(){pagination.page=1;load()}
function openCreate(){editingId.value=null;Object.assign(form,emptyForm());dialogVisible.value=true}
function openEdit(row){editingId.value=row.id;Object.assign(form,row);dialogVisible.value=true}
async function submit(){await formRef.value.validate();try{editingId.value?await inventoryApi.update(editingId.value,form):await inventoryApi.create(form);ElMessage.success('物料信息已保存');dialogVisible.value=false;load()}catch(e){ElMessage.error(e.message)}}
async function remove(row){try{await ElMessageBox.confirm(`确定删除物料 ${row.materialName} 吗？`,'删除确认',{type:'warning'});await inventoryApi.remove(row.id);ElMessage.success('物料已删除');load()}catch(e){if(e!=='cancel')ElMessage.error(e.message)}}
const percent=row=>Math.min(100,Math.round(row.quantity/Math.max(row.safetyStock*3,1)*100))
onMounted(load)
</script>

<template>
  <div class="inventory-summary">
    <div class="panel-card blue"><span><el-icon><Box/></el-icon></span><div><small>物料种类</small><strong>{{rows.length}}</strong><em>种</em></div></div>
    <div class="panel-card green"><span><el-icon><Box/></el-icon></span><div><small>当前库存总量</small><strong>{{totalQuantity.toLocaleString()}}</strong><em>单位</em></div></div>
    <div class="panel-card orange"><span><el-icon><Warning/></el-icon></span><div><small>库存预警</small><strong>{{lowCount}}</strong><em>种需补货</em></div></div>
  </div>
  <div class="content-card table-card">
    <div class="toolbar"><div class="toolbar-left"><el-input v-model="filters.search" placeholder="搜索物料编号或名称" clearable :prefix-icon="Search" style="width:250px" @keyup.enter="applyFilters" @clear="applyFilters"/><el-checkbox v-model="filters.lowStock" label="只看库存预警" @change="applyFilters"/><el-button :icon="Refresh" @click="load">刷新</el-button></div><el-button type="primary" :icon="Plus" @click="openCreate">新增物料</el-button></div>
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column label="物料编号" width="125"><template #default="{row}"><span class="mono">{{row.materialNo}}</span></template></el-table-column>
      <el-table-column prop="materialName" label="物料名称" min-width="160"/>
      <el-table-column label="库存状态" min-width="210"><template #default="{row}"><div class="stock-bar"><el-progress :percentage="percent(row)" :stroke-width="8" :show-text="false" :status="row.quantity<=row.safetyStock?'exception':undefined"/><span :class="{'danger-text':row.quantity<=row.safetyStock}">{{row.quantity}} {{row.unit}}</span></div></template></el-table-column>
      <el-table-column label="安全库存" width="120"><template #default="{row}">{{row.safetyStock}} {{row.unit}}</template></el-table-column>
      <el-table-column label="预警状态" width="120"><template #default="{row}"><el-tag v-if="row.quantity<=row.safetyStock" type="danger" effect="light" round><el-icon><Warning/></el-icon>&nbsp;需要补货</el-tag><el-tag v-else type="success" effect="plain" round>库存正常</el-tag></template></el-table-column>
      <el-table-column label="库存差额" width="110"><template #default="{row}"><span :class="row.quantity-row.safetyStock<0?'danger-text':'success-text'">{{row.quantity-row.safetyStock>0?'+':''}}{{row.quantity-row.safetyStock}} {{row.unit}}</span></template></el-table-column>
      <el-table-column label="操作" width="125" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>
    <div class="table-foot"><span>共 {{pagination.total}} 种物料</span><el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[10,20,50]" layout="sizes, prev, pager, next" @change="load"/></div>
  </div>
  <el-dialog v-model="dialogVisible" :title="editingId?'编辑物料':'新增物料'" width="520px">
    <el-form ref="formRef" :model="form" label-position="top"><div class="form-grid"><el-form-item label="物料编号" prop="materialNo" :rules="[{required:true,message:'请输入物料编号'}]"><el-input v-model="form.materialNo" placeholder="如 MAT-021"/></el-form-item><el-form-item label="物料名称" prop="materialName" :rules="[{required:true,message:'请输入物料名称'}]"><el-input v-model="form.materialName"/></el-form-item></div><div class="form-grid"><el-form-item label="当前库存"><el-input-number v-model="form.quantity" :min="0" style="width:100%"/></el-form-item><el-form-item label="安全库存"><el-input-number v-model="form.safetyStock" :min="0" style="width:100%"/></el-form-item></div><el-form-item label="计量单位"><el-select v-model="form.unit" style="width:100%"><el-option v-for="unit in ['个','件','台','套','块','m','L']" :key="unit" :label="unit" :value="unit"/></el-select></el-form-item></el-form>
    <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="submit">保存物料</el-button></template>
  </el-dialog>
</template>

<style scoped>
.inventory-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}.inventory-summary>.panel-card{padding:20px;display:flex;align-items:center;gap:14px}.inventory-summary>.panel-card>span{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px}.inventory-summary .blue>span{background:#eaf2ff;color:#2878ff}.inventory-summary .green>span{background:#e9f9f3;color:#14a873}.inventory-summary .orange>span{background:#fff2e7;color:#ed7e37}.inventory-summary div div{display:flex;align-items:baseline;gap:5px;flex-wrap:wrap}.inventory-summary small{width:100%;color:var(--text-muted)}.inventory-summary strong{font-size:24px}.inventory-summary em{font-style:normal;color:var(--text-muted);font-size:11px}.stock-bar{display:flex;align-items:center;gap:12px}.stock-bar .el-progress{width:100px}.stock-bar span{font-size:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.table-foot{padding:14px 4px 0;color:var(--text-muted);font-size:11px;display:flex;align-items:center;justify-content:space-between}@media(max-width:800px){.inventory-summary{grid-template-columns:1fr}}@media(max-width:520px){.form-grid{grid-template-columns:1fr}.table-foot{align-items:flex-start;gap:12px;flex-direction:column}}
</style>
