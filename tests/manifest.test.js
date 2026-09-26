import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Chrome Web Store / Manifest V3 readiness checks for what we ship.
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const shipped = ['newtab.html', 'privacy.html', 'background.js', ...walk('src')];

test('manifest is MV3 with store-sized name, description and icons', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name.length <= 75, 'name ≤ 75 characters');
  assert.ok(manifest.description.length <= 132, 'description ≤ 132 characters');
  assert.match(manifest.version, /^\d+(\.\d+){0,3}$/);
  for (const size of ['16', '32', '48', '128']) assert.ok(existsSync(manifest.icons[size]), `icon ${size} exists`);
});

test('permissions stay minimal', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['alarms', 'identity', 'storage']);
  assert.deepEqual(manifest.optional_permissions, ['notifications']);
  assert.equal(manifest.host_permissions, undefined, 'no host permissions — every API used allows CORS');
  assert.equal(manifest.content_scripts, undefined);
});

test('every file the manifest or pages reference exists and is packaged', () => {
  const zip = pkg.scripts.zip;
  for (const f of ['newtab.html', 'privacy.html', 'background.js', 'src', 'icons']) assert.ok(zip.includes(f), `zip includes ${f}`);
  assert.ok(existsSync(manifest.chrome_url_overrides.newtab));
  assert.ok(existsSync(manifest.background.service_worker));
});

test('no remote code, inline scripts, eval or HTML injection', () => {
  for (const file of shipped.filter((f) => /\.(html|js)$/.test(f))) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /<script[^>]*src=["']https?:/i, `${file}: remote script`);
    assert.doesNotMatch(src, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/i, `${file}: inline script (blocked by MV3 CSP)`);
    assert.doesNotMatch(src, /\beval\(|new Function\(|\.innerHTML\s*=|insertAdjacentHTML|document\.write/, `${file}: dynamic code / HTML injection`);
    assert.doesNotMatch(src, /import\s*\(\s*["']https?:/, `${file}: remote import`);
  }
});

test('network calls only go to disclosed services', () => {
  const allowed = [/^https:\/\/(www|oauth2)\.googleapis\.com\//, /^https:\/\/api\.open-meteo\.com\//, /^https:\/\/geocoding-api\.open-meteo\.com\//];
  for (const file of shipped.filter((f) => f.endsWith('.js'))) {
    for (const [, url] of readFileSync(file, 'utf8').matchAll(/fetch\(\s*[`'"](https?:\/\/[^`'"$]+)/g)) {
      assert.ok(
        allowed.some((re) => re.test(url)),
        `${file}: undisclosed network call to ${url}`,
      );
    }
  }
  const privacy = readFileSync('privacy.html', 'utf8');
  for (const name of ['Open-Meteo', 'Google Drive', 'calendar.readonly', 'Limited Use']) assert.ok(privacy.includes(name), `privacy policy mentions ${name}`);
});

test('current-location name comes from the time zone, offline', async () => {
  globalThis.document ??= { documentElement: { dataset: {}, style: { setProperty() {} } }, querySelector: () => null };
  const { placeFromTimeZone } = await import('../src/services/weather.js');
  assert.equal(placeFromTimeZone('Asia/Kolkata'), 'Kolkata');
  assert.equal(placeFromTimeZone('America/New_York'), 'New York');
  assert.equal(placeFromTimeZone('America/Argentina/Buenos_Aires'), 'Buenos Aires');
  assert.equal(placeFromTimeZone('UTC'), 'Current location');
  assert.equal(placeFromTimeZone('Etc/GMT+5'), 'Current location');
});
