import { RuleTester } from "eslint";
import test from "node:test";

import performancePlugin from "./performance.mjs";

RuleTester.describe = (name, run) => test.describe(name, run);
RuleTester.it = (name, run) => test.it(name, run);
RuleTester.itOnly = (name, run) => test.it.only(name, run);

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    parserOptions: { ecmaFeatures: { jsx: true } },
    sourceType: "module",
  },
});

tester.run(
  "no-unthrottled-global-continuous-listener",
  performancePlugin.rules["no-unthrottled-global-continuous-listener"],
  {
    valid: [
      "listenForPointerDrag(pointerId, handlers)",
      "window.addEventListener('click', handler)",
    ],
    invalid: [
      {
        code: "window.addEventListener('pointermove', handler)",
        errors: [{ messageId: "unthrottled" }],
      },
      {
        code: "document.addEventListener('mousemove', handler)",
        errors: [{ messageId: "unthrottled" }],
      },
      {
        code: "window.addEventListener('scroll', updatePosition, true)",
        errors: [{ messageId: "unthrottled" }],
      },
      {
        code: "window.addEventListener('resize', updatePosition)",
        errors: [{ messageId: "unthrottled" }],
      },
    ],
  },
);

tester.run(
  "no-layout-read-in-continuous-jsx-handler",
  performancePlugin.rules["no-layout-read-in-continuous-jsx-handler"],
  {
    valid: [
      "const view = <div onPointerMove={schedulePointerMove} />",
      "const view = <div onClick={() => node.getBoundingClientRect()} />",
    ],
    invalid: [
      {
        code: "const view = <div onPointerMove={() => node.getBoundingClientRect()} />",
        errors: [{ messageId: "layoutRead" }],
      },
      {
        code: "const view = <div onDragOver={() => document.elementFromPoint(1, 2)} />",
        errors: [{ messageId: "layoutRead" }],
      },
    ],
  },
);
