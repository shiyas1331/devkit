/**
 * /devkit:locator-add — jscodeshift transform
 *
 * Instruments React Native library components by:
 *   1. Adding `testID?: string` and `accessibilityLabel?: string` to the props interface/type
 *   2. Adding both to the parameter destructure
 *   3. Forwarding both to the JSX root native primitive
 *   4. Inserting a derivation fallback: testID ?? deriveTestId(<text-prop>, '<suffix>')
 *   5. Adding an import for `deriveTestId` from the library helper
 *
 * Library mode only (v1). App / consumer code is not in scope.
 *
 * Idempotent — re-running on an instrumented file produces no changes.
 *
 * Usage:
 *   npx jscodeshift -t scripts/locator-add.js --parser=tsx \
 *     --extensions=tsx,jsx,ts,js [--dry] --naming=role <path>
 */

'use strict';

const path = require('path');
const fs = require('fs');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Native primitives we recognize as instrumentable JSX roots. */
const NATIVE_PRIMITIVES = new Set([
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'Pressable',
  'View',
  'ScrollView',
  'TextInput',
  'Switch',
  'Image',
  'FlatList',
  'SectionList',
]);

/** Map a native primitive to a suffix used in derived testIDs. */
const SUFFIX_BY_PRIMITIVE = {
  TouchableOpacity: 'button',
  TouchableHighlight: 'button',
  TouchableWithoutFeedback: 'button',
  Pressable: 'button',
  View: 'container',
  ScrollView: 'scroll',
  TextInput: 'input',
  Switch: 'switch',
  Image: 'image',
  FlatList: 'list',
  SectionList: 'list',
};

/** Props the transform searches for to derive a testID. Order = priority. */
const TEXT_PROP_PRIORITY = ['text', 'label', 'placeholder', 'accessibilityLabel', 'title'];

/** Pattern to detect list-row component names. */
const LIST_ROW_NAME_PATTERN = /(Item|Row|Card)$/;

/** Props that signal a list-row component and serve as its accessibilityLabel source. */
const LIST_ROW_NAME_PROP_PRIORITY = ['name', 'estName', 'doctorName', 'title', 'label', 'text'];

// -----------------------------------------------------------------------------
// Transform entry
// -----------------------------------------------------------------------------

module.exports = function transformer(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);
  const opts = parseOptions(options);

  // Find candidate component definitions.
  const candidates = findComponentCandidates(j, root);
  if (candidates.length === 0) {
    return null; // No-op — file isn't a component file (or has no eligible components).
  }

  let modified = false;
  let importNeeded = false;

  for (const candidate of candidates) {
    const result = instrumentComponent(j, root, candidate, opts, file.path);
    if (result.modified) modified = true;
    if (result.importNeeded) importNeeded = true;
  }

  if (importNeeded) {
    addDeriveTestIdImport(j, root, file.path);
    modified = true;
  }

  return modified ? root.toSource({ quote: 'single' }) : null;
};

// -----------------------------------------------------------------------------
// Option parsing
// -----------------------------------------------------------------------------

function parseOptions(options) {
  const naming = options.naming || 'role';
  if (!['role', 'screen', 'full'].includes(naming)) {
    throw new Error(`Invalid --naming value: ${naming}. Must be role, screen, or full.`);
  }
  // For library mode v1, only `role` is meaningful. Warn but proceed for screen/full.
  if (naming !== 'role') {
    process.stderr.write(
      `[locator-add] Warning: --naming=${naming} is a no-op in library mode v1. Using role.\n`,
    );
  }
  return { naming: 'role' };
}

// -----------------------------------------------------------------------------
// Component candidate detection
// -----------------------------------------------------------------------------

/**
 * Find exported components that are good candidates for instrumentation.
 * A candidate is:
 *   - A named export of an arrow function or function declaration
 *   - Whose JSX return root is a native primitive in NATIVE_PRIMITIVES
 *   - That receives at least one props parameter
 */
