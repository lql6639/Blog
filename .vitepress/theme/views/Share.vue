<template>
  <div class="share">
    <Banner
      type="page"
      title="日常分享"
      desc="记录一些不值一提的日常"
      footer="爱生活 也爱分享日常"
      image="https://api.imlazy.ink/img"
    >
      <template #footer-slot>
        <a class="to-link" href="https://lovlin.cn" target="_blank" rel="noopener">
          <i class="iconfont icon-github"></i>
          <span>前往 Home</span>
        </a>
      </template>
    </Banner>

    <ShareFeed />
  </div>
</template>

<script setup>
import Banner from '@/components/Banner.vue'
</script>

<style lang="scss" scoped>
.share {
  .banner-page {
    .to-link {
      height: 40px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: center;
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
  }
}
</style>
