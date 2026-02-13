import noFloatingErrorRule from './rules/no-floating-error.mjs';
import recommended from "./configs/recommended.mjs";

const rules = {
    'no-floating-error': noFloatingErrorRule,
};

const plugin = {
    rules,
    configs: {
        recommended
    }
};

export default plugin;
