import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import CookieBanner from "@/components/CookieBanner";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";

// Eager load public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

// Lazy load admin/staff pages
const Kitchen = lazy(() => import("./pages/Kitchen"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const AdminAvailability = lazy(() => import("./pages/AdminAvailability"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const StationSetup = lazy(() => import("./pages/StationSetup"));
const Kiosk = lazy(() => import("./pages/Kiosk"));

// Lazy load legal pages
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CustomerAuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/track" element={<OrderTracking />} />
              <Route path="/kiosk" element={<Kiosk />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route
                path="/kitchen"
                element={
                  <ProtectedRoute requiredRole="kitchen">
                    <Kitchen />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/availability"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminAvailability />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/station-setup"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <StationSetup />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CookieBanner />
        </BrowserRouter>
      </CustomerAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
