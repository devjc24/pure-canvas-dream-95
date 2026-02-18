import { useQuery } from "@tanstack/react-query";

export interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_24h?: number;
  market_cap: number;
  market_cap_rank?: number;
  total_volume: number;
  high_24h?: number;
  low_24h?: number;
  circulating_supply?: number;
  sparkline_in_7d?: {
    price: number[];
  };
}

export interface CryptoHistoryPoint {
  time: number;
  price: number;
}

export interface CryptoOhlcPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const fetchCryptos = async (): Promise<CryptoData[]> => {
  const response = await fetch(
    "/api/coingecko/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=20&page=1&sparkline=true"
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch crypto data");
  }
  
  return response.json();
};

export function useCryptoData() {
  return useQuery({
    queryKey: ["cryptos"],
    queryFn: fetchCryptos,
    refetchInterval: 120000,
    staleTime: 120000,
  });
}

export const fetchCryptoById = async (cryptoId: string): Promise<CryptoData | null> => {
  const response = await fetch(
    `/api/coingecko/coins/markets?vs_currency=brl&ids=${encodeURIComponent(cryptoId)}&sparkline=true`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch crypto details");
  }

  const data = (await response.json()) as CryptoData[];
  return data[0] ?? null;
};

export const fetchCryptoHistory = async (cryptoId: string, days: number): Promise<CryptoHistoryPoint[]> => {
  const isSubDay = days < 1;
  const rangeSeconds = Math.max(60 * 5, Math.floor(days * 24 * 60 * 60));
  const now = Math.floor(Date.now() / 1000);
  const from = now - rangeSeconds;
  const endpoint = isSubDay
    ? `/api/coingecko/coins/${encodeURIComponent(cryptoId)}/market_chart/range?vs_currency=brl&from=${from}&to=${now}`
    : `/api/coingecko/coins/${encodeURIComponent(cryptoId)}/market_chart?vs_currency=brl&days=${days}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error("Failed to fetch crypto history");
  }

  const data = await response.json();
  const prices: [number, number][] = data?.prices ?? [];
  return prices.map(([time, price]) => ({ time, price }));
};

export const fetchCryptoOhlc = async (cryptoId: string, days: number): Promise<CryptoOhlcPoint[]> => {
  const response = await fetch(
    `/api/coingecko/coins/${encodeURIComponent(cryptoId)}/ohlc?vs_currency=brl&days=${days}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch crypto OHLC");
  }

  const data = (await response.json()) as [number, number, number, number, number][];
  return data.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
};

export function useCryptoDetails(cryptoId?: string) {
  return useQuery({
    queryKey: ["crypto", cryptoId],
    queryFn: () => fetchCryptoById(cryptoId as string),
    enabled: !!cryptoId,
    refetchInterval: 120000,
    staleTime: 120000,
  });
}

export function useCryptoHistory(cryptoId?: string, days: number = 1, refetchInterval?: number, staleTime?: number) {
  return useQuery({
    queryKey: ["crypto-history", cryptoId, days],
    queryFn: () => fetchCryptoHistory(cryptoId as string, days),
    enabled: !!cryptoId,
    refetchInterval: refetchInterval ?? false,
    staleTime,
    gcTime: 1000 * 60 * 60,
  });
}

export function useCryptoOhlc(
  cryptoId?: string,
  days: number = 1,
  enabled: boolean = true,
  refetchInterval?: number,
  staleTime?: number
) {
  return useQuery({
    queryKey: ["crypto-ohlc", cryptoId, days],
    queryFn: () => fetchCryptoOhlc(cryptoId as string, days),
    enabled: !!cryptoId && enabled,
    refetchInterval: refetchInterval ?? false,
    staleTime,
    gcTime: 1000 * 60 * 60,
  });
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (typeof value !== "number" || isNaN(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}
