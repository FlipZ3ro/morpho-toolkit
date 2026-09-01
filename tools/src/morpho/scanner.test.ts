import assert from 'node:assert/strict';
import test from 'node:test';
import { meetsUsdThreshold } from './scanner.js';

test('meetsUsdThreshold handles six-decimal stablecoins exactly', () => {
  assert.equal(meetsUsdThreshold(100_000_000_000n, 6, 1, 100_000), true);
  assert.equal(meetsUsdThreshold(99_999_999_999n, 6, 1, 100_000), false);
});

test('meetsUsdThreshold includes token price', () => {
  assert.equal(meetsUsdThreshold(40n * 10n ** 18n, 18, 2_500, 100_000), true);
  assert.equal(meetsUsdThreshold(39n * 10n ** 18n, 18, 2_500, 100_000), false);
});

test('meetsUsdThreshold rejects invalid inputs', () => {
  assert.equal(meetsUsdThreshold(1n, 18, 0, 100_000), false);
  assert.equal(meetsUsdThreshold(-1n, 18, 1, 100_000), false);
});
