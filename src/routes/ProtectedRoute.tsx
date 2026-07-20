import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">Loading...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};
export default ProtectedRoute;
