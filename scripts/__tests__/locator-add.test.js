/**
 * Tests for /devkit:locator-add transform.
 *
 * Each test case has an `<Name>.input.tsx` fixture and (optionally) an
 * `<Name>.output.tsx` expected fixture. We run the transform on the input
 * and compare to the expected output. If no output fixture is provided,
 * we expect the transform to return null (no changes).
 */

const fs = require('fs');
const path = require('path');
const jscodeshift = require('jscodeshift');
const transformer = require('../locator-add');

const FIXTURES_DIR = path.join(__dirname, '__testfixtures__');

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function runTransform(inputName, options = {}) {
  const source = readFixture(inputName);
  const filePath = path.join(FIXTURES_DIR, inputName);
  // Use the tsx parser explicitly so jscodeshift handles TS + JSX.
  const j = jscodeshift.withParser('tsx');
  return transformer(
    { source, path: filePath },
    { jscodeshift: j, j, stats: () => {}, report: () => {} },
    { naming: 'role', ...options },
  );
}

function normalize(s) {
  if (s === null || s === undefined) return '';
  // Collapse whitespace differences for tolerant comparison — recast's output
  // can have minor whitespace variation across versions.
  return s.replace(/\s+/g, ' ').trim();
}

describe('locator-add transform', () => {
  test('Button — adds testID derivation from text prop', () => {
    const out = runTransform('Button.input.tsx');
    const expected = readFixture('Button.output.tsx');
    expect(normalize(out)).toBe(normalize(expected));
  });

  test('TextInput — derives testID from placeholder prop', () => {
    const out = runTransform('TextInput.input.tsx');
    const expected = readFixture('TextInput.output.tsx');
    expect(normalize(out)).toBe(normalize(expected));
  });

  test('EstItem — list-row pattern: hardcoded role + accessibilityLabel from name prop', () => {
    const out = runTransform('EstItemRow.input.tsx');
    const expected = readFixture('EstItemRow.output.tsx');
    expect(normalize(out)).toBe(normalize(expected));
  });

  test('AlreadyInstrumented — idempotent (no changes on re-run)', () => {
    const out = runTransform('AlreadyInstrumented.input.tsx');
    expect(out).toBeNull();
  });

  test('NotAComponent — utility/type files are skipped', () => {
    const out = runTransform('NotAComponent.input.tsx');
    expect(out).toBeNull();
  });

  test('CrossFileType — skips component when props type is in another file', () => {
    const errors = [];
    const origWrite = process.stderr.write;
    process.stderr.write = (msg) => {
      errors.push(String(msg));
      return true;
    };
    let out;
    try {
      out = runTransform('CrossFileType.input.tsx');
    } finally {
      process.stderr.write = origWrite;
    }
    expect(out).toBeNull();
    expect(errors.join('')).toMatch(/Skipping Button: props type defined in a different file/);
  });
});

describe('locator-add option validation', () => {
  test('rejects invalid --naming value', () => {
    expect(() => runTransform('Button.input.tsx', { naming: 'bogus' })).toThrow(
      /Invalid --naming/,
    );
  });

  test('warns and falls back to role for --naming=screen', () => {
    const errors = [];
    const origWrite = process.stderr.write;
    process.stderr.write = (msg) => errors.push(String(msg));
    try {
      runTransform('Button.input.tsx', { naming: 'screen' });
    } finally {
      process.stderr.write = origWrite;
    }
    expect(errors.join('')).toMatch(/no-op in library mode/);
  });
});
