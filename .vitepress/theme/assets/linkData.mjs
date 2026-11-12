// 链接数据
const linkData = [
  // 推荐数据
  {
    type: 'rec',
    typeName: '本站',
    typeDesc: '自己的东西',
    typeList: [
      {
        name: '小栈',
        avatar: '/images/logo/logo.webp',
        desc: '想逃离这个世界 却发现还有一个你',
        url: 'https://blog.lovlin.cn'
      }
    ]
  },
  // 小伙伴们
  {
    type: 'friends',
    typeName: '小伙伴们',
    typeDesc: '我们在一起，共同进步',
    typeList: [
      {
        name: '举个栗子',
        avatar: 'https://www.alcy.cc/avatar.jpg',
        desc: '拖延散场的时间，并不会改变结局。',
        url: 'https://alcy.cc'
      }
    ]
  },
  // 丢失
  {
    type: 'lost',
    typeName: '丢失',
    typeDesc: '因为各种原因失联的站点',
    typeList: []
  }
]

export default linkData
