import { MainLayout } from "@/components/layout/MainLayout";
import { CryptoTable } from "@/components/crypto/CryptoTable";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";

export default function CryptoList() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Criptomoedas</h1>
          </div>
        </motion.div>

        {/* Crypto Table */}
        <CryptoTable />
      </div>
    </MainLayout>
  );
}
