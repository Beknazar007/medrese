import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { FullScreenLoader } from "./components/SlowServerNotice";
import { useAuth } from "./context/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
