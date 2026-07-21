import { Navigate, Outlet } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const AdminRoute = () => {
  const { user, profile, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center gap-4 text-slate-400">
        <LoaderCircle size={40} className="animate-spin text-purple-400" />
        <p className="text-sm">Checking admin access…</p>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return profile?.role === "admin" ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default AdminRoute;
