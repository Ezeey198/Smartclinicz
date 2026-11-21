import { createContext, useContext, useEffect, useState } from "react";
import api, { TOKEN_KEY } from "./api";
import { store } from "./storage";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!store.get(TOKEN_KEY));

  useEffect(() => {
    if (!store.get(TOKEN_KEY)) return;
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => store.del(TOKEN_KEY)).finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    store.set(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };
  const refresh = async () => { const r = await api.get("/auth/me"); setUser(r.data); return r.data; };
  const logout = () => {
    store.del(TOKEN_KEY);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
