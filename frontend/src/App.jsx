import { useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Workspace from "./components/Workspace";
import { api } from "./lib/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(localStorage.getItem("verity_token")));

  useEffect(() => {
    if (!checking) return;
    api.me()
      .then(setUser)
      .catch(() => localStorage.removeItem("verity_token"))
      .finally(() => setChecking(false));
  }, [checking]);

  function logout() {
    localStorage.removeItem("verity_token");
    setUser(null);
  }

  if (checking) return <div className="boot-screen"><span className="boot-mark">V</span><div className="boot-line"><i /></div></div>;
  return user ? (
    <Workspace user={user} onUserUpdate={setUser} onLogout={logout} />
  ) : (
    <AuthScreen onAuthenticated={setUser} />
  );
}
