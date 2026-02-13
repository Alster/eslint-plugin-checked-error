import { ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

/**
 * @typedef {import("@typescript-eslint/utils").TSESLint.RuleModule<MessageIds, []>} RuleModule
 * @typedef {import("@typescript-eslint/utils").TSESLint.RuleContext<MessageIds, []>} RuleContext
 * @typedef {import("@typescript-eslint/utils").TSESTree.ExpressionStatement} ExpressionStatement
 * @typedef {import("@typescript-eslint/utils").TSESTree.Expression} Expression
 * @typedef {import("@typescript-eslint/utils").TSESTree.CallExpression} CallExpression
 * @typedef {import("@typescript-eslint/utils").TSESTree.AwaitExpression} AwaitExpression
 */

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/Alster/eslint-plugin-checked-error.git`,
);

/**
 * Try to unwrap Promise-like and get the awaited type.
 * Works across TS versions by using available checker APIs.
 *
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @returns {ts.Type}
 */
function getAwaitedType(checker, type) {
    // TS 4.5+ має getAwaitedType, але він може бути відсутній залежно від версії.
    /** @type {any} */ const anyChecker = checker;

    if (typeof anyChecker.getAwaitedType === 'function') {
        const awaited = anyChecker.getAwaitedType(type);
        return awaited ?? type;
    }

    // Fallback: якщо це Promise<T>, спробуємо дістати T
    if (typeof checker.getPromisedTypeOfPromise === 'function') {
        const promised = checker.getPromisedTypeOfPromise(type);
        return promised ?? type;
    }

    return type;
}

/**
 * If type is union/intersection/type parameter, normalize it.
 *
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @returns {ts.Type[]}
 */
function flattenTypes(checker, type) {
    if (type.isUnion()) return type.types.flatMap((t) => flattenTypes(checker, t));
    if (type.isIntersection()) return type.types.flatMap((t) => flattenTypes(checker, t));

    // type parameter -> use constraint if present
    if (type.flags & ts.TypeFlags.TypeParameter) {
        const constraint = checker.getBaseConstraintOfType(type);
        if (constraint) return flattenTypes(checker, constraint);
    }

    return [type];
}

/**
 * Checks whether a type is (or extends) the built-in Error type.
 *
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @returns {boolean}
 */
function isErrorOrSubclass(checker, type) {
    const parts = flattenTypes(checker, type);

    for (const t of parts) {
        // Avoid noisy positives for any/unknown/never
        if (t.flags & ts.TypeFlags.Any) continue;
        if (t.flags & ts.TypeFlags.Unknown) continue;
        if (t.flags & ts.TypeFlags.Never) continue;

        const apparent = checker.getApparentType(t);
        if (isErrorInterfaceOrBase(checker, apparent, new Set())) return true;
    }

    return false;
}

/**
 * Depth-first walk through base types to see if Error is in the chain.
 *
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} type
 * @param {Set<ts.Type>} seen
 * @returns {boolean}
 */
function isErrorInterfaceOrBase(checker, type, seen) {
    if (seen.has(type)) return false;
    seen.add(type);

    const symbol = type.getSymbol();
    if (symbol && String(symbol.getName()) === 'Error') return true;

    // Only class/interface types have base types we can traverse reliably
    if (type.flags & ts.TypeFlags.Object) {
        /** @type {ts.ObjectType} */ // @ts-expect-error - runtime ok
        const objType = type;

        if (objType.objectFlags & ts.ObjectFlags.ClassOrInterface) {
            /** @type {ts.InterfaceType} */ // @ts-expect-error - runtime ok
            const iface = objType;
            const bases = checker.getBaseTypes(iface) ?? [];
            for (const b of bases) {
                if (isErrorInterfaceOrBase(checker, b, seen)) return true;
            }
        }
    }

    return false;
}

/**
 * Extract call expression from:
 * - `canReturnErrorOrTrue();`
 * - `await canReturnErrorOrTrue();`
 *
 * @param {Expression} expr
 * @returns {{ call: CallExpression, isAwait: boolean } | null}
 */
function getStandaloneCall(expr) {
    if (expr.type === 'CallExpression') return { call: expr, isAwait: false };

    if (expr.type === 'AwaitExpression') {
        /** @type {AwaitExpression} */ const ae = expr;
        if (ae.argument && ae.argument.type === 'CallExpression') {
            return { call: ae.argument, isAwait: true };
        }
    }

    return null;
}

/** @type {RuleModule} */
export const rule = createRule({
    name: 'no-floating-error',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Requires using/checking a returned value when a function may return an Error, instead of ignoring it.',
        },
        schema: [],
        messages: {
            requireErrorCheck:
                "This call can return an Error. Don't ignore its result — return it, throw it, or check/handle the error.",
        },
    },
    defaultOptions: [],
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        return {
            /**
             * @param {ExpressionStatement} node
             */
            ExpressionStatement(node) {
                const extracted = getStandaloneCall(node.expression);
                if (!extracted) return;

                // ExpressionStatement already means: not assigned / not returned / not thrown.
                // So we ONLY check whether the call result *may be* Error-like.
                const tsCall = services.esTreeNodeToTSNodeMap.get(extracted.call);

                // For await, take awaited type; otherwise take direct call type
                let returnType = checker.getTypeAtLocation(tsCall);
                if (extracted.isAwait) {
                    returnType = getAwaitedType(checker, returnType);
                }

                if (!isErrorOrSubclass(checker, returnType)) return;

                context.report({
                    node,
                    messageId: 'requireErrorCheck',
                });
            },
        };
    },
});

export default rule;
