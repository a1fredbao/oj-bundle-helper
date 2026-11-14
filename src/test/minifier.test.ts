import { describe, expect, test } from "bun:test";
import { minifyCpp } from "../cpp/minifier";

describe("minifyCpp", () => {
  test("does not merge a template close with a following assignment", async () => {
    const source =
      "template <class U = T, std::enable_if_t<!std::is_integral_v<U>, int> = 0>";
    const result = await minifyCpp(source);

    expect(result).toContain("int> =0");
    expect(result).not.toContain("int>=0");
  });

  test("preserves operator boundaries without inflating compound operators", async () => {
    const source =
      "void foo(int * = nullptr) { a *= b; y = a * b; z = x + +y; }";
    const result = await minifyCpp(source);

    expect(result).toContain("int* =nullptr");
    expect(result).toContain("a*=b");
    expect(result).toContain("y=a*b");
    expect(result).toContain("z=x+ +y");
  });

  test("keeps raw string contents untouched", async () => {
    const source = `auto text = R"tag(a // b > = c)tag";`;
    const result = await minifyCpp(source);

    expect(result).toBe(`auto text=R"tag(a // b > = c)tag";`);
  });

  test("preserves preprocessor line boundaries", async () => {
    const source = [
      "#include <iostream>",
      "// remove this",
      "#define ADD(x) ((x) + 1)",
      "int main() { return 0; }",
    ].join("\n");

    expect(await minifyCpp(source)).toBe(
      [
        "#include <iostream>",
        "#define ADD(x) ((x) + 1)",
        "int main(){return 0;}",
      ].join("\n"),
    );
  });

  test("uses UTF-16 source offsets only for edits, not tokenization", async () => {
    const source = '// 中文注释\nint main() { const char * text = "中文"; }';
    const result = await minifyCpp(source);

    expect(result).toContain('const char*text="中文"');
  });

  test("does not turn a separated literal suffix into a user-defined literal", async () => {
    const source = 'auto value = "text" _suffix;';

    expect(await minifyCpp(source)).toContain('"text" _suffix');
  });
});
