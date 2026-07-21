import { Navigate, Outlet } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center gap-4 text-slate-400">
        <LoaderCircle size={40} className="animate-spin text-cyan-400" />
        <p className="text-sm">Restoring your session…</p>
      </div>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
