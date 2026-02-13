# eslint-plugin-checked-error

Strict handling for functions that may return `Error`.

This plugin enforces a simple but important rule:

> If a function may return an `Error`, you must not ignore its result.

Designed for TypeScript projects using **ESLint v9 flat config** and
type-aware rules.

------------------------------------------------------------------------

## Installation

``` bash
npm install --save-dev eslint eslint-plugin-checked-error typescript typescript-eslint
```

This plugin requires:

-   ESLint v9+
-   TypeScript
-   `typescript-eslint` (type-aware config)

------------------------------------------------------------------------

## Usage (Flat Config)

``` js
// eslint.config.mjs
import tseslint from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';
import checkedError from "eslint-plugin-checked-error";

export default [
  ...checkedError.configs.recommended,

  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    'checked-error': checkedError,
  },
];
```

------------------------------------------------------------------------

## Included Configs

### `checked-error/configs/recommended`

Enables:

-   `checked-error/no-ignored-error-result`
-   `no-unused-vars`
-   `@typescript-eslint/no-unnecessary-condition`
-   `@typescript-eslint/strict-boolean-expressions`
-   `@typescript-eslint/only-throw-error`

------------------------------------------------------------------------

## Rules

### `no-ignored-error-result`

Disallows ignoring the result of a function call if its return type may
include `Error`.

### ❌ Incorrect

``` ts
function mayReturnError(): Error | true {
  return Math.random() > 0.5 ? new Error("fail") : true;
}

mayReturnError(); // ❌ result ignored
```

``` ts
await mayReturnError(); // ❌ result ignored
```

------------------------------------------------------------------------

### ✅ Correct

``` ts
return mayReturnError();
```

``` ts
throw mayReturnError();
```

``` ts
const result = mayReturnError();
if (result instanceof Error) throw result;
```

------------------------------------------------------------------------

## What This Rule Does *Not* Do

This rule intentionally focuses on a single concern:

-   It only detects standalone calls whose result may be `Error`
-   It does not enforce how the error must be handled
-   It does not check unused variables
-   It does not validate boolean misuse

Those concerns are expected to be handled by:

-   `no-unused-vars`
-   `@typescript-eslint/strict-boolean-expressions`
-   `@typescript-eslint/no-unnecessary-condition`
-   `@typescript-eslint/only-throw-error`

------------------------------------------------------------------------

## Why?

Returning `Error` instead of throwing is sometimes used in:

-   FP-style code
-   effect systems
-   explicit error modeling
-   legacy migration scenarios

But silently ignoring such values creates subtle bugs.

This plugin ensures those values are never accidentally discarded.

------------------------------------------------------------------------

## Contributing

Issues and pull requests are welcome.

------------------------------------------------------------------------

## License

MIT
