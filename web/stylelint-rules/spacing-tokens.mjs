import stylelint from "stylelint";

const ruleName = "survail/spacing-tokens";
const messages = stylelint.utils.ruleMessages(ruleName, {
  tokenRequired: (property, value) =>
    `Use a spacing token (var(--md-sys-spacing-*)) instead of "${value}" in "${property}".`,
});

const spacingProps =
  /^(?:gap|row-gap|column-gap|padding|padding-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end)|margin|margin-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))$/;

// A positive length literal (px/rem/em) that is not part of a var() fallback.
// Negative lengths are intentionally allowed (visually-hidden hacks, pull
// margins) so they stay visible in review instead of hiding behind a token.
const lengthLiteral = /(?<![\w.-])\d*\.?\d+(?:px|rem|em)\b/;

function stripVarExpressions(value) {
  let result = value;
  let previous;
  do {
    previous = result;
    result = result.replace(/var\([^()]*\)/g, "var()");
  } while (result !== previous);
  return result;
}

const ruleFunction = (enabled) => (root, result) => {
  if (!enabled) return;

  root.walkDecls((declaration) => {
    if (!spacingProps.test(declaration.prop)) return;

    const bare = stripVarExpressions(declaration.value);
    if (lengthLiteral.test(bare)) {
      stylelint.utils.report({
        message: messages.tokenRequired(declaration.prop, declaration.value),
        node: declaration,
        result,
        ruleName,
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

export default stylelint.createPlugin(ruleName, ruleFunction);
