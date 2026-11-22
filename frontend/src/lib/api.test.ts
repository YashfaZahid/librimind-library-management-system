import { describe, expect, it } from "vitest";
import { resolveApiRoot } from "./api";

describe("resolveApiRoot", () => {
  it("uses the local API while developing", () => {
    expect(resolveApiRoot(undefined, true)).toBe("http://127.0.0.1:8000");
    expect(resolveApiRoot("http://localhost:8000", true)).toBe("http://127.0.0.1:8000");
  });

  it("uses the same origin for a production build", () => {
    expect(resolveApiRoot(undefined, false)).toBe("");
    expect(resolveApiRoot("", false)).toBe("");
    expect(resolveApiRoot("http://127.0.0.1:8000", false)).toBe("");
    expect(resolveApiRoot("http://localhost:8000/", false)).toBe("");
  });

  it("keeps an explicit public API address", () => {
    expect(resolveApiRoot("https://library.example.edu", false)).toBe("https://library.example.edu");
  });
});
