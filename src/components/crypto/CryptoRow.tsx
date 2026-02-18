import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, LineChart } from "lucide-react";
import { CryptoData, formatCurrency, formatPercentage } from "@/hooks/useCryptoData";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CryptoRowProps {
  crypto: CryptoData;
  index: number;
  onClick?: () => void;
  onHover?: () => void;
  onTrade?: () => void;
}

export function CryptoRow({ crypto, index, onClick, onHover, onTrade }: CryptoRowProps) {
  const isPositive = crypto.price_change_percentage_24h >= 0;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      onMouseEnter={onHover}
      className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer group"
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <img 
            src={crypto.image} 
            alt={crypto.name} 
            className="w-8 h-8 rounded-full"
          />
          <div>
            <p className="font-medium text-foreground group-hover:text-primary transition-colors">
              {crypto.name}
            </p>
            <p className="text-sm text-muted-foreground uppercase">
              {crypto.symbol}
            </p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-right font-medium">
        {formatCurrency(crypto.current_price)}
      </td>
      <td className="py-4 px-4 text-right">
        <div className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
          isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatPercentage(crypto.price_change_percentage_24h)}
        </div>
      </td>
      <td className="py-4 px-4 text-right text-muted-foreground">
        {formatCurrency(crypto.market_cap)}
      </td>
      <td className="py-4 px-4">
        <MiniChart 
          data={crypto.sparkline_in_7d?.price || []} 
          isPositive={isPositive}
        />
      </td>
      <td className="py-4 px-4 text-right">
        <Button
          size="sm"
          variant="outline"
          title="Negociar"
          aria-label="Negociar"
          onClick={(event) => {
            event.stopPropagation();
            onTrade?.();
          }}
        >
          <LineChart className="h-4 w-4 mr-2" />
          Negociar
        </Button>
      </td>
    </motion.tr>
  );
}

function MiniChart({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .filter((_, i) => i % 4 === 0) // Sample every 4th point for performance
    .map((value, index, arr) => {
      const x = (index / (arr.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="w-24 h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"}
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}
