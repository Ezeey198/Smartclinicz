import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Shell from "./components/Shell";
import { Spinner } from "./components/ui";
import ServerBanner from "./components/ServerBanner";
import Login from "./pages/Login";
import About from "./pages/public/About";
import ClinicPage from "./pages/public/ClinicPage";
import Directory from "./pages/public/Directory";
import Home from "./pages/public/Home";
import PublicLayout from "./pages/public/PublicLayout";
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
    <>
    <ServerBanner />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/clinics" element={<Directory />} />
        <Route path="/clinics/:code" element={<ClinicPage />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/approve-clinic" element={<ApproveClinic />} />
      <Route path="/super/*" element={<Guard superadmin />} />
      <Route path="/app/*" element={<Guard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
