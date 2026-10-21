import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Enumerates source modules without walking generated files or dependencies.
 * @param folder Source directory being inspected.
 * @returns Module filenames for AST analysis.
 */
const collectModules = (folder) =>
  !existsSync(folder)
    ? []
    : readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const target = resolve(folder, entry.name);
        return entry.isDirectory()
          ? collectModules(target)
          : /\.[cm]?[jt]sx?$/.test(entry.name)
            ? [target]
            : [];
      });

/** Classifies a module by its architectural owner and layer.
 * @param filename Repository-relative module name.
 * @returns Domain/layer identity, or null for composition and routes.
 */
const classify = (filename) => {
  const domain = filename.match(
    /^src\/domains\/([^/]+)\/(domain|application|infrastructure|presentation)\//,
  );
  if (domain) return { owner: domain[1], layer: domain[2], shared: false };
  const shared = filename.match(/^src\/shared\/(domain|infrastructure|presentation)\//);
  return shared ? { owner: 'shared', layer: shared[1], shared: true } : null;
};

/** Resolves internal relative/alias imports while preserving external package identities.
 * @param specifier Source import string.
 * @param filename Importing module filename.
 * @param root Repository root used for alias resolution.
 * @returns Portable internal module name or external package specifier.
 */
const resolveImport = (specifier, filename, root) => {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return specifier;
  const base = specifier.startsWith('@/')
    ? resolve(root, 'src', specifier.slice(2))
    : resolve(dirname(filename), specifier);
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.mjs', '.json'].map(
      (extension) => base.replace(/\.js$/, '') + extension,
    ),
    ...['index.ts', 'index.tsx'].map((name) => resolve(base, name)),
  ];
  const target = candidates.find(
    (candidate) => existsSync(candidate) && /\.(?:[cm]?[jt]sx?|json)$/.test(candidate),
  );
  return target ? relative(root, target).replaceAll('\\', '/') : specifier;
};

/** Determines whether a direct dependency preserves the documented layer contract.
 * @param source Importing module name.
 * @param target Referenced module or package.
 * @returns Whether the dependency is permitted by the layer contract.
 */
const permits = (source, target) => {
  const isTest = (name) => /\.(test|spec)\.[jt]sx?$/.test(name);
  if (!isTest(source) && isTest(target)) return false;
  if (isTest(source)) return true;
  const from = classify(source);
  const to = classify(target);
  const external = !target.startsWith('src/');
  if (!from) {
    return (
      !source.startsWith('src/app/') ||
      external ||
      target.startsWith('src/app/') ||
      target.startsWith('src/composition/') ||
      to?.layer === 'presentation'
    );
  }
  if (from.layer === 'domain')
    return (
      !!to && to.layer === 'domain' && (to.shared || (!from.shared && to.owner === from.owner))
    );
  if (from.layer === 'application')
    return (
      !!to &&
      ((to.shared && to.layer === 'domain') ||
        (!to.shared && to.owner === from.owner && ['domain', 'application'].includes(to.layer)) ||
        (!to.shared && to.layer === 'application' && target.endsWith('/application/public.ts')))
    );
  if (from.shared) {
    if (external)
      return (
        from.layer === 'infrastructure' ||
        !/^(expo-(sqlite|crypto|secure-store|file-system|document-picker)|node:)/.test(target)
      );
    return !!to && to.shared && (to.layer === from.layer || to.layer === 'domain');
  }
  if (external)
    return (
      from.layer === 'infrastructure' ||
      !/^(expo-(sqlite|crypto|secure-store|file-system|document-picker)|node:)/.test(target)
    );
  if (!to) return false;
  if (to.shared) return to.layer === 'domain' || to.layer === from.layer;
  if (to.owner !== from.owner)
    return to.layer === 'application' && target.endsWith('/application/public.ts');
  return from.layer === 'infrastructure'
    ? to.layer !== 'presentation'
    : ['presentation', 'application'].includes(to.layer);
};

/** Builds the authoritative resolved source graph for architecture and release policy checks.
 * @param root Repository root used only for source resolution.
 * @returns Portable module identities and literal static/dynamic dependencies.
 */
export const getSourceGraph = (root = process.cwd()) => {
  const graph = new Map();
  collectModules(resolve(root, 'src')).forEach((filename) => {
    const name = relative(root, filename).replaceAll('\\', '/');
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const edges = [];
    /** Extracts static and literal dynamic module references from the syntax tree. */
    const visit = (node) => {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (specifier && ts.isStringLiteral(specifier))
        edges.push(resolveImport(specifier.text, filename, root));
      ts.forEachChild(node, visit);
    };
    visit(source);
    graph.set(name, edges);
  });
  return graph;
};

/** Returns prohibited import/re-export edges and cycles, including alias escapes.
 * @param root Repository root used only to resolve source files.
 * @returns Portable diagnostics for violated layer rules.
 */
export const checkBoundaries = (root = process.cwd()) => {
  const graph = getSourceGraph(root);
  const violations = [];
  graph.forEach((edges, name) =>
    edges.forEach((target) => {
      if (!permits(name, target)) violations.push(`${name}: forbidden dependency on ${target}`);
    }),
  );
  const done = new Set();
  const active = new Set();
  /** Finds cycles that could hide a forbidden dependency behind public re-exports. */
  const visitGraph = (name) => {
    if (active.has(name)) {
      violations.push(`${name}: circular dependency`);
      return;
    }
    if (done.has(name)) return;
    active.add(name);
    (graph.get(name) ?? []).filter((edge) => graph.has(edge)).forEach(visitGraph);
    active.delete(name);
    done.add(name);
  };
  graph.forEach((_edges, name) => visitGraph(name));
  return [...new Set(violations)];
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = checkBoundaries();
  issues.forEach((issue) => process.stderr.write(`${issue}\n`));
  process.exitCode = issues.length ? 1 : 0;
}
