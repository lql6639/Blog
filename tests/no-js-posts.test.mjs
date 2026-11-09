/**
 * 无 JavaScript 回归测试：文章列表与分页必须由构建产物直接输出静态 <a href>，
 * 关闭 JS 后仍可浏览与翻页。由 `npm run test:nojs` 在 vitepress build 之后调用。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = path.join(ROOT, '.vitepress', 'dist')

const readPage = (rel) => {
  const file = path.join(DIST, rel)
  assert.ok(fs.existsSync(file), `缺少构建产物 ${rel}，请先运行 npm run build`)
  return load(fs.readFileSync(file, 'utf8'))
}

const linksTo = ($, prefix) =>
  Array.from(
    new Set(
      $('a[href]')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter((href) => typeof href === 'string' && href.startsWith(prefix))
    )
  )

// cleanUrls 关闭扩展名：/page/2 → page/2.html，/posts/a.html → posts/a.html
const distFileFor = (href) => {
  const pathname = decodeURIComponent(
    new URL(href, 'https://static.test').pathname
  )
  const rel = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  const base = path.resolve(DIST, rel || 'index')
  if (!base.startsWith(DIST + path.sep)) return undefined
  return [base, `${base}.html`, path.join(base, 'index.html')].find(
    (entry) => entry.endsWith('.html') && fs.existsSync(entry)
  )
}

const assertStaticLinks = ($, prefix, label) => {
  const links = linksTo($, prefix)
  assert.ok(links.length > 0, `${label} 未静态输出任何 ${prefix} 链接`)
  links.forEach((href) => {
    assert.ok(
      distFileFor(href),
      `${label} 的链接 ${href} 在构建产物中找不到对应页面`
    )
  })
  return links
}

const htmlFilesIn = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
        .map((entry) => path.join(dir, entry.name))
    : []

test('构建产物已生成', () => {
  assert.ok(
    fs.existsSync(path.join(DIST, 'index.html')),
    '请先运行 npm run build 再执行测试'
  )
})

test('首页静态输出文章链接与分页入口', () => {
  const $ = readPage('index.html')
  assertStaticLinks($, '/posts/', '首页')
  assertStaticLinks($, '/page/', '首页分页')
})

test('每个真实分页页都静态输出文章链接，且分页导航可达', () => {
  const pages = htmlFilesIn(path.join(DIST, 'page')).filter(
    (file) =>
      /^\d+\.html$/.test(path.basename(file)) &&
      path.basename(file) !== '1.html'
  )
  assert.ok(pages.length > 0, '未生成任何真实分页页')
  pages.forEach((file) => {
    const label = `分页 ${path.basename(file)}`
    const $ = load(fs.readFileSync(file, 'utf8'))
    assertStaticLinks($, '/posts/', label)
    assertStaticLinks($, '/page/', `${label} 导航`)
  })
})

test('归档页静态输出完整文章索引', () => {
  const $ = readPage('pages/archives.html')
  const links = assertStaticLinks($, '/posts/', '归档页')
  const homeLinks = linksTo(readPage('index.html'), '/posts/')
  assert.ok(links.length >= homeLinks.length, '归档页的文章链接不应少于首页')
})

test('分类总览页与每个分类页都静态可达', () => {
  assertStaticLinks(
    readPage('pages/categories.html'),
    '/pages/categories/',
    '分类总览'
  )
  htmlFilesIn(path.join(DIST, 'pages', 'categories')).forEach((file) => {
    assertStaticLinks(
      load(fs.readFileSync(file, 'utf8')),
      '/posts/',
      `分类页 ${path.basename(file)}`
    )
  })
})

test('标签总览页与每个标签页都静态可达', () => {
  assertStaticLinks(readPage('pages/tags.html'), '/pages/tags/', '标签总览')
  htmlFilesIn(path.join(DIST, 'pages', 'tags')).forEach((file) => {
    assertStaticLinks(
      load(fs.readFileSync(file, 'utf8')),
      '/posts/',
      `标签页 ${path.basename(file)}`
    )
  })
})

test('分页链路连续：首页页码范围内的每一页都有产物', () => {
  const numbers = linksTo(readPage('index.html'), '/page/')
    .map((href) => Number(href.match(/\/page\/(\d+)/)?.[1]))
    .filter(Number.isFinite)
  assert.ok(numbers.length > 0, '首页未输出任何分页页码链接')
  const maxPage = Math.max(...numbers)
  for (let page = 2; page <= maxPage; page += 1) {
    assert.ok(
      distFileFor(`/page/${page}`),
      `缺少第 ${page} 页产物，分页链路中断`
    )
  }
})
