module.exports = {
  root: true,

  env: {
    browser: true,
    es2021: true,
    node: true
  },

  extends: ['airbnb-base', 'plugin:vue/vue3-essential'],

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },

  plugins: ['vue'],

  overrides: [
    {
      // 配置文件本身为 CommonJS
      files: ['.eslintrc.{js,cjs}', '*.cjs'],
      env: {
        node: true
      },
      parserOptions: {
        sourceType: 'script'
      }
    },
    {
      // 服务端 / 构建期脚本运行在 Node 环境
      files: [
        'api/**/*.ts',
        'functions/**/*.ts',
        '.vitepress/**/*.mjs',
        'page/**/*.mjs',
        'pages/**/*.mjs'
      ],
      env: {
        node: true
      }
    },
    {
      // 测试样本需要构造 javascript: URL 以验证过滤逻辑，并非真实脚本链接
      files: ['tests/**/*.mjs'],
      rules: {
        'no-script-url': 'off'
      }
    }
  ],

  rules: {
    // 导入后缀名
    'import/extensions': 'off',
    // 禁用 console
    'no-console': 'off',

    // 排版统一由 Prettier 负责（singleQuote / semi:false / trailingComma:none）。
    // airbnb-base 的以下规则与 .prettierrc.json 直接冲突：过去 `npm run format`
    // 写出的文件会被 `npm run lint` 判为 error，而 `lint --fix` 又会改回去，
    // 两个脚本互相覆盖。关闭纯排版规则，让 ESLint 只负责代码质量问题。
    semi: 'off',
    quotes: 'off',
    'comma-dangle': 'off',
    'implicit-arrow-linebreak': 'off',
    indent: 'off',
    'no-confusing-arrow': 'off',
    'operator-linebreak': 'off',

    // 仓库在 Windows 上以 core.autocrlf=true 检出，工作区为 CRLF。
    // airbnb-base 默认强制 LF，会导致全仓库每个文件都报错，与本项目
    // 的检出配置冲突。此处改为跟随工作区实际换行符，不检查行尾风格。
    'linebreak-style': 'off'
  }
}
