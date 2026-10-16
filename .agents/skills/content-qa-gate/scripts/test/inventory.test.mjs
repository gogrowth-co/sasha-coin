// node --test scripts/test/*.test.mjs : the measured "is this new?" check (2026-10-09), calibrated on real EkkoGreen cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokens, overlap, matches } from '../inventory.mjs';

test('accents, plurals, stopwords and word families normalize to the same subject', () => {
  assert.deepEqual([...tokens('Compostagem sem cheiro')], [...tokens('compostagens sem cheiros')]);
  assert.ok(tokens('composteira').has([...tokens('compostagem')][0]));            // compost-
  assert.ok(tokens('Carros Elétricos').has('carro') && tokens('Carros Elétricos').has('eletric'));
  assert.equal(tokens('como começar em casa: dicas').size, 1);                      // only "casa" carries meaning
});

test('the composting pin group repeats the July pins; the EV apartment group does not repeat anything', () => {
  const inv = [
    { source: 'published', channel: 'pinterest', date: '2026-07-24', title: '3 sinais de que sua composteira perdeu o equilíbrio', text: '3 sinais de que sua composteira perdeu o equilíbrio compostagem sem cheiro' },
    { source: 'published', channel: 'pinterest', date: '2026-08-24', title: 'Fiat estuda carro elétrico popular', text: 'Fiat Estuda Produzir Carro Elétrico Popular no Brasil' },
  ];
  const day = (d) => ({ ...inv[0], date: d });
  assert.equal(matches(inv, 'Grupo compostagem sem cheiro', { channel: 'pinterest' })[0].score, 1);
  assert.ok(matches(inv, 'Grupo carro elétrico em apartamento', { channel: 'pinterest' })[0].score < 0.75);
  assert.equal(matches([day('2025-01-01')], 'compostagem sem cheiro', { channel: 'pinterest', sinceDays: 365 }).length, 0);   // older than the window
});

test('one shared word is never a repeat', () => {
  assert.ok(overlap('turbina eólica residencial', 'turbina de avião').score < 0.75);
});
