// 主题配置
export const themeConfig = {
  // 站点信息
  siteMeta: {
    // 站点标题
    title: 'koizora',
    // 站点描述
    description: '想逃离这个世界 却发现还有一个你',
    // 站点logo
    logo: '/images/logo/logo.webp',
    // 站点地址
    site: 'https://blog.lovlin.cn',
    // 语言
    lang: 'zh-CN',
    // 作者
    author: {
      name: 'koizora',
      cover: '/images/logo/logo.webp',
      email: '1740242084@qq.com',
      link: 'https://lovlin.cn'
    }
  },
  // 备案信息
  icp: '萌ICP备20262044号',
  // 建站日期
  since: '2026-02-06',
  // 每页文章数据
  postSize: 5,
  // inject
  inject: {
    // 头部
    // https://vitepress.dev/zh/reference/site-config#head
    header: [
      // Onion-Location
      [
        'meta',
        {
          'http-equiv': 'Onion-Location',
          content: 'chiyubknkdlzx4mjmiuu64sqaez2rxj3ae2weypybpkxpodpx3etsiqd.onion'
        }
      ],
      // favicon
      ['link', { rel: 'icon', href: '/favicon.ico' }],
      // 提前标记 JS 可用，便于 no-js 场景做纯 CSS 降级
      ['script', {}, "document.documentElement.classList.add('js-enabled');"],
      // RSS
      [
        'link',
        {
          rel: 'alternate',
          type: 'application/rss+xml',
          title: 'RSS',
          href: '/rss.xml'
        }
      ],
      // iconfont（本地化，文件在 public/fonts/）
      [
        'link',
        {
          rel: 'stylesheet',
          href: '/fonts/iconfont.css'
        }
      ]
      // Embed code
      // Code font and Algolia connections are loaded lazily only when needed.
    ]
  },

  // 导航栏菜单
  nav: [
    {
      text: '文库',
      items: [
        { text: '文章列表', link: '/pages/archives', icon: 'article' },
        { text: '全部分类', link: '/pages/categories', icon: 'folder' },
        { text: '全部标签', link: '/pages/tags', icon: 'hashtag' }
      ]
    },
    {
      text: '专栏',
      items: [
        {
          text: '技术分享',
          link: '/pages/categories/技术分享',
          icon: 'technical'
        },
        { text: '我的项目', link: '/pages/project', icon: 'code' },
        { text: '效率工具', link: '/pages/tools', icon: 'tools' }
      ]
    },
    {
      text: '友链',
      items: [
        { text: '畅所欲言', link: '/pages/message', icon: 'chat' },
        { text: '友情链接', link: '/pages/link', icon: 'people' }
      ]
    },
    {
      text: '我的',
      items: [
        { text: '心愿树洞', link: '/pages/wishes', icon: 'git' },
        { text: '关于本站', link: '/pages/about', icon: 'contacts' }
      ]
    }
  ],
  // 导航栏菜单 - 左侧
  navMore: [
    {
      name: '项目',
      list: [
        {
          icon: '/images/logo/logo.webp',
          name: '主站',
          url: 'https://lovlin.cn'
        }
      ]
    },
    {
      name: '服务',
      list: [
        {
          icon: '/images/uptime-favicon.ico',
          name: '检测',
          url: 'https://status.lovlin.cn'
        }
      ]
    }
  ],
  // 封面配置
  cover: {
    // 是否开启双栏布局
    twoColumns: false,
    // 是否开启封面显示
    showCover: {
      // 是否开启封面显示 文章不设置cover封面会显示异常，可以设置下方默认封面
      enable: true,
      // 封面布局方式: left | right | both
      coverLayout: 'both',
      // 默认封面(随机展示)：可放多张图，按文章路径稳定取其中一张
      // 远程随机图接口会自动追加 `_cover=<文章哈希>` 参数，保证每篇文章拿到不同的图
      defaultCover: ['https://t.alcy.cc/pc']
    }
  },
  // 页脚信息
  footer: {
    // 社交链接（请确保为偶数个）
    social: [
      {
        icon: 'email',
        link: 'mailto:1740242084@qq.com'
      },
      {
        icon: 'github',
        link: 'https://github.com/lql6639'
      },
      {
        icon: 'telegram',
        link: 'https://t.me'
      },
      {
        icon: 'bilibili',
        link: 'https://space.bilibili.com/2073021411'
      },
      {
        icon: 'qq',
        link: 'https://qm.qq.com/q/xiyMGvkhqw'
      },
      {
        icon: 'twitter-x',
        link: 'https://twitter.com'
      }
    ],
    // sitemap
    sitemap: [
      {
        text: '博客',
        items: [
          { text: '全部分类', link: '/pages/categories' },
          { text: '全部标签', link: '/pages/tags' },
          { text: '全部文章', link: '/pages/archives' }
        ]
      },
      {
        text: '项目',
        items: [
          {
            text: 'TODO',
            link: '/pages/todo'
          },
          {
            text: '订阅本站',
            link: 'https://blog.lovlin.cn/rss.xml',
            newTab: true
          },
          {
            text: '本站源码',
            link: 'https://github.com/lql6639/Blog',
            newTab: true
          }
        ]
      },
      {
        text: '专栏',
        items: [
          { text: '技术分享', link: '/pages/categories/技术分享' },
          { text: '我的项目', link: '/pages/project' },
          { text: '效率工具', link: '/pages/tools' }
        ]
      },
      {
        text: '页面',
        items: [
          { text: '致谢名单', link: '/pages/thanks' },
          { text: '隐私政策', link: '/pages/privacy' },
          { text: '版权协议', link: '/pages/cc' }
        ]
      },
      {
        text: '服务',
        items: [
          { text: '访问主站', link: 'https://lovlin.cn', newTab: true },
          { text: '站点状态', link: 'https://status.lovlin.cn', newTab: true },
          { text: '关于本站', link: '/pages/about' }
        ]
      }
    ],
    // 页脚徽标
    badges: {
      // 是否显示底部徽标区域
      enable: true,
      // 标题文本
      title: 'Made with',
      // 徽标列表
      items: [
        { icon: '📡', text: 'IPv6已启用', show: true },
        { icon: '⚡️', text: 'HTTP/3', show: true },
        { icon: '🧅', text: '.onion可用', show: true },
        { icon: '🌱', text: '低碳环保', show: true },
        { icon: '🍪', text: '无Cookie', show: true },
        { icon: '🕵️', text: '无追踪', show: true }
      ]
    }
  },
  // 评论
  comment: {
    enable: true,
    // 评论系统选择
    // artalk / twikoo
    type: 'twikoo',
    // artalk
    // https://artalk.js.org/
    artalk: {
      site: '',
      server: ''
    },
    // twikoo
    // https://twikoo.js.org/
    twikoo: {
      // 必填，若不想使用 CDN，可以使用 pnpm add twikoo 安装并引入
      js: 'https://cdn.jsdelivr.net/npm/twikoo@2.0.17/dist/twikoo.min.js',
      envId: 'https://twikoo.lovlin.cn',
      // 环境地域，默认为 ap-shanghai，腾讯云环境填 ap-shanghai 或 ap-guangzhou；Vercel 环境不填
      region: '',
      lang: 'zh-CN'
    }
  },
  // 侧边栏
  aside: {
    // 站点简介
    hello: {
      enable: true,
      text: '你好，这里有关于<strong>开发</strong>相关的问题和看法，也会有一些<strong>奇技淫巧</strong>的分享，其中大部分内容会侧重于<strong>前端开发</strong>。希望你可以在这里找到对你有用的知识和教程。'
    },
    // 目录
    toc: {
      enable: true
    },
    // 标签
    tags: {
      enable: true
    },
    // 倒计时
    countDown: {
      enable: true,
      // 倒计时日期（无年份 = 每年循环，指向下一次生日）
      data: {
        name: '生日',
        date: '02-06'
      }
    },
    // 站点数据
    siteData: {
      enable: true
    },
    // 天气数据
    weather: {
      enable: true
    }
  },
  // 友链
  friends: {
    // 友链朋友圈
    circleOfFriends: '',
    // 动态友链
    dynamicLink: {
      server: '',
      app_token: '',
      table_id: ''
    }
  },
  // 音乐播放器
  music: {
    enable: true,
    // url（结尾斜杠不能省：无斜杠会 301 且响应缺少 CORS 头，浏览器 fetch 直接失败）
    url: 'https://api.lovlin.cn/meting/',
    // netease / tencent / kugou
    server: 'netease',
    // playlist / album / song
    type: 'playlist',
    // id
    id: 3778678
  },
  // 搜索
  // 本地全文搜索：构建时生成 public/data/searchIndex.json，前端懒加载，无需 Algolia
  search: {
    enable: true
  },
  // 打赏
  rewardData: {
    enable: true,
    // 微信（必须以 / 开头，相对路径会按当前页面拼接导致 404）
    wechat: '/images/logo/wechat.png',
    // 支付宝
    alipay: '/images/logo/alipay.png'
  },
  // 图片灯箱
  fancybox: {
    enable: true,
    js: 'https://mirrors.sustech.edu.cn/cdnjs/ajax/libs/fancyapps-ui/5.0.36/fancybox/fancybox.umd.min.js',
    css: 'https://mirrors.sustech.edu.cn/cdnjs/ajax/libs/fancyapps-ui/5.0.36/fancybox/fancybox.min.css'
  },
  // 外链中转
  jumpRedirect: {
    enable: false,
    // 排除类名
    exclude: [
      'cf-friends-link',
      'upyun',
      'icp',
      'author',
      'rss',
      'cc',
      'power',
      'social-link',
      'link-text',
      'travellings',
      'post-link',
      'report',
      'more-link',
      'skills-item',
      'right-menu-link',
      'link-card'
    ]
  },
  // 站点统计
  tongji: {
    '51la': '3M1I52LMkdPIgpya'
  }
}
