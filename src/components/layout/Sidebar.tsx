import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Coins, 
  ArrowUpDown, 
  FileText, 
  Settings,
  Home,
  User,
  Wallet,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bell,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Criptomoedas", href: "/crypto", icon: Coins },
  { name: "Depósito / Saque", href: "/wallet", icon: ArrowUpDown },
  { name: "Relatórios", href: "/reports", icon: FileText },
  { name: "Indicações", href: "/referrals", icon: Users },
  { name: "Perfil", href: "/profile", icon: User },
];

const adminNavigation = [
  { name: "Admin Gerencial", href: "/admgerencial", icon: ShieldCheck },
  { name: "Usuarios", href: "/admgerencial/usuarios", icon: Users },
  { name: "Afiliados", href: "/admgerencial/afiliados", icon: Users },
  { name: "Relatórios Admin", href: "/admgerencial/relatorios", icon: FileText },
  { name: "Notificações", href: "/admgerencial/notificacoes", icon: Bell },
  { name: "Configurações", href: "/admgerencial/configuracoes", icon: Settings },
  { name: "Voltar ao App", href: "/", icon: Home },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  variant?: "fixed" | "inline";
}

export function Sidebar({ collapsed = false, onToggle, variant = "fixed" }: SidebarProps) {
  const location = useLocation();
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admgerencial");
  const items = user?.role === "admin"
    ? (isAdminRoute ? adminNavigation : [...navigation, { name: "Admin", href: "/admgerencial", icon: ShieldCheck }])
    : navigation;

  const [saldo, setSaldo] = useState<number | null>(null);
  const [saldoAnterior, setSaldoAnterior] = useState<number | null>(null);
  const [lucro, setLucro] = useState<number | null>(null);
  const [totalInvestido, setTotalInvestido] = useState<number | null>(null);

  // Busca saldo atual e saldo de 24h atrás
  useEffect(() => {
    async function fetchSaldoDetalhado() {
      try {
        const res = await fetch("/api/wallet/balance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar saldo detalhado");
        const data = await res.json();
        setSaldo(data.saldoDisponivel);
        setSaldoAnterior(typeof data.saldoAnterior === "number" ? data.saldoAnterior : null);
      } catch {
        setSaldo(null);
        setSaldoAnterior(null);
      }
    }
    if (token) fetchSaldoDetalhado();
  }, [token]);

  useEffect(() => {
    async function fetchLucro() {
      try {
        const res = await fetch("/api/wallet/profit-loss", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar lucro");
        const data = await res.json();
        setLucro(typeof data.lucro === "number" ? data.lucro : null);
      } catch {
        setLucro(null);
      }
    }
    async function fetchTotalInvestido() {
      try {
        const res = await fetch("/api/wallet/total-investido", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar total investido");
        const data = await res.json();
        setTotalInvestido(typeof data.totalInvestido === "number" ? data.totalInvestido : null);
      } catch {
        setTotalInvestido(null);
      }
    }
    if (token) {
      fetchLucro();
      fetchTotalInvestido();
    }
  }, [token]);

  // Calcula variação real igual ao dashboard
  let change = saldo !== null && saldoAnterior !== null
    ? (() => {
        const diff = saldo - saldoAnterior;
        const pct = saldoAnterior !== 0 ? (diff / saldoAnterior) * 100 : 0;
        return `${diff >= 0 ? "+" : "-"}R$ ${Math.abs(diff).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${diff >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(2)}%)`;
      })()
    : "+R$ 0,00 (+0,00%)";

  return (
    <motion.aside 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        "z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-200",
        variant === "fixed" ? "fixed left-0 top-0" : "relative",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn("flex h-16 items-center gap-3 border-b border-sidebar-border", collapsed ? "px-4" : "px-6")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary glow-effect">
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className={cn("text-xl font-bold gradient-text transition-all", collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100")}>
            CryptoPay
          </span>
          {!collapsed && onToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="ml-auto hidden md:inline-flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {collapsed && onToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="ml-auto hidden md:inline-flex"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 space-y-1 py-4", collapsed ? "px-2" : "px-3")}>
          {items.map((item, index) => {
            const hrefPath = item.href.split("?")[0];
            const isActive = location.pathname === hrefPath;
            const isSectionBreak = item.name === "Usuarios";
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(isSectionBreak && "mt-3")}
              >
                <NavLink
                  to={item.href}
                  title={item.name}
                  className={cn(
                    "nav-item",
                    isActive && "nav-item-active",
                    collapsed && "justify-center px-3"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span
                    className={cn(
                      "transition-all",
                      collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
                    )}
                  >
                    {item.name}
                  </span>
                </NavLink>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-sidebar-border p-4">
            <div className="stat-card !p-4">
              <p className="text-xs text-muted-foreground mb-1">Saldo Total</p>
              <p className="text-lg font-bold text-foreground">
                {saldo === null ? "---" : `R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              </p>
              <p className={`text-xs ${change.startsWith("+") ? "text-success" : "text-destructive"} mt-1`}>{change}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 gap-2"
              onClick={() => {
                logout();
                setTimeout(() => {
                  navigate("/login", { replace: true });
                  window.location.reload();
                }, 100);
              }}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
