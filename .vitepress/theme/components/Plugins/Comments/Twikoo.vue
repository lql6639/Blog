<template>
  <div ref="commentRef" id="comment-dom" :class="['comment-content', 'twikoo', { fill }]" />
</template>

<script setup>
import { jumpRedirect } from '@/utils/commonTools'
import initComments from '@/utils/initComments'

const route = useRoute()

const props = defineProps({
  // 填充评论区
  fill: {
    type: [Boolean, String],
    default: false
  }
})

const { theme } = useData()
const { comment } = theme.value

// 评论数据
const twikoo = ref(null)
const commentRef = ref(null)

// 初始化 Twikoo
const initTwikoo = async () => {
  try {
    await nextTick()
    const Twikoo = await initComments(theme.value)
    // 显式传 path：Twikoo 默认用 location.pathname，VitePress 是 SPA，
    // 切文章时 pathname 会变，但显式传入更可靠，避免依赖全局状态
    await Twikoo.init({
      el: commentRef.value || '#comment-dom',
      envId: comment.twikoo.envId,
      path: route.path,
      onCommentLoaded: () => {
        if (props.fill) fillComments(props.fill)
        jumpRedirect(null, theme.value, true)
      }
    })
    twikoo.value = Twikoo
    return Twikoo
  } catch (error) {
    console.error('初始化评论出错：', error)
  }
}

// 填充评论区（「引用评论」功能：把选中文字预填到输入框）
const fillComments = (data) => {
  // Twikoo 2.0 的正文输入框类名是 .tk-textarea__inner（1.x 的 .el-textarea 已废弃）
  const commentInput = document.querySelector('#comment-dom .tk-textarea__inner')
  if (!commentInput) return false
  // 用原生 setter 触发 Vue 的 v-model 更新，直接赋值 value 不会同步到组件内部状态
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set
  if (valueSetter) {
    valueSetter.call(commentInput, data + '\n\n')
  } else {
    commentInput.value = data + '\n\n'
  }
  commentInput.dispatchEvent(new Event('input', { bubbles: true }))
  commentInput.focus()
}

// 监听路由切换：VitePress 是 SPA，切文章时 path 变了，
// 需要重新 init（Twikoo 的 init 幂等，内部会先 unmount 旧实例再挂载）
watch(
  () => route.path,
  () => {
    nextTick(() => initTwikoo())
  }
)

onMounted(() => {
  initTwikoo()
})
</script>

<style>
/* Twikoo 2.0 输入框类名（1.x 的 .el-textarea__inner 已改为 .tk-textarea__inner） */
.tk-textarea__inner {
  font-family: var(--main-font-family);
}
</style>
