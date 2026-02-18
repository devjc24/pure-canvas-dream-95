import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { User, Mail, Phone, Shield, Bell, Lock, CreditCard, Camera, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { fixMojibake } from "@/lib/utils";

export default function Profile() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    transactions: true,
    marketing: false,
  });

  const { token } = useAuth();
  const [twofaEnabled, setTwofaEnabled] = useState(false);
  const [twofaLoading, setTwofaLoading] = useState(true);
  const [twofaSetup, setTwofaSetup] = useState<{ qrCodeDataUrl: string } | null>(null);
  const [twofaCode, setTwofaCode] = useState("");
  const [twofaError, setTwofaError] = useState<string | null>(null);
  const [twofaBusy, setTwofaBusy] = useState(false);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSuccess, setBankSuccess] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState({
    pixKeyType: "",
    pixKey: "",
    bankName: "",
    bankAgency: "",
    bankAccount: "",
    bankAccountType: "",
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    cpf: "",
    telefone: "",
  });
  const profileInitials = fixMojibake(profileForm.name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  const maleAvatarUrl =
    "https://img.freepik.com/psd-gratuitas/ilustracao-3d-de-avatar-ou-perfil-humano_23-2150671122.jpg";
  const femaleAvatarUrl =
    "https://img.freepik.com/psd-gratuitas/ilustracao-3d-de-avatar-ou-perfil-humano_23-2150671165.jpg";

  const isLikelyFemaleName = (fullName: string) => {
    const first = fixMojibake(fullName).trim().split(" ")[0]?.toLowerCase() || "";
    if (!first) return false;
    const femaleNames = new Set([
      "ana",
      "maria",
      "mariana",
      "juliana",
      "carla",
      "carolina",
      "camila",
      "amanda",
      "fernanda",
      "beatriz",
      "bianca",
      "bruna",
      "daniela",
      "debora",
      "elaine",
      "elisa",
      "fabiana",
      "gabriela",
      "giovana",
      "helena",
      "isabela",
      "isabel",
      "jessica",
      "joana",
      "julia",
      "lara",
      "leticia",
      "luana",
      "luiza",
      "manuela",
      "marcela",
      "patricia",
      "renata",
      "sabrina",
      "sandra",
      "thais",
      "vanessa",
      "vitoria",
    ]);
    if (femaleNames.has(first)) return true;
    return first.endsWith("a") && !first.endsWith("ra");
  };

  const avatarUrl = isLikelyFemaleName(profileForm.name) ? femaleAvatarUrl : maleAvatarUrl;

  async function fetchTwofaStatus() {
    if (!token) return;
    setTwofaLoading(true);
    try {
      const response = await fetch("/api/2fa/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      setTwofaEnabled(Boolean(data?.enabled));
    } catch {
      setTwofaEnabled(false);
    } finally {
      setTwofaLoading(false);
    }
  }

  async function startTwofaSetup() {
    if (!token) return;
    setTwofaError(null);
    setTwofaBusy(true);
    try {
      const response = await fetch("/api/2fa/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao iniciar 2FA");
      }
      const data = await response.json();
      setTwofaSetup({ qrCodeDataUrl: data.qrCodeDataUrl });
      setTwofaCode("");
    } catch (error) {
      setTwofaError(error instanceof Error ? error.message : "Erro ao iniciar 2FA");
    } finally {
      setTwofaBusy(false);
    }
  }

  async function enableTwofa() {
    if (!token) return;
    setTwofaError(null);
    setTwofaBusy(true);
    try {
      const response = await fetch("/api/2fa/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: twofaCode }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao ativar 2FA");
      }
      setTwofaEnabled(true);
      setTwofaSetup(null);
      setTwofaCode("");
    } catch (error) {
      setTwofaError(error instanceof Error ? error.message : "Erro ao ativar 2FA");
    } finally {
      setTwofaBusy(false);
    }
  }

  async function disableTwofa() {
    if (!token) return;
    setTwofaError(null);
    setTwofaBusy(true);
    try {
      const response = await fetch("/api/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: twofaCode }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao desativar 2FA");
      }
      setTwofaEnabled(false);
      setTwofaSetup(null);
      setTwofaCode("");
    } catch (error) {
      setTwofaError(error instanceof Error ? error.message : "Erro ao desativar 2FA");
    } finally {
      setTwofaBusy(false);
    }
  }

  useEffect(() => {
    fetchTwofaStatus();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setBankLoading(true);
    fetch("/api/profile/bank", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const values = data?.data || {};
        setBankForm({
          pixKeyType: values.pix_key_type || "",
          pixKey: values.pix_key || "",
          bankName: values.bank_name || "",
          bankAgency: values.bank_agency || "",
          bankAccount: values.bank_account || "",
          bankAccountType: values.bank_account_type || "",
        });
      })
      .catch(() => {
        setBankError("Erro ao carregar dados bancarios");
      })
      .finally(() => setBankLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setProfileLoading(true);
    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const profile = data?.profile || {};
        setProfileForm({
          name: profile.name || "",
          email: profile.email || "",
          cpf: profile.cpf || "",
          telefone: profile.telefone || "",
        });
      })
      .catch(() => {
        setProfileError("Erro ao carregar dados do perfil");
      })
      .finally(() => setProfileLoading(false));
  }, [token]);

  async function handleSaveProfile() {
    if (!token) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileForm.name,
          telefone: profileForm.telefone,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao salvar perfil");
      }

      setProfileSuccess("Dados pessoais salvos");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Erro ao salvar perfil");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveBank() {
    if (!token) return;
    setBankSaving(true);
    setBankError(null);
    setBankSuccess(null);

    const normalizeDigits = (value: string) => value.replace(/\D+/g, "");
    const hasPixType = Boolean(bankForm.pixKeyType);
    const hasPixKey = Boolean(bankForm.pixKey.trim());
    const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const isRandomKey = (value: string) => {
      const compact = value.replace(/\s+/g, "");
      return isUuid(compact) || /^[0-9a-z-]{32,36}$/i.test(compact);
    };

    if (hasPixType !== hasPixKey) {
      setBankSaving(false);
      setBankError("Informe o tipo e a chave Pix");
      return;
    }

    if (hasPixType && hasPixKey) {
      const pixKey = bankForm.pixKey.trim();
      if (bankForm.pixKeyType === "CPF") {
        if (normalizeDigits(pixKey).length !== 11) {
          setBankSaving(false);
          setBankError("CPF invalido para chave Pix");
          return;
        }
      }
      if (bankForm.pixKeyType === "Email" && !isEmail(pixKey)) {
        setBankSaving(false);
        setBankError("Email invalido para chave Pix");
        return;
      }
      if (bankForm.pixKeyType === "Telefone") {
        const digits = normalizeDigits(pixKey);
        if (digits.length < 10 || digits.length > 11) {
          setBankSaving(false);
          setBankError("Telefone invalido para chave Pix");
          return;
        }
      }
      if (bankForm.pixKeyType === "Aleatoria" && !isRandomKey(pixKey)) {
        setBankSaving(false);
        setBankError("Chave aleatoria invalida");
        return;
      }
    }

    try {
      const response = await fetch("/api/profile/bank", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bankForm),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Erro ao salvar dados bancarios");
      }

      setBankSuccess("Dados bancarios salvos");
    } catch (error) {
      setBankError(error instanceof Error ? error.message : "Erro ao salvar dados bancarios");
    } finally {
      setBankSaving(false);
    }
  }

  const formatAgency = (value: string) => {
    const digits = value.replace(/\D+/g, "").slice(0, 6);
    return digits;
  };

  const formatAccount = (value: string) => {
    const digits = value.replace(/\D+/g, "").slice(0, 12);
    if (digits.length <= 1) return digits;
    return `${digits.slice(0, -1)}-${digits.slice(-1)}`;
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
            <p className="text-muted-foreground">Gerencie suas informações pessoais e preferências</p>
          </div>
        </motion.div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6 flex flex-col">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-2 border-primary">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                        {profileInitials}
                      </AvatarFallback>
                    </Avatar>
                    <button className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-center sm:text-left">
                    <h2 className="text-xl font-bold">
                      {fixMojibake(profileForm.name) || "Usuario"}
                    </h2>
                    <p className="text-muted-foreground">{profileForm.email || "-"}</p>
                    <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        <Check className="h-3 w-3" />
                        Conta Verificada
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          twofaEnabled
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <Shield className="h-3 w-3" />
                        {twofaEnabled ? "2FA Ativo" : "2FA Desativado"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <div className="relative z-10 space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Informações Pessoais
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome completo</label>
                    <Input
                      className="bg-secondary/50"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                      disabled={profileLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CPF</label>
                    <Input value={profileForm.cpf} disabled className="bg-secondary/30" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      E-mail
                    </label>
                    <Input
                      className="bg-secondary/30"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Telefone
                    </label>
                    <Input
                      className="bg-secondary/50"
                      value={profileForm.telefone}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, telefone: e.target.value }))}
                      disabled={profileLoading}
                    />
                  </div>
                </div>

                {profileError && <p className="text-sm text-destructive">{profileError}</p>}
                {profileSuccess && <p className="text-sm text-success">{profileSuccess}</p>}
                <Button className="gap-2" onClick={handleSaveProfile} disabled={profileSaving || profileLoading}>
                  {profileSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </motion.div>

            {/* Bank Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="stat-card flex-1"
            >
              <div className="relative z-10 space-y-6 h-full">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Dados Bancarios
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de chave Pix</label>
                    <Select
                      value={bankForm.pixKeyType || undefined}
                      onValueChange={(value) => setBankForm((prev) => ({ ...prev, pixKeyType: value }))}
                      disabled={bankLoading}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Telefone">Telefone</SelectItem>
                        <SelectItem value="Aleatoria">Aleatoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Chave Pix</label>
                    <Input
                      placeholder="Sua chave Pix"
                      className="bg-secondary/50"
                      value={bankForm.pixKey}
                      onChange={(e) => setBankForm((prev) => ({ ...prev, pixKey: e.target.value }))}
                      disabled={bankLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Banco</label>
                    <Input
                      placeholder="Nome do banco"
                      className="bg-secondary/50"
                      value={bankForm.bankName}
                      onChange={(e) => setBankForm((prev) => ({ ...prev, bankName: e.target.value }))}
                      disabled={bankLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Agencia</label>
                    <Input
                      placeholder="0001"
                      className="bg-secondary/50"
                      value={bankForm.bankAgency}
                      onChange={(e) =>
                        setBankForm((prev) => ({ ...prev, bankAgency: formatAgency(e.target.value) }))
                      }
                      disabled={bankLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Conta</label>
                    <Input
                      placeholder="000123-4"
                      className="bg-secondary/50"
                      value={bankForm.bankAccount}
                      onChange={(e) =>
                        setBankForm((prev) => ({ ...prev, bankAccount: formatAccount(e.target.value) }))
                      }
                      disabled={bankLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de conta</label>
                    <Select
                      value={bankForm.bankAccountType || undefined}
                      onValueChange={(value) => setBankForm((prev) => ({ ...prev, bankAccountType: value }))}
                      disabled={bankLoading}
                    >
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Corrente">Corrente</SelectItem>
                        <SelectItem value="Poupanca">Poupanca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {bankError && <p className="text-sm text-destructive">{bankError}</p>}
                {bankSuccess && <p className="text-sm text-success">{bankSuccess}</p>}
                <Button className="gap-2" onClick={handleSaveBank} disabled={bankSaving || bankLoading}>
                  {bankSaving ? "Salvando..." : "Salvar Dados Bancarios"}
                </Button>
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            {/* Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <div className="relative z-10 space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Segurança
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Senha</p>
                        <p className="text-sm text-muted-foreground">Última alteração há 30 dias</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Alterar</Button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">Autenticação em 2 fatores</p>
                        <p className="text-sm text-muted-foreground">
                          {twofaLoading
                            ? "Carregando..."
                            : twofaEnabled
                              ? "Ativo via app autenticador"
                              : "Desativado"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={twofaEnabled ? "outline" : "default"}
                      size="sm"
                      onClick={twofaEnabled ? undefined : startTwofaSetup}
                      disabled={twofaLoading || twofaBusy || twofaEnabled}
                    >
                      {twofaEnabled ? "Ativo" : "Ativar"}
                    </Button>
                  </div>
                  {!twofaEnabled && twofaSetup && (
                    <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
                      <div>
                        <p className="text-sm font-medium">Escaneie o QR Code no seu app</p>
                        <img
                          src={twofaSetup.qrCodeDataUrl}
                          alt="QR code 2FA"
                          className="mt-3 h-40 w-40 rounded bg-white p-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Codigo do app</label>
                        <Input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={twofaCode}
                          onChange={(e) => setTwofaCode(e.target.value)}
                        />
                      </div>
                      {twofaError && <p className="text-sm text-destructive">{twofaError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={enableTwofa} disabled={twofaBusy}>Confirmar 2FA</Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setTwofaSetup(null);
                            setTwofaCode("");
                            setTwofaError(null);
                          }}
                          disabled={twofaBusy}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                  {twofaEnabled && (
                    <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Codigo do app</label>
                        <Input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={twofaCode}
                          onChange={(e) => setTwofaCode(e.target.value)}
                        />
                      </div>
                      {twofaError && <p className="text-sm text-destructive">{twofaError}</p>}
                      <Button variant="outline" onClick={disableTwofa} disabled={twofaBusy}>
                        Desativar 2FA
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Limite de saque diário</p>
                        <p className="text-sm text-muted-foreground">R$ 50.000,00</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Alterar</Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="stat-card"
            >
              <div className="relative z-10 space-y-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notificações
                </h3>
                
                <div className="space-y-4">
                  {[
                    { key: "email", label: "Notificações por e-mail", desc: "Receba atualizações importantes por e-mail" },
                    { key: "push", label: "Notificações push", desc: "Receba notificações em tempo real no navegador" },
                    { key: "transactions", label: "Alertas de transações", desc: "Seja notificado sobre compras, vendas e saques" },
                    { key: "marketing", label: "Novidades e promoções", desc: "Receba ofertas e novidades da plataforma" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch 
                        checked={notifications[item.key as keyof typeof notifications]}
                        onCheckedChange={(checked) => 
                          setNotifications(prev => ({ ...prev, [item.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
}
