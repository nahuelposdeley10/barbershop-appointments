"use client";

import { useEffect, useState } from "react";
import AdminLogin from "../components/admin/AdminLogin";
import AdminPage from "../components/admin/AdminPage";

export default function Admin() {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    const t = localStorage.getItem("tby_token") || "";
    if (t) setToken(t);
  }, []);

  function handleLogin(t: string) {
    localStorage.setItem("tby_token", t);
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem("tby_token");
    setToken("");
  }

  if (token) {
    return <AdminPage token={token} onLogout={handleLogout} />;
  }
  return <AdminLogin onLogin={handleLogin} />;
}
