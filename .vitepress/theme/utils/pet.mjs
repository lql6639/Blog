/**
 * 右下角看板娘：dsh-pet 的 standalone 网页版。
 * 脚本与素材由作者托管在 pet.alcy.cc（源仓库 PC2005-cloud/dsh-pet，MIT）。
 *
 * 懒加载：等页面起来再拉脚本，素材再等 window load（脚本内的 awaitLoad），
 * 失败只打日志，不影响站点。
 */

import { loadScript } from './commonTools.mjs'

const PET_SRC = 'https://pet.alcy.cc/dsh-pet.standalone.js'

let inited = false

export const initPet = async () => {
  if (typeof window === 'undefined' || inited) return
  // HMR / 重复调用时兜一层：DOM 已经在了就别再建一只
  if (document.querySelector('.dsh-pet-root')) {
    inited = true
    return
  }
  inited = true

  try {
    if (!window.DSHPet) await loadScript(PET_SRC, { async: true })
    window.DSHPet?.init({
      size: 400,
      // 位置（支持 top-left / top-right / bottom-left / bottom-right）
      corner: 'top-right',
      marginX: 16,
      // 要让开顶部导航栏，否则宠物会被压在导航底下
      marginY: 72,
      // 站内图片查看器是 9999，宠物放在它下面一层
      zIndex: 9998,
      // 等页面完全加载后再拉 config 和动画，别抢首屏带宽
      awaitLoad: true
    })
  } catch (error) {
    console.warn('看板娘加载失败：', error)
  }
}
