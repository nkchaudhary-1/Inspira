import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherIconName } from '../src/ui/weatherIcons.js';

test('every WMO code maps to a kit icon, with night variants', () => {
  const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  for (const c of codes) assert.ok(weatherIconName(c), `code ${c}`);
  assert.equal(weatherIconName(0, true), 'sunny');
  assert.equal(weatherIconName(0, false), 'clearNight');
  assert.equal(weatherIconName(2, false), 'partlyCloudyNight');
  assert.equal(weatherIconName(3, false), 'cloudy');
  assert.equal(weatherIconName(96), 'thunderRain');
  assert.equal(weatherIconName(1234), 'cloudy');
});
