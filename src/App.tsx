import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import CookieBanner from "@/components/CookieBanner";
import AccessibilityWidgetGlobal from "@/components/AccessibilityWidgetGlobal";
import PostInstallPermissionModal from "@/components/PostInstallPermissionModal";
import GeoGate from "@/components/GeoGate";
import OfflineBanner from "@/components/OfflineBanner";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { FlyToCartProvider } from "@/contexts/FlyToCartContext";
import { SkibidiGuardProvider } from "@/components/SkibidiGuard";

// Eager load public pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Install from "./pages/Install";
import KitchenInstall from "./pages/KitchenInstall";

// Lazy load admin/staff pages
const Kitchen = lazy(() => import("./pages/Kitchen"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const AdminAvailability = lazy(() => import("./pages/AdminAvailability"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const StationSetup = lazy(() => import("./pages/StationSetup"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InventoryFridge = lazy(() => import("./pages/InventoryFridge"));
const EventBooking = lazy(() => import("./pages/EventBooking"));
const EventsAdmin = lazy(() => import("./pages/EventsAdmin"));
const EventsKitchen = lazy(() => import("./pages/EventsKitchen"));

// Lazy load legal pages
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const AccessibilityStatement = lazy(() => import("./pages/AccessibilityStatement"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const Courier = lazy(() => import("./pages/Courier"));
const AdminCouriers = lazy(() => import("./pages/AdminCouriers"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute — avoid refetching on every remount
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false, // don't refetch on every tab switch
      retry: 1,
    },
  },
});

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CustomerAuthProvider>
      <FlyToCartProvider>
      <SkibidiGuardProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <BrowserRouter>
          <GeoGate>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/index" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/install" element={<Install />} />
              <Route path="/kitchen/install" element={<KitchenInstall />} />
              <Route path="/track" element={<OrderTracking />} />
              <Route path="/kiosk" element={<Kiosk />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/accessibility-statement" element={<AccessibilityStatement />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              
              <Route path="/courier" element={<Courier />} />
              <Route
                path="/admin/couriers"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminCouriers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kitchen"
                element={
                  <ProtectedRoute requiredRole={["kitchen", "admin"]}>
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
              <Route path="/inventory/:token" element={<Inventory />} />
              <Route path="/inventory/:token/fridge" element={<InventoryFridge />} />
              <Route path="/events" element={<EventBooking />} />
              <Route
                path="/events/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <EventsAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events/kitchen"
                element={
                  <ProtectedRoute requiredRole={["kitchen", "admin"]}>
                    <EventsKitchen />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CookieBanner />
          <AccessibilityWidgetGlobal />
          <PostInstallPermissionModal />
          </GeoGate>
        </BrowserRouter>
      </SkibidiGuardProvider>
      </FlyToCartProvider>
      </CustomerAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
