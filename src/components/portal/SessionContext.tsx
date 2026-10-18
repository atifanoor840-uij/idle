"use client";
import { createContext, useContext, type ReactNode } from "react";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  role: string;
  emailVerified: boolean;
};

const Ctx = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

/** The signed-in trader. Only used under the portal layout, which guarantees a user. */
export function useSessionUser(): SessionUser {
  const user = useContext(Ctx);
  if (!user) throw new Error("useSessionUser must be used inside the portal layout");
  return user;
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";
