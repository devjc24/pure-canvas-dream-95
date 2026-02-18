import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, UserCog } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminUserDetail = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  active: boolean;
  createdAt: string;
  roles: string[];
  saldoDisponivel: number;
  saldoBloqueado: number;
};

type AuditLog = {
  id: number;
  action: string;
  actorName?: string;
  actorEmail?: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown> | null;
};

export default function AdminUserDetail() {
  const { token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const userId = Number(params.id);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tempPassword, setTempPassword] = useState("");
  const [tempOpen, setTempOpen] = useState(false);

  const loadUser = () => {
    if (!token || !Number.isFinite(userId)) return;
    setLoading(true);
    fetch(`/api/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUser(data?.user || null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  };

  const loadAudit = () => {
    if (!token || !Number.isFinite(userId)) return;
    setAuditLoading(true);
    fetch(`/api/admin/users/${userId}/audit?limit=20`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setAuditLogs(data?.logs || []);
      })
      .catch(() => {
        setAuditLogs([]);
      })
      .finally(() => setAuditLoading(false));
  };

  useEffect(() => {
    loadUser();
    loadAudit();
  }, [token, userId]);

  const toggleStatus = () => {
    if (!token || !user) return;
    setStatusLoading(true);
    fetch(`/api/admin/users/${user.id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ active: !user.active }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao atualizar status");
        setUser({ ...user, active: !user.active });
        toast({
          title: user.active ? "Usuario desativado" : "Usuario reativado",
        });
        loadAudit();
      })
      .catch(() => {
        toast({
          title: "Falha ao atualizar",
          description: "Tente novamente.",
        });
      })
      .finally(() => setStatusLoading(false));
  };

  const resetPassword = () => {
    if (!token || !user) return;
    setResetLoading(true);
    fetch(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const password = String(data?.temporaryPassword || "").trim();
        if (!password) throw new Error("Senha nao gerada");
        setTempPassword(password);
        setTempOpen(true);
        loadAudit();
      })
      .catch(() => {
        toast({
          title: "Falha ao resetar",
          description: "Tente novamente.",
        });
      })
      .finally(() => setResetLoading(false));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Detalhes do usuario</h1>
              <p className="text-muted-foreground">Perfil, saldo e acoes administrativas</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/admgerencial/usuarios")}> 
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold">{user?.name || "Usuario"}</h3>
                <p className="text-sm text-muted-foreground">{user?.email || "-"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/admgerencial?user=${user?.id}`)}
                  disabled={!user}
                >
                  Ver transacoes
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant={user?.active ? "destructive" : "default"} disabled={!user || statusLoading}>
                      {statusLoading ? "Processando..." : user?.active ? "Desativar" : "Reativar"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar alteracao</AlertDialogTitle>
                      <AlertDialogDescription>
                        {user?.active
                          ? "Deseja desativar este usuario?"
                          : "Deseja reativar este usuario?"}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={toggleStatus}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={!user || resetLoading}>
                      {resetLoading ? "Gerando..." : "Resetar senha"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resetar senha</AlertDialogTitle>
                      <AlertDialogDescription>
                        Uma senha temporaria sera gerada para este usuario.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={resetPassword}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando usuario...</p>
            ) : user ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-base font-semibold">{user.active ? "Ativo" : "Inativo"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="text-base font-semibold">{user.cpf || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-base font-semibold">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Roles</p>
                  <p className="text-base font-semibold">{user.roles.join(", ") || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo disponivel</p>
                  <p className="text-base font-semibold">R$ {user.saldoDisponivel.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo bloqueado</p>
                  <p className="text-base font-semibold">R$ {user.saldoBloqueado.toFixed(2)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Usuario nao encontrado.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Auditoria recente</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Acao</TableHead>
                  <TableHead>Executado por</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Carregando auditoria...
                    </TableCell>
                  </TableRow>
                ) : auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{log.actorName || "-"}</span>
                          <span className="text-xs text-muted-foreground">{log.actorEmail || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>{log.ipAddress || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>

        <Dialog open={tempOpen} onOpenChange={setTempOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Senha temporaria</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Informe esta senha ao usuario e oriente a troca imediata.
              </p>
              <div className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono">
                {tempPassword}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (tempPassword) {
                    navigator.clipboard.writeText(tempPassword).catch(() => null);
                    toast({ title: "Senha copiada" });
                  }
                }}
              >
                Copiar
              </Button>
              <Button onClick={() => setTempOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
