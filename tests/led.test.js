import test from 'node:test';
import assert from 'node:assert/strict';
import { led } from '../src/led.js';

test('favourite destination stars and status separators have their own LED glyphs', () => {
  assert.notEqual(led('★'), led('?'));
  assert.notEqual(led('·'), led('?'));
  assert.notEqual(led('Birmingham New Street ★'), led('Birmingham New Street ?'));
});
