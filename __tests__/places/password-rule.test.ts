/**
 * The password rule the app checks before sending (same as the Supabase
 * project's policy): at least 8 characters with an upper-case letter, a
 * lower-case letter, a number and a symbol. Pure checks: no server, no rows.
 */
jest.mock("../../lib/supabase", () => ({ supabase: { auth: { signOut: () => Promise.resolve({ error: null }) } } }));

import { passwordProblem, passwordStrengthProblem } from "../../services/supabaseAuthService";

const WEAK = "Use an upper-case letter, a lower-case letter, a number and a symbol (for example ! # ?).";

describe("password rule", () => {
  it("accepts a password with all four kinds of character", () => {
    expect(passwordStrengthProblem("Passw0rd!")).toBeNull();
    expect(passwordProblem("Passw0rd!", "Passw0rd!")).toBeNull();
  });

  it.each([
    ["no symbol", "Passw0rdX"],
    ["no number", "Password!"],
    ["no upper-case letter", "passw0rd!"],
    ["no lower-case letter", "PASSW0RD!"],
  ])("blocks a password with %s", (_case, password) => {
    expect(passwordStrengthProblem(password)).toBe(WEAK);
    expect(passwordProblem(password, password)).toBe(WEAK);
  });

  it("still reports length first, then a mismatch", () => {
    expect(passwordProblem("Ab1!x", "Ab1!x")).toBe("Use at least 8 characters.");
    expect(passwordProblem("password", "passwordX")).toBe("The passwords do not match.");
  });
});
