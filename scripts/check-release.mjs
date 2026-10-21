import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { getSourceGraph } from './check-boundaries.mjs';

/** Rejects release configuration drift and reachable development/network capabilities.
 * @param root Repository or synthetic fixture root.
 * @returns Portable failure descriptions; never echoes financial data or host paths.
 */
export const checkRelease = (root = process.cwd()) => {
  const { expo } = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8'));
  const issues = [];
  if (existsSync(resolve(root, 'patches/expo-crypto@58.0.7.patch'))) {
    const manifest = resolve(root, 'package.json');
    const packageConfig = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {};
    const sourceModules = packageConfig.expo?.autolinking?.android?.buildFromSource;
    if (!Array.isArray(sourceModules) || !sourceModules.includes('expo-crypto'))
      issues.push('package.json: patched ExpoCrypto must build from source');
  }
  if (
    JSON.stringify(expo.platforms) !== '["android"]' ||
    expo.ios ||
    expo.web ||
    expo.android?.package !== 'com.planbud.app'
  )
    issues.push('app.json: Android-only delivery required');
  if (
    expo.android?.allowBackup !== false ||
    !expo.plugins?.includes('./plugins/with-offline-android.cjs')
  )
    issues.push('app.json: explicit backup/transfer exclusions required');
  if (
    expo.updates?.enabled !== false ||
    expo.updates?.checkAutomatically !== 'NEVER' ||
    expo.updates?.url
  )
    issues.push('app.json: runtime updates must be disabled');
  const graph = getSourceGraph(root);
  const visited = new Set();
  /** Inspects all route-reachable owned modules, including literal dynamic imports.
   * @param name Portable graph module identity.
   */
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    if (
      /^(tests\/)|\.(?:test|spec)\.[jt]sx?$/.test(name) ||
      /(?:diagnostics|native-contract-screen)/.test(name)
    ) {
      issues.push(`${name}: development/test material reachable from release`);
      return;
    }
    if (/^(?:node:|expo-updates|expo-network|@sentry|firebase|@react-native-firebase)/.test(name)) {
      issues.push('release graph: unsupported network/telemetry dependency');
      return;
    }
    if (!graph.has(name)) return;
    const source = ts.createSourceFile(
      name,
      readFileSync(resolve(root, name), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const paperDialogs = new Set();
    for (const statement of source.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === 'react-native-paper' &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      )
        for (const binding of statement.importClause.namedBindings.elements)
          if ((binding.propertyName ?? binding.name).text === 'Dialog')
            paperDialogs.add(binding.name.text);
    }
    /** Checks executable syntax and asset literals, avoiding documentation/comment false positives.
     * @param node Current owned syntax node.
     */
    const inspect = (node) => {
      if (
        name !== 'src/shared/presentation/dialog.tsx' &&
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ts.isIdentifier(node.tagName) &&
        paperDialogs.has(node.tagName.text)
      )
        issues.push(`${name}: use the native Material dialog boundary`);
      if (
        (ts.isStringLiteral(node) && /^https?:\/\//.test(node.text)) ||
        (ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ['fetch', 'XMLHttpRequest', 'WebSocket'].includes(node.expression.text))
      )
        issues.push(`${name}: runtime network or remote asset reference`);
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === 'Math' &&
        node.expression.name.text === 'random'
      )
        issues.push(`${name}: predictable random fallback prohibited`);
      ts.forEachChild(node, inspect);
    };
    inspect(source);
    for (const edge of graph.get(name)) visit(edge);
  };
  for (const name of graph.keys())
    if (name.startsWith('src/app/') && !/\.(test|spec)\./.test(name)) visit(name);
  return [...new Set(issues)];
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = checkRelease();
  issues.forEach((issue) => process.stderr.write(issue + '\n'));
  process.exitCode = issues.length ? 1 : 0;
}
