/**
 * @type {import("eslint").Linter.FlatConfig[]}
 */
export default [
    {
        rules: {
            "no-unused-vars": "warn",
            "@typescript-eslint/no-unnecessary-condition": "error",
            "@typescript-eslint/strict-boolean-expressions": "error",
            "@typescript-eslint/only-throw-error": "error",

            "checked-error/no-floating-error": "error",
        },
    },
];
