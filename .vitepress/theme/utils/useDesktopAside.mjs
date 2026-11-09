import { onBeforeUnmount, onMounted, ref } from 'vue'

const ASIDE_MEDIA_QUERY = '(min-width: 1201px)'

export const useDesktopAside = () => {
  const isDesktopAsideVisible = ref(false)
  let mediaQueryList

  const updateAsideVisibility = () => {
    isDesktopAsideVisible.value = Boolean(mediaQueryList?.matches)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return

    mediaQueryList = window.matchMedia(ASIDE_MEDIA_QUERY)
    updateAsideVisibility()

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateAsideVisibility)
    } else {
      mediaQueryList.addListener(updateAsideVisibility)
    }
  })

  onBeforeUnmount(() => {
    if (!mediaQueryList) return

    if (mediaQueryList.removeEventListener) {
      mediaQueryList.removeEventListener('change', updateAsideVisibility)
    } else {
      mediaQueryList.removeListener(updateAsideVisibility)
    }
  })

  return {
    isDesktopAsideVisible
  }
}
