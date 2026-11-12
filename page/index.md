---
title: 正在重定向
head:
  - - meta
    - { http-equiv: refresh, content: '0;url=/' }
---

<script setup>
import { onMounted } from "vue"
import { useRouter } from "vitepress"

const router = useRouter();

onMounted(() => router.go("/"));
</script>