function findComponentCandidates(j, root) {
  const candidates = [];

  // Variable declarations: `export const Foo = (props) => <View />`
  root
    .find(j.VariableDeclaration)
    .filter((p) => isExported(p))
    .forEach((path) => {
      for (const decl of path.value.declarations) {
        if (
          decl.init &&
          (decl.init.type === 'ArrowFunctionExpression' ||
            decl.init.type === 'FunctionExpression')
        ) {
          const candidate = analyzeComponent(j, decl.id, decl.init);
          if (candidate) {
            candidate.declarationPath = path;
            candidates.push(candidate);
          }
        }
      }
    });

  // Function declarations: `export function Foo(props) { return <View />; }`
  root
    .find(j.FunctionDeclaration)
    .filter((p) => isExported(p))
    .forEach((path) => {
      const candidate = analyzeComponent(j, path.value.id, path.value);
      if (candidate) {
        candidate.declarationPath = path;
        candidates.push(candidate);
      }
    });

  return candidates;
}

function isExported(path) {
  // Accept either:
  //   - direct `export const Foo = ...` / `export function Foo()`
  //   - `const Foo = ...; export { Foo }` / `export default Foo`
  // (We're permissive here — the file-level filter is "has at least one export.")
  let parent = path.parent;
  while (parent) {
    if (
      parent.value &&
      (parent.value.type === 'ExportNamedDeclaration' ||
        parent.value.type === 'ExportDefaultDeclaration')
    ) {
      return true;
    }
    parent = parent.parent;
  }
  // Also check sibling export specifiers in the file.
  // Cheaper heuristic: if the parent is Program and there's any export referencing this name, it counts.
  // For simplicity in v1, we only treat directly-exported declarations as candidates.
  return false;
}

/**
 * Analyze a function/arrow expression to see if it's an instrumentable component.
 * Returns a candidate descriptor or null.
 */
function analyzeComponent(j, idNode, fnNode) {
  if (!idNode || idNode.type !== 'Identifier') return null;
  const name = idNode.name;

  // Component name should be capitalized (React convention).
  if (!/^[A-Z]/.test(name)) return null;

  // Must have at least one parameter (props).
  if (fnNode.params.length === 0) return null;

  // Find the JSX root of the return value.
  const jsxRoot = findJsxReturnRoot(j, fnNode.body);
  if (!jsxRoot) return null;

  // The JSX root must be a native primitive.
  const rootName = getJsxElementName(jsxRoot);
  if (!rootName || !NATIVE_PRIMITIVES.has(rootName)) return null;

  // Determine if this looks like a list-row component.
  const isListRow = LIST_ROW_NAME_PATTERN.test(name);

  return {
    name,
    fnNode,
    jsxRoot,
    rootName,
    isListRow,
  };
}

/**
 * Find the JSX element returned by a function body. Handles:
 *   - Arrow function expression body: `(props) => <View />`
 *   - Block body with a single return: `(props) => { return <View />; }`
 */
function findJsxReturnRoot(j, body) {
  if (!body) return null;

  // Direct JSX return: arrow with expression body
  if (body.type === 'JSXElement' || body.type === 'JSXFragment') {
    return body.type === 'JSXElement' ? body : null;
  }

  // Parenthesized JSX
  if (body.type === 'ParenthesizedExpression') {
    return findJsxReturnRoot(j, body.expression);
  }

  // Block statement — find the (last) return statement
  if (body.type === 'BlockStatement') {
    for (let i = body.body.length - 1; i >= 0; i--) {
      const stmt = body.body[i];
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        return findJsxReturnRoot(j, stmt.argument);
      }
    }
  }

  return null;
}

function getJsxElementName(jsxElement) {
  if (!jsxElement || jsxElement.type !== 'JSXElement') return null;
  const opening = jsxElement.openingElement;
  if (!opening || !opening.name) return null;
  if (opening.name.type === 'JSXIdentifier') return opening.name.name;
  return null;
}

// -----------------------------------------------------------------------------
// Instrumentation
// -----------------------------------------------------------------------------

