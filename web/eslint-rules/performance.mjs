const CONTINUOUS_EVENTS = new Set([
  "mousemove",
  "pointermove",
  "resize",
  "scroll",
  "touchmove",
  "wheel",
]);
const CONTINUOUS_JSX_HANDLERS = new Set([
  "onDrag",
  "onDragOver",
  "onMouseMove",
  "onPointerMove",
  "onTouchMove",
  "onWheel",
]);
const LAYOUT_READS = new Set(["elementFromPoint", "getBoundingClientRect"]);

function memberName(node) {
  if (node.type !== "MemberExpression") return null;
  if (!node.computed && node.property.type === "Identifier")
    return node.property.name;
  if (node.computed && node.property.type === "Literal")
    return node.property.value;
  return null;
}

const noUnthrottledGlobalContinuousListener = {
  meta: {
    messages: {
      unthrottled:
        "Route continuous global events through a frame-coalescing listener helper.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      CallExpression(node) {
        if (memberName(node.callee) !== "addEventListener") return;
        const eventName = node.arguments[0];
        if (
          eventName?.type === "Literal" &&
          typeof eventName.value === "string" &&
          CONTINUOUS_EVENTS.has(eventName.value)
        )
          context.report({ messageId: "unthrottled", node });
      },
    };
  },
};

function containsLayoutRead(root, sourceCode) {
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined || visited.has(node)) continue;
    visited.add(node);
    if (
      node.type === "CallExpression" &&
      LAYOUT_READS.has(memberName(node.callee))
    )
      return true;
    for (const key of sourceCode.visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) pending.push(...child);
      else if (child !== null && typeof child === "object") pending.push(child);
    }
  }
  return false;
}

const noLayoutReadInContinuousJsxHandler = {
  meta: {
    messages: {
      layoutRead:
        "Schedule layout reads from continuous handlers through requestAnimationFrame.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          node.name.type !== "JSXIdentifier" ||
          !CONTINUOUS_JSX_HANDLERS.has(node.name.name) ||
          node.value?.type !== "JSXExpressionContainer"
        )
          return;
        const expression = node.value.expression;
        if (
          (expression.type === "ArrowFunctionExpression" ||
            expression.type === "FunctionExpression") &&
          containsLayoutRead(expression.body, context.sourceCode)
        )
          context.report({ messageId: "layoutRead", node });
      },
    };
  },
};

export default {
  rules: {
    "no-layout-read-in-continuous-jsx-handler":
      noLayoutReadInContinuousJsxHandler,
    "no-unthrottled-global-continuous-listener":
      noUnthrottledGlobalContinuousListener,
  },
};
