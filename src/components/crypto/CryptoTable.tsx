import { motion } from "framer-motion";
import { useCryptoData } from "@/hooks/useCryptoData";
import { CryptoRow } from "./CryptoRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { type CryptoData } from "@/hooks/useCryptoData";
import { TradeModal } from "@/components/crypto/TradeModal";
import { formatCurrency, formatPercentage } from "@/hooks/useCryptoData";

export function CryptoTable() {
  const { data: cryptos, isLoading } = useCryptoData();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [tradeOpen, setTradeOpen] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);

  const filteredCryptos = useMemo(() => (
    cryptos?.filter(
      (crypto) =>
        crypto.name.toLowerCase().includes(search.toLowerCase()) ||
        crypto.symbol.toLowerCase().includes(search.toLowerCase())
    )
  ), [cryptos, search]);

  return (
    <div className="stat-card !p-0 overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar criptomoeda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/30">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                Moeda
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                Preço
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                24h
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                Market Cap
              </th>
              <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                7 Dias
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </td>
                  <td className="py-4 px-4">
                    <Skeleton className="h-6 w-16 ml-auto rounded-full" />
                  </td>
                  <td className="py-4 px-4">
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </td>
                  <td className="py-4 px-4">
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </td>
                </tr>
              ))
            ) : (
              filteredCryptos?.map((crypto, index) => (
                <tr key={crypto.id} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => navigate(`/crypto/${crypto.id}`)}>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img src={crypto.image} alt={crypto.name} className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="font-medium text-sm">{crypto.name}</div>
                        <div className="text-xs text-muted-foreground uppercase">{crypto.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">{formatCurrency(crypto.current_price)}</td>
                  <td className="py-4 px-4 text-right">{formatPercentage(crypto.price_change_percentage_24h)}</td>
                  <td className="py-4 px-4 text-right">{formatCurrency(crypto.market_cap)}</td>
                  <td className="py-4 px-4 text-right">
                    {crypto.sparkline_in_7d?.price ? (
                      <svg width="80" height="24" viewBox="0 0 80 24">
                        <polyline
                          fill="none"
                          stroke="#4f46e5"
                          strokeWidth="2"
                          points={
                            crypto.sparkline_in_7d.price
                              .map((p, i, arr) => {
                                const min = Math.min(...arr);
                                const max = Math.max(...arr);
                                const y = 20 - ((p - min) / (max - min || 1)) * 20;
                                const x = (i / (arr.length - 1)) * 78 + 1;
                                return `${x},${y}`;
                              })
                              .join(" ")
                          }
                        />
                      </svg>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
