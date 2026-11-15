<template>
  <Banner type="page" :title="title" :desc="desc" :footer="footer" :image="image">
    <template v-if="$slots['header-slot']" #header-slot>
      <slot name="header-slot" />
    </template>
    <template v-if="linkHref" #footer-slot>
      <a class="page-cta" :href="linkHref" :target="target" :rel="rel">
        <i class="iconfont" :class="icon" />
        <span>{{ linkText }}</span>
      </a>
    </template>
    <slot />
  </Banner>
</template>

<script setup>
import Banner from '@/components/Banner.vue'

defineProps({
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  footer: { type: String, default: '' },
  image: { type: String, default: 'https://api.imlazy.ink/img' },
  // 右下角按钮：需要时才传 linkHref
  linkText: { type: String, default: '' },
  linkHref: { type: String, default: '' },
  icon: { type: String, default: 'icon-github' },
  target: { type: String, default: '_blank' },
  rel: { type: String, default: 'noopener' }
})
</script>

<style lang="scss" scoped>
/* 各页面右下角的按钮共用一套样式，之前在每个 view 里各抄了一份 */
.page-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 16px;
  border-radius: 50px;
  color: #fff;
  background-color: var(--main-dark-opacity);
  backdrop-filter: blur(20px);
  transition:
    color 0.3s,
    background-color 0.3s;

  .iconfont {
    margin-right: 8px;
    transition: color 0.3s;
  }

  &:hover {
    color: var(--main-card-background);
    background-color: var(--main-color);

    .iconfont {
      color: var(--main-card-background) !important;
    }
  }
}
</style>
