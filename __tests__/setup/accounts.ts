import fs from "fs";
import path from "path";

/**
 * Test logins, kept in accounts.local.json next to this file. That file is
 * ignored by git (never pushed) and the values are never printed.
 *
 * {
 *   "guardianWithChild": { "email": "...", "password": "..." },
 *   "guardianNoChild":   { "email": "...", "password": "..." },
 *   "admin":             { "email": "...", "password": "..." },
 *   "deletedAccount":    { "email": "...", "password": "..." }
 * }
 */
type Login = { email: string; password: string };
type Accounts = { guardianWithChild: Login; guardianNoChild: Login; admin: Login; deletedAccount: Login };

const file = path.join(__dirname, "accounts.local.json");

export const accounts: Accounts = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8"))
  : (() => {
      throw new Error("Create __tests__/setup/accounts.local.json with the four test logins (see accounts.ts).");
    })();
