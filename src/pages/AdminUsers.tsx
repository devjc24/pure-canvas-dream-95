import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  active: boolean;
  createdAt: string;
  roles: string[];
};

type AdminUserDetail = AdminUser & {
  saldoDisponivel: number;
  saldoBloqueado: number;
};

export default function AdminUsers() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserDetail | null>(null);
  const [editRole, setEditRole] = useState("user");
  const [editSaldo, setEditSaldo] = useState("");
  const [editSaldoBloqueado, setEditSaldoBloqueado] = useState("");
  const pageSize = 20;

  useEffect(() => {
    loadUsers(1);
  }, [token]);

  const csvEscape = (value: string | number | null | undefined) => {
    const raw = String(value ?? "");
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const exportUsersCsv = () => {
    if (!users.length) return;
    const header = ["id", "nome", "email", "cpf", "status", "criado_em", "roles"];
    const rows = users.map((user) => [
      user.id,
      user.name,
      user.email,
      user.cpf,
      user.active ? "ATIVO" : "INATIVO",
      user.createdAt,
      user.roles.join("|"),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "usuarios.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadUsers = (page = 1) => {
    if (!token) return;
    setUsersLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String((page - 1) * pageSize));
    if (usersSearch.trim()) {
      params.set("search", usersSearch.trim());
    }
    if (usersRoleFilter && usersRoleFilter !== "all") {
      params.set("role", usersRoleFilter);
    }
    fetch(`/api/admin/users?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUsers(data?.users || []);
        setUsersTotal(data?.total || 0);
        setUsersPage(page);
      })
      .catch(() => {
        setUsers([]);
        setUsersTotal(0);
        toast({ title: "Falha ao carregar usuarios" });
      })
      .finally(() => setUsersLoading(false));
  };

  const openEditUser = (userId: number) => {
    if (!token) return;
    setEditLoading(true);
    fetch(`/api/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const user = data?.user;
        if (!user) {
          toast({ title: "Usuario nao encontrado" });
          return;
        }
        setEditUser(user);
        setEditRole(user.roles?.includes("admin") ? "admin" : "user");
        setEditSaldo(String(user.saldoDisponivel ?? 0));
        setEditSaldoBloqueado(String(user.saldoBloqueado ?? 0));
        setEditOpen(true);
      })
      .catch(() => {
        toast({ title: "Falha ao carregar usuario" });
      })
      .finally(() => setEditLoading(false));
  };

  const saveEditUser = () => {
    if (!token || !editUser) return;
    setEditSaving(true);
    const saldoDisponivel = Number(String(editSaldo).replace(/[^0-9.,]/g, "").replace(",", "."));
    const saldoBloqueado = Number(String(editSaldoBloqueado).replace(/[^0-9.,]/g, "").replace(",", "."));
    fetch(`/api/admin/users/${editUser.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: editRole,
        saldoDisponivel,
        saldoBloqueado,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Falha ao atualizar usuario");
        }
        setEditOpen(false);
        setEditUser(null);
        loadUsers(usersPage);
        toast({ title: "Usuario atualizado" });
      })
      .catch(() => {
        toast({ title: "Falha ao salvar usuario" });
      })
      .finally(() => setEditSaving(false));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
            <p className="text-muted-foreground">Gestao de usuarios da plataforma</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-4">Usuarios ({usersTotal})</h3>
            <div className="flex flex-col lg:flex-row gap-2 mb-4">
              <Input
                placeholder="Buscar por nome, email ou CPF"
                value={usersSearch}
                onChange={(event) => setUsersSearch(event.target.value)}
                className="bg-secondary/50"
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={usersRoleFilter}
                onChange={(event) => setUsersRoleFilter(event.target.value)}
              >
                <option value="all">Todos</option>
                <option value="admin">Administradores</option>
                <option value="user">Usuarios</option>
              </select>
              <div className="flex gap-2">
                <Button onClick={() => loadUsers(1)} disabled={usersLoading}>
                  {usersLoading ? "Carregando..." : "Buscar"}
                </Button>
                <Button variant="outline" onClick={exportUsersCsv} disabled={!users.length}>
                  Exportar CSV
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Nenhum usuario encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.active ? "Ativo" : "Inativo"}</TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{user.roles.join(", ") || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admgerencial/usuarios/${user.id}`)}
                          >
                            Detalhes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admgerencial?user=${user.id}`)}
                          >
                            Ver transacoes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditUser(user.id)}
                            disabled={editLoading}
                          >
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Pagina {usersPage} de {Math.max(1, Math.ceil(usersTotal / pageSize))}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadUsers(Math.max(1, usersPage - 1))}
                  disabled={usersPage <= 1 || usersLoading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadUsers(usersPage + 1)}
                  disabled={usersPage >= Math.ceil(usersTotal / pageSize) || usersLoading}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditUser(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editUser ? `${editUser.name} • ${editUser.email}` : ""}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de usuario</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value)}
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Saldo disponivel (R$)</label>
                <Input
                  value={editSaldo}
                  onChange={(event) => setEditSaldo(event.target.value)}
                  className="bg-secondary/50"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Saldo bloqueado (R$)</label>
                <Input
                  value={editSaldoBloqueado}
                  onChange={(event) => setEditSaldoBloqueado(event.target.value)}
                  className="bg-secondary/50"
                  inputMode="decimal"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button onClick={saveEditUser} disabled={editSaving || !editUser}>
                {editSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
