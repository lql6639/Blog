import fs from 'fs-extra'

// 单篇正文入索引的最大字数（超出截断，控制索引体积）
const MAX_TEXT = 4000

/**
 * 把 Markdown 原文压成可搜索的纯文本
 * @param {string} raw - 文件原始内容
 * @returns {string}
 */
const stripMarkdown = (raw) =>
  String(raw)
    // frontmatter
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    // 代码块（含 ``` 与 ~~~）
    .replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1/gm, ' ')
    // HTML 注释 / 标签
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    // 图片、链接（链接只留文字）
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 标题、引用、列表符号
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
    .replace(/^[ \t]{0,3}([-*+]|\d+\.)[ \t]+/gm, '')
    // 表格竖线、强调符号、行内代码
    .replace(/[|*_~`]/g, ' ')
    // 压缩空白
    .replace(/\s+/g, ' ')
    .trim()

/**
 * 由文章元数据生成全站搜索索引
 * @param {Object[]} postData - getAllPosts() 的结果
 * @returns {Promise<Object[]>}
 */
export const getSearchIndex = async (postData = []) => {
  const index = await Promise.all(
    postData.map(async (post) => {
      const regularPath = post.regularPath || ''
      // /posts/2025/0608.html -> posts/2025/0608.md
      const file = regularPath.replace(/^\//, '').replace(/\.html$/, '.md')
      let text = ''
      try {
        if (await fs.pathExists(file)) {
          text = stripMarkdown(await fs.readFile(file, 'utf-8'))
        }
      } catch (error) {
        console.warn(`[search] 读取 ${file} 正文失败，仅索引标题与标签`, error)
      }

      return {
        path: regularPath,
        title: post.title || '未命名文章',
        date: post.date || 0,
        tags: post.tags || [],
        categories: post.categories || [],
        description: post.description || '',
        text: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text
      }
    })
  )

  return index.filter((item) => item.path)
}