/**
 * Instrument one component candidate. Mutates the AST in place.
 * Returns { modified, importNeeded }.
 */
function instrumentComponent(j, root, candidate, opts, filePath) {
  const result = { modified: false, importNeeded: false };

  // Step 1: Try to update the props type. If the param has a type annotation
  // referencing a name that isn't declared in this file, we can't safely add
  // fields — modifying the destructure would produce a TS error. Skip the
  // component entirely in that case.
  const typeResult = ensurePropsTypeFields(j, root, candidate);
  if (typeResult.status === 'cross-file') {
    process.stderr.write(
      `[locator-add] Skipping ${candidate.name}: props type defined in a different file. Add testID?: string and accessibilityLabel?: string to the type manually, then re-run.\n`,
    );
    return result;
  }

  // Step 2: Ensure parameter destructure includes testID and accessibilityLabel.
  const destructureAdded = ensureDestructure(j, candidate);

  // Step 3: Inject testID and accessibilityLabel into the JSX root.
  const jsxAdded = ensureJsxAttributes(j, candidate);

  if (typeResult.modified || destructureAdded || jsxAdded) {
    result.modified = true;
  }

  // We need the deriveTestId import only if we inserted a derivation expression
  // (not for list-row components — they hardcode the role string).
  if (jsxAdded && !candidate.isListRow && candidate.derivationSource) {
    result.importNeeded = true;
  }

  return result;
}

/**
 * Ensure the component's props type has testID and accessibilityLabel fields.
 * Searches for:
 *   - TS type annotation on the parameter (interface or type alias referenced by name)
 *   - Inline type annotation on the parameter
 * If neither is found (e.g., plain JS), we skip — destructure handles it.
 */
/**
 * Ensure the props type has testID/accessibilityLabel fields.
 * Returns { status, modified }:
 *   status:
 *     'in-file'    — type was found in this file (or there's no type annotation)
 *     'cross-file' — type reference points to a name not declared in this file
 *     'unsupported'— intersection / generic / other shape we don't handle in v1
 *   modified: true if any field was actually added; false if nothing changed.
 */
function ensurePropsTypeFields(j, root, candidate) {
  const param = candidate.fnNode.params[0];
  if (!param) return { status: 'in-file', modified: false };

  const typeAnnotation = param.typeAnnotation && param.typeAnnotation.typeAnnotation;
  if (!typeAnnotation) return { status: 'in-file', modified: false };

  // Case A: type reference — `: ButtonProps`
  if (typeAnnotation.type === 'TSTypeReference' && typeAnnotation.typeName.type === 'Identifier') {
    const typeName = typeAnnotation.typeName.name;
    const r = ensureFieldsInDeclaredType(j, root, typeName);
    return r.found
      ? { status: 'in-file', modified: r.modified }
      : { status: 'cross-file', modified: false };
  }

  // Case B: inline type literal — `: { foo: string }`
  if (typeAnnotation.type === 'TSTypeLiteral') {
    const modified = ensureFieldsInTypeLiteral(j, typeAnnotation);
    return { status: 'in-file', modified };
  }

  // Other shapes (intersection, generic) — skip in v1.
  return { status: 'unsupported', modified: false };
}

/** Returns { found, modified } where found = type declaration was located in this file. */
function ensureFieldsInDeclaredType(j, root, typeName) {
  let found = false;
  let modified = false;

  root
    .find(j.TSInterfaceDeclaration, { id: { name: typeName } })
    .forEach((path) => {
      found = true;
      if (addOptionalStringField(j, path.value.body.body, 'testID')) modified = true;
      if (addOptionalStringField(j, path.value.body.body, 'accessibilityLabel')) modified = true;
    });

  root
    .find(j.TSTypeAliasDeclaration, { id: { name: typeName } })
    .forEach((path) => {
      found = true;
      const tn = path.value.typeAnnotation;
      if (tn.type === 'TSTypeLiteral') {
        if (ensureFieldsInTypeLiteral(j, tn)) modified = true;
      }
    });

  return { found, modified };
}

