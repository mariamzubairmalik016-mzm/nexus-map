import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
const AdminRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">Checking admin access...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return profile?.role === "admin" ? <Outlet /> : <Navigate to="/dashboard" replace />;
};
export default AdminRoute;
