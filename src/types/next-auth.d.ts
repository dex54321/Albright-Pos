import type { DefaultSession } from "next-auth";

type AppRole = "admin" | "manager" | "cashier";

// We keep `id` as NextAuth's native `string | undefined` type everywhere in
// these interfaces (rather than redeclaring it as `number`, which conflicts
// with the base DefaultUser/DefaultSession typings). The numeric database id
// is recovered with Number(...) once, in requireUser() (see lib/apiAuth.ts),
// and every server-side helper works with that numeric id from there on.

declare module "next-auth" {
  interface Session {
    user: {
      username: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
  interface User {
    username: string;
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: AppRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: AppRole;
  }
}
