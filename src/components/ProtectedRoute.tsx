import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !roles.includes(requiredRole)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4" dir="rtl">
        <h1 className="text-2xl font-bold">אין לך הרשאה לדף זה</h1>
        <p className="text-muted-foreground">פנה למנהל המערכת לקבלת גישה</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
