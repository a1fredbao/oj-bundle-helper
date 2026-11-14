import { describe, expect, test } from "bun:test";
import { transformCpp } from "../cpp";

describe("transformCpp", () => {
  test("handles the reported modern template syntax", async () => {
    const source = `
template <class T>
struct Halfplane : Line<T> {
  template <class U = T, std::enable_if_t<!std::is_integral_v<U>, int> = 0>
  Halfplane(T A, T B, T C) {
    T aa = A < T(0) ? -A : A;
  }
};`;
    const result = await transformCpp(source);

    expect(result.warnings).toEqual([]);
    expect(result.code).toContain(
      "std::enable_if_t<!std::is_integral_v<U>,int> =0",
    );
    expect(result.code).not.toContain("int>=0");
  });

  test("shortens safely resolved locals and parameters", async () => {
    const source = `
int solve(int value) {
  int answer = value + 1;
  for (int index = 0; index < answer; index++) {
    answer += index;
  }
  return answer;
}`;
    const result = await transformCpp(source);

    expect(result.code).toBe(
      "int solve(int c){int a=c+1;for(int b=0;b<a;b++){a+=b;}return a;}",
    );
    expect(result.renames.map((rename) => rename.from).sort()).toEqual([
      "answer",
      "index",
      "value",
    ]);
  });

  test("leaves a name alone when a function contains shadowing", async () => {
    const source = `
int f() {
  int value = 1;
  {
    int value = 2;
    return value;
  }
}`;
    const result = await transformCpp(source);

    expect(result.code).toContain("int value=1");
    expect(result.code).toContain("int value=2");
  });

  test("does not rename member names", async () => {
    const source = `
struct Box { int value; };
int f(Box box) {
  int answer = box.value;
  return answer;
}`;
    const result = await transformCpp(source);

    expect(result.code).toContain(".value");
    expect(result.code).not.toContain("answer");
  });

  test("updates explicit lambda captures", async () => {
    const source = `
int f() {
  int value = 1;
  auto callback = [value]() { return value + 1; };
  return callback();
}`;
    const result = await transformCpp(source);

    expect(result.code).not.toContain("value");
    expect(result.code).not.toContain("callback");
  });

  test("shortens structured bindings", async () => {
    const source = `
int f(Pair pair) {
  auto [left, right] = pair;
  return left + right;
}`;
    const result = await transformCpp(source);

    expect(result.code).not.toContain("left");
    expect(result.code).not.toContain("right");
  });

  test("renames declarations in condition scopes", async () => {
    const source = `
int f(int value) {
  if (int answer = value) {
    return answer;
  }
  return 0;
}`;
    const result = await transformCpp(source);

    expect(result.code).not.toContain("answer");
  });

  test("does not rename namespace-scope variables", async () => {
    const source = `
int globalValue = 1;
int f() {
  return globalValue;
}`;
    const result = await transformCpp(source);

    expect(result.code).toContain("globalValue");
  });

  test("uses independent short-name pools for each function", async () => {
    const source = `
int first(int value) { int answer = value; return answer; }
int second(int value) { int answer = value; return answer; }`;
    const result = await transformCpp(source);

    expect(result.code).toBe(
      "int first(int b){int a=b;return a;}int second(int b){int a=b;return a;}",
    );
  });

  test("uses UTF-16 tree ranges after non-ASCII source text", async () => {
    const source = `
// 中文注释
int f(int value) {
  int answer = value;
  return answer;
}`;
    const result = await transformCpp(source);

    expect(result.code).toBe("int f(int b){int a=b;return a;}");
  });

  test("falls back to whitespace compression for syntax errors", async () => {
    const source = `
int f() {
  int value = 1;
  invalid syntax here;
  return value;
}`;
    const result = await transformCpp(source);

    expect(result.warnings).toHaveLength(1);
    expect(result.code).toContain("int value=1");
  });

  test("can disable local name shortening", async () => {
    const source = "int f(int value) { int answer = value; return answer; }";
    const result = await transformCpp(source, { shortenLocals: false });

    expect(result.renames).toEqual([]);
    expect(result.code).toContain("int answer=value");
  });
});
