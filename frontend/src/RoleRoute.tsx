import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import type { UserRole } from "./api/types";

export function roleHome(role: UserRole | undefined): string {
  if (role === "TEACHER") return "/teacher";
  if (role === "DEAN") return "/dean/teachers";
  if (role === "RECTOR") return "/rector";
  return "/login";
}

export default function RoleRoute({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={roleHome(user?.role)} replace />;
  }
  return <>{children}</>;
}
