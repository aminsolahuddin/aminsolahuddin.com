import { LoginButton } from "./login-button";

export const metadata = { title: "Sign in" };

/**
 * The one admin route middleware lets through without a session — otherwise
 * signing in would require already being signed in.
 *
 * There is no email field and no password field, deliberately. GitHub OAuth is
 * the only door, and the allowlist in lib/auth.ts is what makes it a door for
 * exactly one person.
 */
export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-lg">
      <div className="w-full max-w-sm">
        <h1 className="text-display-md font-display">Sign in</h1>
        <p className="text-body text-ink-muted-80 mt-xs">
          GitHub only, one account.
        </p>
        <div className="mt-lg">
          <LoginButton />
        </div>
      </div>
    </main>
  );
}
