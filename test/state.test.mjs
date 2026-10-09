/** state.ts 单测：node --test 直跑（Node 24 strip-types） */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultLayout, openTab, closeTab, splitPane, moveTab, setRatio,
  collapsePane, countLeaves, primaryPane, activate,
} from '../src/client/layout/state.ts'

test('默认布局 = 单窗格', () => {
  const st = defaultLayout('s1')
  assert.equal(countLeaves(st.tree), 1)
  assert.deepEqual(st.panes[0].tabs, ['s1'])
})

test('openTab：新 tab 入列并激活；已有仅激活', () => {
  let st = openTab(defaultLayout(), 0, 'a')
  st = openTab(st, 0, 'b')
  assert.deepEqual(st.panes[0].tabs, ['a', 'b'])
  assert.equal(st.panes[0].active, 'b')
  st = openTab(st, 0, 'a')
  assert.equal(st.panes[0].active, 'a')
  assert.equal(st.panes[0].tabs.length, 2)
})

test('splitPane：左右分裂后两叶，新窗格聚焦', () => {
  let st = defaultLayout('s1')
  st = splitPane(st, 0, 'row', 's2', true)
  assert.equal(countLeaves(st.tree), 2)
  assert.equal(st.focused, 1)
  assert.deepEqual(st.panes[1].tabs, ['s2'])
  assert.equal(st.tree.t, 'split')
})

test('closeTab：空窗格自动回收 + 下标前移', () => {
  let st = splitPane(defaultLayout('s1'), 0, 'row', 's2', true)
  st = closeTab(st, 1, 's2')
  assert.equal(countLeaves(st.tree), 1)
  assert.equal(st.panes.length, 1)
  assert.deepEqual(st.panes[0].tabs, ['s1'])
})

test('深层分裂后回收中间叶，树引用仍一致', () => {
  let st = splitPane(defaultLayout('a'), 0, 'row', 'b', true)   // [a|b]
  st = splitPane(st, 1, 'col', 'c', true)                        // a | (b/c)
  assert.equal(countLeaves(st.tree), 3)
  st = closeTab(st, 1, 'b')                                      // 收中间叶
  assert.equal(countLeaves(st.tree), 2)
  const leaves = []
  const collect = (n) => { if (n.t === 'leaf') leaves.push(n.p); else { collect(n.a); collect(n.b) } }
  collect(st.tree)
  assert.deepEqual(leaves.sort(), [0, 1])
  assert.equal(st.panes.length, 2)
  assert.deepEqual(st.panes[1].tabs, ['c'])
})

test('moveTab：src 空则回收，dst 收到 tab', () => {
  let st = splitPane(defaultLayout('s1'), 0, 'row', 's2', true)
  st = moveTab(st, 1, 0, 's2')
  assert.equal(countLeaves(st.tree), 1)
  assert.deepEqual(st.panes[0].tabs, ['s1', 's2'])
})

test('setRatio：夹逼在 0.15~0.85', () => {
  let st = splitPane(defaultLayout('a'), 0, 'row', 'b', true)
  st = setRatio(st, [], 9)
  assert.equal(st.tree.s, 0.85)
  st = setRatio(st, [], -9)
  assert.equal(st.tree.s, 0.15)
})

test('collapsePane：并入相邻后单叶', () => {
  let st = splitPane(defaultLayout('a'), 0, 'row', 'b', true)
  st = collapsePane(st, 1)
  assert.equal(countLeaves(st.tree), 1)
  assert.deepEqual(st.panes[0].tabs, ['a', 'b'])
})

test('primaryPane = 最左上叶', () => {
  let st = splitPane(defaultLayout('a'), 0, 'col', 'b', true)
  st = splitPane(st, 0, 'row', 'c', false)
  assert.equal(primaryPane(st.tree), 2) // c 在 (c|a) 的左 = 最左上
})

test('activate 只动焦点与 active，不动 tabs 顺序', () => {
  let st = openTab(openTab(defaultLayout(), 0, 'x'), 0, 'y')
  st = activate(st, 0, 'x')
  assert.equal(st.panes[0].active, 'x')
  assert.deepEqual(st.panes[0].tabs, ['x', 'y'])
})
