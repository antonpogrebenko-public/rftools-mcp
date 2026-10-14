// The search index's rules, on their own (openspec agent-surface, design D3).
// src/calculator-search.ts imports nothing from the frontend, so it is tested
// directly here; the ranking against the real catalogue is in
// test/discovery.test.js. agent-remote-mcp reproduces these rules in Python,
// so each one is pinned with an exact expectation.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CalculatorIndex, DEFAULT_LIMIT, MAX_LIMIT, normalise, tokenize } from '../src/calculator-search.ts';

test('Latin text: NFKC, lower case, split on non-letters, accents folded, one plural s dropped, one letter dropped', () => {
  assert.equal(normalise('ＦＲ４ Ｍｉｃｒｏｓｔｒｉｐ'), 'fr4 microstrip');
  assert.deepEqual(tokenize('Microstrip Impedance (FR-4) calculators'), ['microstrip', 'impedance', 'fr', '4', 'calculator']);
  assert.deepEqual(tokenize('Cálculo de pérdidas'), ['calculo', 'de', 'perdida']);
  assert.deepEqual(tokenize('loss bus ohms a Q'), ['loss', 'bus', 'ohm']);
  assert.deepEqual(tokenize("Paul's DM/CM models"), ['paul', 'dm', 'cm', 'model']);
});

test('a decimal point or comma between digits stays in the number', () => {
  assert.deepEqual(tokenize('2.4 GHz and 5,8 GHz, v1.'), ['2.4', 'ghz', 'and', '5,8', 'ghz', 'v1']);
});

test('Japanese and Korean become character bigrams; a lone character is kept', () => {
  assert.deepEqual(tokenize('マイクロストリップ'), ['マイ', 'イク', 'クロ', 'ロス', 'スト', 'トリ', 'リッ', 'ップ']);
  assert.deepEqual(tokenize('ギア比 計算'), ['ギア', 'ア比', '計算']);
  assert.deepEqual(tokenize('임피던스'), ['임피', '피던', '던스']);
  assert.deepEqual(tokenize('八木・宇田'), ['八木', '宇田']);
  assert.deepEqual(tokenize('PT100抵抗'), ['pt100', '抵抗']);
  assert.deepEqual(tokenize('相'), ['相']);
  // Half-width katakana is widened by NFKC before it is split.
  assert.deepEqual(tokenize('ｲﾝﾋﾟｰﾀﾞﾝｽ'), tokenize('インピーダンス'));
});

const DOCS = [
  { slug: 'alpha', category: 'rf', fields: { title: ['Alpha Impedance'], description: ['microstrip lines'] } },
  { slug: 'beta', category: 'pcb', fields: { title: ['Beta Impedance'], keywords: ['microstrip'] } },
  { slug: 'gamma', category: 'pcb', fields: { title: ['Gamma Impedance'] } },
  { slug: 'delta', category: 'pcb', fields: { title: ['Delta Impedance'] } },
];

test('the heavier field wins, rare tokens outweigh common ones, and equal scores keep registry order', () => {
  const index = new CalculatorIndex(DOCS);
  const { hits, matched } = index.search('microstrip impedance');
  // beta has microstrip in keywords (6), alpha only in its description (2).
  assert.deepEqual(hits.map((h) => h.slug), ['beta', 'alpha', 'gamma', 'delta']);
  assert.equal(matched, 4);
  // gamma and delta tie on "impedance" alone and keep their order.
  assert.equal(hits[2].score, hits[3].score);
  // idf: ln(1 + 4/4) for impedance, ln(1 + 4/2) for microstrip.
  assert.equal(hits[0].score, Math.round((10 * Math.log(2) + 6 * Math.log(3)) * 1e6) / 1e6);
});

test('a token counts once per calculator, at its best field', () => {
  const index = new CalculatorIndex([
    { slug: 'twice', category: 'rf', fields: { title: ['Balun'], keywords: ['balun', 'balun'], description: ['balun'] } },
    { slug: 'other', category: 'rf', fields: { title: ['Other'] } },
  ]);
  assert.equal(index.search('balun balun').hits[0].score, Math.round(10 * Math.log(3) * 1e6) / 1e6);
});

test('category filters, limit cuts, and nothing matched is no hits', () => {
  const index = new CalculatorIndex(DOCS);
  assert.deepEqual(index.search('impedance', { category: 'pcb' }).hits.map((h) => h.slug), ['beta', 'gamma', 'delta']);
  assert.equal(index.search('impedance', { limit: 2 }).hits.length, 2);
  assert.equal(index.search('impedance', { limit: 99 }).hits.length, Math.min(4, MAX_LIMIT));
  assert.deepEqual(index.search('optics'), { hits: [], matched: 0 });
  assert.deepEqual(index.search('!!!'), { hits: [], matched: 0 });
  assert.equal(DEFAULT_LIMIT, 10);
  assert.equal(MAX_LIMIT, 25);
});

test('the same query gives the same answer every time', () => {
  const a = new CalculatorIndex(DOCS).search('impedance microstrip');
  const b = new CalculatorIndex(DOCS).search('microstrip impedance impedance');
  assert.deepEqual(a, b);
});
