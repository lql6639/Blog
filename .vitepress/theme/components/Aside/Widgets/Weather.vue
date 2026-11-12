<!-- 侧边栏 - 天气数据 -->
<template>
  <div class="weather-data s-card">
    <div class="title">
      <i class="iconfont icon-chart"></i>
      <span class="title-name">天气数据</span>
    </div>

    <div class="all-data">
      <!-- 城市 -->
      <div class="data-item">
        <span class="name"><i class="iconfont icon-home"></i> 城市</span>
        <span class="num">{{ weatherData?.city || '--' }}</span>
      </div>
      <!-- 温度 -->
      <div class="data-item">
        <span class="name"><i class="iconfont icon-fire"></i> 温度</span>
        <span class="num">
          {{ weatherData?.temperature != null ? weatherData.temperature + '℃' : '--' }}
        </span>
      </div>
      <!-- 湿度 -->
      <div class="data-item">
        <span class="name"><i class="iconfont icon-visibility"></i> 湿度</span>
        <span class="num">
          {{ weatherData?.humidity != null ? weatherData.humidity + '%' : '--' }}
        </span>
      </div>
      <!-- 风向 -->
      <div class="data-item">
        <span class="name"><i class="iconfont icon-arrow-right"></i> 风向</span>
        <span class="num">{{ weatherData?.winddirection || '--' }}</span>
      </div>
      <!-- 风力 -->
      <div class="data-item">
        <span class="name"><i class="iconfont icon-refresh"></i> 风力</span>
        <span class="num">{{ weatherData?.windpower || '--' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getRealtimeWeather, getIpInfo, getAmapWeather } from '@/api'

// 两级都拿不到数据时通知父组件隐藏整块卡片
const emit = defineEmits(['fetch-error'])

const weatherData = ref(null)

const isMobileClient = () => {
  if (typeof navigator === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|Pad|iPod/i.test(navigator.userAgent)
}

// 第 1 级：自有 API 服务实时天气
const fetchFromServer = async () => {
  const realtime = await getRealtimeWeather()
  if (!realtime.city || !realtime.temperature) {
    throw new Error('服务端天气数据不完整')
  }
  return {
    city: realtime.city,
    temperature: realtime.temperature,
    // 服务端给的是 "67%"，模板会再拼一个 %，这里先剥掉
    humidity:
      typeof realtime.humidity === 'string'
        ? realtime.humidity.replace('%', '').trim()
        : realtime.humidity,
    winddirection: realtime.wind,
    windpower: realtime.windSpeed
  }
}

// 第 2 级：服务端 IP 归属地 → 高德天气
const fetchFromAmap = async () => {
  const key = import.meta.env.VITE_WEATHER_KEY?.trim()
  if (!key) throw new Error('未配置 VITE_WEATHER_KEY')

  const info = await getIpInfo()
  const city = info?.data?.city
  if (typeof city !== 'string' || !city.trim()) {
    throw new Error('IP 归属地未返回城市')
  }

  const live = await getAmapWeather(key, city.trim())
  return {
    city: live.city,
    temperature: live.temperature,
    humidity: live.humidity,
    winddirection: live.winddirection,
    windpower: live.windpower
  }
}

onMounted(async () => {
  if (isMobileClient()) return

  try {
    weatherData.value = await fetchFromServer()
    return
  } catch (e) {
    console.warn('服务端天气无数据，改用高德：', e)
  }

  // 与 Home 一致：再给服务端一次机会，同时并发走高德，谁先成功用谁
  const tasks = [fetchFromServer()]
  if (import.meta.env.VITE_WEATHER_KEY?.trim()) {
    tasks.push(fetchFromAmap())
  }

  try {
    weatherData.value = await Promise.any(tasks)
  } catch (e) {
    // 都为空：卡片不显示
    console.error('获取天气失败：', e)
    emit('fetch-error', e)
  }
})
</script>

<style lang="scss" scoped>
.weather-data {
  .all-data {
    display: flex;
    flex-direction: column;
    margin-top: 12px;

    .data-item {
      width: 100%;
      padding: 8px 0;
      display: flex;
      justify-content: space-between;

      .name {
        font-weight: 500;
        display: flex;
        align-items: center;

        i {
          margin-right: 4px;
        }
      }

      .num {
        font-size: 1.1em;
      }
    }
  }
}
</style>
