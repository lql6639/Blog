/**
 * 外链中转（jumpRedirect）回归测试。
 * 运行：node --test tests/jumpRedirect.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { load } from 'cheerio'
import { jumpRedirect } from '../.vitepress/theme/utils/commonTools.mjs'

const SITE = 'https://blog.lovlin.cn'
const config = (overrides = {}) => ({
  siteMeta: { site: SITE },
  jumpRedirect: { enable: true, exclude: ['no-redirect'], ...overrides }
})

const hrefsOf = (html) => {
  const $ = load(html)
  return $('a')
    .map((_, el) => $(el).attr('href'))
    .get()
}

const decodeTarget = (href) => {
  const value = new URL(href, SITE).searchParams.get('url')
  return Buffer.from(value, 'base64url').toString('utf-8')
}

test('功能关闭时原样返回 HTML', () => {
  const html = '<a target="_blank" href="https://example.com/">外链</a>'
  assert.equal(jumpRedirect(html, config({ enable: false })), html)
})

test('开发模式下不做改写', () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  try {
    const html = '<a target="_blank" href="https://example.com/">外链</a>'
    assert.equal(jumpRedirect(html, config()), html)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
  }
})

test('站外新窗口链接被改写为中转页，并保留原始地址与内部元素', () => {
  const html =
    '<a target="_blank" href="https://example.com/post?a=1&amp;b=2#frag"><span>外链</span></a>'
  const original = 'https://example.com/post?a=1&b=2#frag'
  const $a = load(jumpRedirect(html, config()))('a')
  assert.ok($a.attr('href').startsWith('/redirect.html?url='))
  assert.equal(decodeTarget($a.attr('href')), original)
  assert.equal($a.attr('original-href'), original)
  assert.equal($a.find('span').text(), '外链')
})

test('站内、同域、非新窗口及非 HTTP 链接均不改写', () => {
  const html = [
    '<a target="_blank" href="/posts/a.html">站内</a>',
    '<a target="_blank" href="https://blog.lovlin.cn/about">同域</a>',
    '<a href="https://example.com/">非新窗口</a>',
    '<a target="_blank" href="mailto:hi@example.com">邮件</a>',
    '<a target="_blank" href="javascript:void(0)">脚本</a>'
  ].join('')
  assert.deepEqual(hrefsOf(jumpRedirect(html, config())), [
    '/posts/a.html',
    'https://blog.lovlin.cn/about',
    'https://example.com/',
    'mailto:hi@example.com',
    'javascript:void(0)'
  ])
})

test('排除类名与已中转链接不会被二次改写', () => {
  const html = [
    '<a target="_blank" class="no-redirect" href="https://example.com/">排除</a>',
    '<a target="_blank" href="/redirect.html?url=YWJj">已中转</a>'
  ].join('')
  assert.deepEqual(hrefsOf(jumpRedirect(html, config())), [
    'https://example.com/',
    '/redirect.html?url=YWJj'
  ])
})

test('exclude 缺省时仍可正常工作', () => {
  const html = '<a target="_blank" href="https://example.com/">外链</a>'
  const cfg = { siteMeta: { site: SITE }, jumpRedirect: { enable: true } }
  assert.ok(
    hrefsOf(jumpRedirect(html, cfg))[0].startsWith('/redirect.html?url=')
  )
})