function ensureFieldsInTypeLiteral(j, typeLiteral) {
  let modified = false;
  if (addOptionalStringField(j, typeLiteral.members, 'testID')) modified = true;
  if (addOptionalStringField(j, typeLiteral.members, 'accessibilityLabel')) modified = true;
  return modified;
}

function addOptionalStringField(j, members, fieldName) {
  // Skip if already present.
  for (const m of members) {
    if (
      m.type === 'TSPropertySignature' &&
      m.key &&
      m.key.type === 'Identifier' &&
      m.key.name === fieldName
    ) {
      return false;
    }
  }
  const sig = j.tsPropertySignature(
    j.identifier(fieldName),
    j.tsTypeAnnotation(j.tsStringKeyword()),
  );
  sig.optional = true;
  members.push(sig);
  return true;
}

/**
 * Ensure the parameter's destructure pattern includes testID and accessibilityLabel.
 */
function ensureDestructure(j, candidate) {
  const param = candidate.fnNode.params[0];
  if (!param) return false;
  if (param.type !== 'ObjectPattern') return false;

  let modified = false;
  for (const fieldName of ['testID', 'accessibilityLabel']) {
    const present = param.properties.some(
      (p) =>
        p.type === 'ObjectProperty' &&
        p.key &&
        p.key.type === 'Identifier' &&
        p.key.name === fieldName,
    );
    if (!present) {
      const prop = j.objectProperty(j.identifier(fieldName), j.identifier(fieldName));
      prop.shorthand = true;
      param.properties.push(prop);
      modified = true;
    }
  }
  return modified;
}

/**
 * Inject testID and accessibilityLabel attributes into the JSX root element.
 * For non-list-row components: testID = `testID ?? deriveTestId(<source>, '<suffix>')`
 * For list-row components: testID = `testID ?? '<role>-row'`, accessibilityLabel = `accessibilityLabel ?? <name-prop>`
 */
function ensureJsxAttributes(j, candidate) {
  const opening = candidate.jsxRoot.openingElement;
  if (!opening) return false;

  // Skip if testID already present.
  const hasTestID = opening.attributes.some(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'testID',
  );
  const hasA11yLabel = opening.attributes.some(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'accessibilityLabel',
  );

  if (hasTestID && hasA11yLabel) return false;

  let modified = false;

  if (candidate.isListRow) {
    // List-row pattern: hardcoded role testID, name-prop forwarded to accessibilityLabel.
    const roleString = listRowRoleString(candidate.name);
    const nameProp = findListRowNameProp(candidate);

    if (!hasTestID) {
      const expr = j.logicalExpression(
        '??',
        j.identifier('testID'),
        j.literal(roleString),
      );
      opening.attributes.push(
        j.jsxAttribute(j.jsxIdentifier('testID'), j.jsxExpressionContainer(expr)),
      );
      modified = true;
    }
    if (!hasA11yLabel) {
      const labelExpr = nameProp
        ? j.logicalExpression('??', j.identifier('accessibilityLabel'), j.identifier(nameProp))
        : j.identifier('accessibilityLabel');
      opening.attributes.push(
        j.jsxAttribute(
          j.jsxIdentifier('accessibilityLabel'),
          j.jsxExpressionContainer(labelExpr),
        ),
      );
      modified = true;
    }
  } else {
    // Standard pattern: derive from text/label/placeholder/etc.
    const source = findDerivationSource(candidate);
    candidate.derivationSource = source;
    const suffix = SUFFIX_BY_PRIMITIVE[candidate.rootName] || 'element';

    if (!hasTestID) {
      let expr;
      if (source) {
        expr = j.logicalExpression(
          '??',
          j.identifier('testID'),
          j.callExpression(j.identifier('deriveTestId'), [
            j.identifier(source),
            j.literal(suffix),
          ]),
        );
      } else {
        // No derivation source — just forward testID without a fallback.
        expr = j.identifier('testID');
      }
      opening.attributes.push(
        j.jsxAttribute(j.jsxIdentifier('testID'), j.jsxExpressionContainer(expr)),
      );
      modified = true;
    }
    if (!hasA11yLabel) {
      opening.attributes.push(
        j.jsxAttribute(
          j.jsxIdentifier('accessibilityLabel'),
          j.jsxExpressionContainer(j.identifier('accessibilityLabel')),
        ),
      );
      modified = true;
    }
  }

  return modified;
}

