import { MainLayout } from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import { ArrowLeft, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminTransaction = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userCpf: string;
  tipo: string;
  status: string;
  valorBruto: number;
  valorLiquido: number;
  idTransaction: string | null;
  externalReference: string | null;
  localId: string | null;
  paymentCode: string | null;
  paymentCodeBase64: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminTransactionDetail() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const transactionId = Number(params.id);
  const [transaction, setTransaction] = useState<AdminTransaction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !Number.isFinite(transactionId)) return;
    setLoading(true);
    fetch(`/api/admin/transactions/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setTransaction(data?.transaction || null);
      })
      .catch(() => {
        setTransaction(null);
      })
      .finally(() => setLoading(false));
  }, [token, transactionId]);

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
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Detalhes da transacao</h1>
              <p className="text-muted-foreground">Informacoes completas da transacao</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/admgerencial")}
          >
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
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando transacao...</p>
            ) : transaction ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="text-base font-semibold">{transaction.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-base font-semibold">{transaction.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-base font-semibold">{transaction.tipo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-base font-semibold">R$ {transaction.valorLiquido || transaction.valorBruto}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-base font-semibold">
                    {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atualizado em</p>
                  <p className="text-base font-semibold">
                    {transaction.updatedAt ? new Date(transaction.updatedAt).toLocaleString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="text-base font-semibold">{transaction.userName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-base font-semibold">{transaction.userEmail || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="text-base font-semibold">{transaction.userCpf || "-"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Transacao nao encontrada.</p>
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
            <h3 className="text-lg font-semibold mb-4">Referencias</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>ID transaction</TableCell>
                  <TableCell>{transaction?.idTransaction || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>External reference</TableCell>
                  <TableCell>{transaction?.externalReference || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ID local</TableCell>
                  <TableCell>{transaction?.localId || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Payment code</TableCell>
                  <TableCell className="break-all">{transaction?.paymentCode || "-"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
