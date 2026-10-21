/** Registers syntax checks without rejecting TypeScript callable signatures.
 * @param context ESLint reporting context.
 * @returns Visitors rejecting authored non-arrow implementations.
 */
const arrowVisitors = (context) => {
  const reject = (node) =>
    context.report({
      node,
      message:
        'Use a const-bound arrow function; function declarations/expressions and class components are forbidden.',
    });
  const inspectArrow = (node) => {
    if (node.parent.type === 'ExportDefaultDeclaration') reject(node);
  };
  return {
    FunctionDeclaration: reject,
    FunctionExpression: reject,
    ClassDeclaration: reject,
    ClassExpression: reject,
    ArrowFunctionExpression: inspectArrow,
  };
};

/** Locates the comment-owning declaration for a public callable or type.
 * @param node Arrow implementation or exported type node.
 * @returns Declaration that requires a contract, or null for an inline callback.
 */
const contractOwner = (node) => {
  if (node.type === 'TSTypeAliasDeclaration' || node.type === 'TSInterfaceDeclaration')
    return node.parent.type === 'ExportNamedDeclaration' ? node.parent : null;
  const parent = node.parent;
  if (parent.type === 'VariableDeclarator') {
    const declaration = parent.parent;
    return declaration.parent.type === 'Program'
      ? declaration
      : declaration.parent.type === 'ExportNamedDeclaration'
        ? declaration.parent
        : null;
  }
  if (parent.type === 'Property' && parent.value === node && !parent.method) return parent;
  return null;
};

/** Checks that public callable comments describe inputs and useful outputs.
 * @param context ESLint context providing source comments.
 * @returns Visitors enforcing meaningful JSDoc rather than name-only comments.
 */
const documentationVisitors = (context) => {
  const inspect = (node) => {
    const owner = contractOwner(node);
    if (!owner) return;
    const comment = context.sourceCode.getCommentsBefore(owner).at(-1);
    const text = comment?.type === 'Block' && comment.value.startsWith('*') ? comment.value : '';
    const description = text.split('@')[0].replaceAll('*', '').trim();
    if (description.length < 12) {
      context.report({
        node: owner,
        message: 'Document this callable/type with a meaningful JSDoc contract.',
      });
      return;
    }
    if (node.type !== 'ArrowFunctionExpression') return;
    if (node.params.length && !text.includes('@param'))
      context.report({ node: owner, message: 'Document applicable inputs with @param.' });
    const returnsValue =
      node.body.type !== 'BlockStatement' ||
      node.body.body.some(
        (statement) => statement.type === 'ReturnStatement' && statement.argument,
      );
    if (returnsValue && !text.includes('@returns'))
      context.report({ node: owner, message: 'Document the returned value with @returns.' });
  };
  return {
    ArrowFunctionExpression: inspect,
    TSTypeAliasDeclaration: inspect,
    TSInterfaceDeclaration: inspect,
  };
};

/** Distinguishes promise methods from unrelated domain methods with similar names.
 * @param context ESLint context with TypeScript parser services when available.
 * @returns Visitor restricting chains to the terminal operation launcher.
 */
const asynchronousVisitors = (context) => {
  const inspect = (node) => {
    const member = node.callee;
    if (
      member.type !== 'MemberExpression' ||
      member.computed ||
      !['then', 'catch', 'finally'].includes(member.property.name)
    )
      return;
    if (
      context.filename
        .replaceAll('\\', '/')
        .endsWith('/src/shared/presentation/operation-launcher.ts')
    )
      return;
    const services = context.sourceCode.parserServices;
    const checker = services?.program?.getTypeChecker();
    const type =
      checker && services.esTreeNodeToTSNodeMap
        ? checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(member.object))
        : null;
    const promiseType =
      type &&
      (type.getSymbol()?.name === 'Promise' ||
        (type.getProperty('then') && type.getProperty('catch')));
    const directPromise =
      member.object.type === 'CallExpression' &&
      member.object.callee.type === 'MemberExpression' &&
      member.object.callee.object.type === 'Identifier' &&
      member.object.callee.object.name === 'Promise';
    if (promiseType || directPromise)
      context.report({
        node,
        message: 'Use async/await; promise chains belong only in the documented terminal observer.',
      });
  };
  return { CallExpression: inspect };
};

/** Supplies the exact syntax, documentation, and asynchronous policy rules. */
export const projectRules = {
  'arrow-functions': { meta: { schema: [] }, create: arrowVisitors },
  'document-contracts': { meta: { schema: [] }, create: documentationVisitors },
  'async-workflows': { meta: { schema: [] }, create: asynchronousVisitors },
};
