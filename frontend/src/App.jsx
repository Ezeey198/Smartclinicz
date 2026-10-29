import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Shell from "./components/Shell";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import { Activate, ApproveClinic } from "./pages/Links";

function Guard({ superadmin }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!!superadmin !== !!user.is_superadmin) return <Navigate to={user.is_superadmin ? "/super" : "/app"} replace />;
  return <Shell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/approve-clinic" element={<ApproveClinic />} />
      <Route path="/super/*" element={<Guard superadmin />} />
      <Route path="/app/*" element={<Guard />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
