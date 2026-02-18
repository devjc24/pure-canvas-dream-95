import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import CryptoList from "./pages/CryptoList";
import CryptoDetails from "./pages/CryptoDetails";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Referrals from "./pages/Referrals";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ReferralRedirect from "./pages/ReferralRedirect";
import Landing from "./pages/Landing";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminTransactionDetail from "./pages/AdminTransactionDetail";
import AdminReports from "./pages/AdminReports";
import AdminSettings from "./pages/AdminSettings";
import AdminAffiliates from "./pages/AdminAffiliates";
import AdminNotifications from "./pages/AdminNotifications";
// import AdminConsultaSinais from "./pages/AdminConsultaSinais";
import { fetchCryptos, fetchCryptoById, fetchCryptoHistory } from "@/hooks/useCryptoData";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import ProtectedRoute from "@/auth/ProtectedRoute";

const queryClient = new QueryClient();

function CryptoPrefetcher() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const prefetch = async () => {
      const cryptos = await queryClient.fetchQuery({
        queryKey: ["cryptos"],
        queryFn: fetchCryptos,
        staleTime: 1000 * 60 * 5,
      });

      if (cancelled || !cryptos) return;
      const top = cryptos.slice(0, 3);

      top.forEach((crypto) => {
        queryClient.prefetchQuery({
          queryKey: ["crypto", crypto.id],
          queryFn: () => fetchCryptoById(crypto.id),
          staleTime: 1000 * 60 * 5,
        });
        queryClient.prefetchQuery({
          queryKey: ["crypto-history", crypto.id, 1],
          queryFn: () => fetchCryptoHistory(crypto.id, 1),
          staleTime: 1000 * 60 * 10,
        });
      });
    };

    if (isAuthenticated) {
      prefetch();
    }
    return () => {
      cancelled = true;
    };
  }, [queryClient, isAuthenticated]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CryptoPrefetcher />
        <BrowserRouter>
          <Routes>
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/r/:code" element={<ReferralRedirect />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/crypto" element={<CryptoList />} />
              <Route path="/crypto/:id" element={<CryptoDetails />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/admgerencial" element={<AdminDashboard />} />
              <Route path="/admgerencial/usuarios" element={<AdminUsers />} />
              <Route path="/admgerencial/usuarios/:id" element={<AdminUserDetail />} />
              <Route path="/admgerencial/transacoes/:id" element={<AdminTransactionDetail />} />
              <Route path="/admgerencial/afiliados" element={<AdminAffiliates />} />
              <Route path="/admgerencial/relatorios" element={<AdminReports />} />
              <Route path="/admgerencial/notificacoes" element={<AdminNotifications />} />
              <Route path="/admgerencial/configuracoes" element={<AdminSettings />} />
              {/* <Route path="/admgerencial/consulta-sinais" element={<ProtectedRoute><AdminConsultaSinais /></ProtectedRoute>} /> */}
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
