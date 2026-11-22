import { describe, expect, it } from "vitest";
import { hasErrors, validateRegister, validateSignIn } from "./accounts";

describe("account forms", () => {
  it("rejects an incomplete sign-in", () => {
    const errors = validateSignIn({ email: "not-an-email", password: "short" });
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
    expect(hasErrors(errors)).toBe(true);
  });

  it("accepts a complete sign-in", () => {
    expect(hasErrors(validateSignIn({ email: "amina.rahman@example.edu", password: "library-pass" }))).toBe(false);
  });

  it("requires matching passwords before registration", () => {
    const errors = validateRegister({
      name: "Amina Rahman",
      email: "amina.rahman@example.edu",
      password: "library-pass",
      confirm: "different-pass",
    });
    expect(errors.confirm).toBe("Passwords do not match.");
  });
});