function findDerivationSource(candidate) {
  // Look in the destructure for a prop matching TEXT_PROP_PRIORITY.
  const param = candidate.fnNode.params[0];
  if (!param || param.type !== 'ObjectPattern') return null;
  const present = new Set(
    param.properties
      .filter((p) => p.type === 'ObjectProperty' && p.key.type === 'Identifier')
      .map((p) => p.key.name),
  );
  for (const candidateProp of TEXT_PROP_PRIORITY) {
    if (present.has(candidateProp)) return candidateProp;
  }
  return null;
}

function findListRowNameProp(candidate) {
  const param = candidate.fnNode.params[0];
  if (!param || param.type !== 'ObjectPattern') return null;
  const present = new Set(
    param.properties
      .filter((p) => p.type === 'ObjectProperty' && p.key.type === 'Identifier')
      .map((p) => p.key.name),
  );
  for (const candidateProp of LIST_ROW_NAME_PROP_PRIORITY) {
    if (present.has(candidateProp)) return candidateProp;
  }
  return null;
}

function listRowRoleString(componentName) {
  // Strip Item/Row/Card suffix, kebab-case the rest, append `-row`.
  const stripped = componentName.replace(/(Item|Row|Card)$/, '');
  const kebab = stripped
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
  return `${kebab}-row`;
}

// -----------------------------------------------------------------------------
// Import management
// -----------------------------------------------------------------------------

/**
 * Add `import { deriveTestId } from '<relative-path-to-locator>'` to the file
 * if it isn't already present.
 */
function addDeriveTestIdImport(j, root, filePath) {
  // Skip if already imported.
  const existing = root.find(j.ImportDeclaration).filter((p) => {
    return p.value.specifiers.some(
      (s) =>
        s.type === 'ImportSpecifier' &&
        s.imported &&
        s.imported.name === 'deriveTestId',
    );
  });
  if (existing.size() > 0) return;

  const relImport = computeRelativeHelperImport(filePath);
  const importDecl = j.importDeclaration(
    [j.importSpecifier(j.identifier('deriveTestId'))],
    j.literal(relImport),
  );

  // Insert after the last existing import, or at the top of the file.
  const program = root.find(j.Program).get(0).node;
  const imports = program.body.filter((n) => n.type === 'ImportDeclaration');
  if (imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const idx = program.body.indexOf(lastImport);
    program.body.splice(idx + 1, 0, importDecl);
  } else {
    program.body.unshift(importDecl);
  }
}

/**
 * Compute a relative import path from the source file to <library-root>/src/utils/locator
 * (without the file extension).
 *
 * Strategy: walk upward from the source file until we find `src/`, then point at
 * `src/utils/locator` from there.
 */
function computeRelativeHelperImport(filePath) {
  const abs = path.resolve(filePath);
  const dir = path.dirname(abs);

  // Find the nearest ancestor `src` directory.
  let cursor = dir;
  let srcDir = null;
  while (cursor !== path.dirname(cursor)) {
    if (path.basename(cursor) === 'src') {
      srcDir = cursor;
      break;
    }
    cursor = path.dirname(cursor);
  }

  if (!srcDir) {
    // Fallback: assume sibling helper at <file-dir>/utils/locator.
    return './utils/locator';
  }

  const helperAbs = path.join(srcDir, 'utils', 'locator');
  let rel = path.relative(dir, helperAbs);
  if (!rel.startsWith('.')) rel = './' + rel;
  // Normalize Windows separators (just in case).
  rel = rel.split(path.sep).join('/');
  return rel;
}
