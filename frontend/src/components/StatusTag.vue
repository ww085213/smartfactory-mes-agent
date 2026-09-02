<script setup>
import { computed } from 'vue'
import { statusLabel, statusType } from '../utils/status.js'

const props = defineProps({ value: { type: String, default: '' } })
const label = computed(() => statusLabel(props.value))
const type = computed(() => statusType(props.value))
</script>

<template>
  <el-tag :type="type" effect="light" round>{{ label }}</el-tag>
</template>
