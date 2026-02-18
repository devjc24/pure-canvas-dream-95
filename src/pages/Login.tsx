import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/auth/AuthContext";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const redirectTo = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (requires2fa && !tempToken) {
        throw new Error("Token temporario ausente");
      }

      const endpoint = requires2fa ? "/api/login/2fa" : "/api/login";
      const payload = requires2fa
        ? { tempToken, code: otpCode }
        : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Credenciais invalidas");
      }

      const data = await response.json();
      if (data?.requires2fa) {
        if (!data?.tempToken) {
          throw new Error("Token temporario ausente");
        }
        setRequires2fa(true);
        setTempToken(data.tempToken);
        setOtpCode("");
        setIsSubmitting(false);
        return;
      }

      if (!data?.token) {
        throw new Error("Falha ao iniciar sessao");
      }

      login(data.token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-xl shadow-lg bg-card border border-border"
      >
        <h2 className="text-2xl font-bold mb-2 text-center text-foreground">Entrar</h2>
        <p className="text-muted-foreground mb-6 text-center">
          {requires2fa ? "Informe o codigo do seu app 2FA" : "Acesse sua conta para continuar"}
        </p>
        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="email">Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Mail className="w-4 h-4" />
              </span>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="pl-10"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={requires2fa}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="password">Senha</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="w-4 h-4" />
              </span>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="pl-10 pr-10"
                placeholder="Sua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={requires2fa}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {requires2fa && (
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground" htmlFor="otp">Codigo 2FA</label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-2">Use o codigo de 6 digitos do seu app.</p>
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : requires2fa ? "Confirmar 2FA" : "Entrar"}
          </Button>
          {requires2fa && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setRequires2fa(false);
                setTempToken(null);
                setOtpCode("");
                setError(null);
              }}
              disabled={isSubmitting}
            >
              Voltar
            </Button>
          )}
        </form>
        <div className="mt-6 text-center">
          <span className="text-sm text-muted-foreground">Não possui uma conta?</span>
          <Link
            to="/register"
            className="ml-1 text-primary font-medium hover:underline"
          >
            Cadastre-se
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
