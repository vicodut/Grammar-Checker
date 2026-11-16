import { describe, expect, test } from "bun:test";
import { checkSource } from "./size-check.rules";

const lines = (count: number, line = "const x = 1;"): string =>
  Array.from({ length: count }, () => line).join("\n");

// A function whose body (opening brace line to closing brace line) spans `count` lines.
const fn = (name: string, count: number): string =>
  [`export function ${name}() {`, ...Array.from({ length: count - 2 }, () => "  go();"), "}"].join(
    "\n",
  );

describe("file length", () => {
  test("flags a file over 200 lines and reports the count", () => {
    const found = checkSource("a.ts", `${lines(201)}\n`);
    expect(found).toEqual([{ path: "a.ts", line: 1, message: "file has 201 lines (max 200)" }]);
  });

  test("allows exactly 200 lines, counting a trailing newline as no extra line", () => {
    expect(checkSource("a.ts", `${lines(200)}\n`)).toEqual([]);
    expect(checkSource("a.ts", lines(200))).toEqual([]);
  });
});

describe("function length", () => {
  test("flags a function body over 40 lines, counted first to last line inclusive", () => {
    const found = checkSource("a.ts", fn("tooLong", 41));
    expect(found).toEqual([{ path: "a.ts", line: 1, message: "tooLong has 41 lines (max 40)" }]);
  });

  test("allows a function body of exactly 40 lines", () => {
    expect(checkSource("a.ts", fn("fits", 40))).toEqual([]);
  });

  test("names arrow functions after their binding and reports the body line", () => {
    const body = Array.from({ length: 40 }, () => "  go();").join("\n");
    const source = `const handler = async (a: number) => {\n${body}\n};\n`;
    expect(checkSource("a.ts", source)).toEqual([
      { path: "a.ts", line: 1, message: "handler has 42 lines (max 40)" },
    ]);
  });

  test("checks class methods and constructors, with a multi-line return type", () => {
    const body = Array.from({ length: 40 }, () => "    go();").join("\n");
    const source = [
      "class Store {",
      "  constructor(private readonly a: number) {}",
      "  async load(): Promise<{ ok: boolean }> {",
      body,
      "  }",
      "}",
    ].join("\n");
    expect(checkSource("a.ts", source)).toEqual([
      { path: "a.ts", line: 3, message: "load has 42 lines (max 40)" },
    ]);
  });

  test("names anonymous function expressions after the variable they initialise", () => {
    const body = Array.from({ length: 40 }, () => "  go();").join("\n");
    const source = `const run = function () {\n${body}\n};\n`;
    expect(checkSource("a.ts", source)).toEqual([
      { path: "a.ts", line: 1, message: "run has 42 lines (max 40)" },
    ]);
  });

  test("measures an expression-bodied arrow by the lines its expression spans", () => {
    const expr = Array.from({ length: 41 }, () => "  a +").join("\n");
    const source = `const sum = () =>\n${expr}\n  b;\n`;
    expect(checkSource("a.ts", source)).toEqual([
      { path: "a.ts", line: 2, message: "sum has 42 lines (max 40)" },
    ]);
  });

  test("counts nested functions on their own", () => {
    // inner is 40 lines (allowed); outer is 43 lines, which includes inner.
    const inner = Array.from({ length: 38 }, () => "    go();").join("\n");
    const source = [
      "export function outer() {",
      "  const inner = () => {",
      inner,
      "  };",
      "  inner();",
      "}",
    ].join("\n");
    expect(checkSource("a.ts", source)).toEqual([
      { path: "a.ts", line: 1, message: "outer has 43 lines (max 40)" },
    ]);
  });

  test("ignores braces, parens and keywords inside strings, templates, comments and regexes", () => {
    const body = [
      '  const a = "}{";',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: this is source text under test
      "  const b = `${'}'} {`;",
      "  // } } }",
      "  /* { { { */",
      "  const c = /[{}]/g.test(a);",
      ...Array.from({ length: 33 }, () => "  go();"),
    ].join("\n");
    const source = `export function tricky() {\n${body}\n}\n`;
    expect(checkSource("a.ts", source)).toEqual([]);
  });

  test("an apostrophe in JSX text does not swallow the next function", () => {
    const body = Array.from({ length: 41 }, () => "  go();").join("\n");
    const source = `const view = <p>Don't stop</p>;\nexport function big() {\n${body}\n}\n`;
    expect(checkSource("view.tsx", source)).toEqual([
      { path: "view.tsx", line: 2, message: "big has 43 lines (max 40)" },
    ]);
  });

  test("a describe block is a suite container, but each test inside it is measured", () => {
    const long = Array.from({ length: 60 }, () => "    expect(1).toBe(1);").join("\n");
    const suite = [
      'describe("suite", () => {',
      '  test("short", () => {',
      "    expect(1).toBe(1);",
      "  });",
      '  test("long", () => {',
      long,
      "  });",
      "});",
    ].join("\n");
    expect(checkSource("a.test.ts", suite)).toEqual([
      { path: "a.test.ts", line: 5, message: "anonymous function has 62 lines (max 40)" },
    ]);
    const bigSuite = `describe.skip("big", function () {\n${long}\n});\n`;
    expect(checkSource("a.test.ts", bigSuite)).toEqual([]);
  });

  test("a JSX closing tag does not swallow the braces on its line", () => {
    const tail = Array.from({ length: 45 }, () => "    <i />").join("\n");
    const source = [
      "export const Row = ({ row }: Props) => (",
      "  <p>",
      "    {row.deleted && <span>(deleted)</span>}",
      tail,
      "  </p>",
      ");",
      "export function tail() {",
      "  return 1;",
      "}",
    ].join("\n");
    expect(checkSource("row.tsx", source)).toEqual([
      { path: "row.tsx", line: 1, message: "Row has 50 lines (max 40)" },
    ]);
  });

  test("control-flow blocks are not functions", () => {
    const body = Array.from({ length: 50 }, () => "    go();").join("\n");
    const source = `if (ready) {\n${body}\n}\n`;
    expect(checkSource("a.ts", source)).toEqual([]);
  });
});
