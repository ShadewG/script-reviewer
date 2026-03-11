"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface AppUser {
  id: string;
  discordId: string;
  username: string | null;
  avatar: string | null;
  email: string | null;
  isAdmin: boolean;
}

const UserContext = createContext<AppUser | null>(null);

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, []);

  return (
    <UserContext.Provider value={user}>{children}</UserContext.Provider>
  );
}
