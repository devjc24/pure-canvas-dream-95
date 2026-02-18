const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const fs = require("fs");

dotenv.config();

const app = express();

const port = Number(process.env.PORT || 2900);
const corsOrigin = process.env.CORS_ORIGIN || "*";
const jwtSecret = process.env.JWT_SECRET || "change_me";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";
const twofaPendingExpiresIn = process.env.TWOFA_PENDING_EXPIRES_IN || "5m";
const twofaIssuer = process.env.TWOFA_ISSUER || "TradeNest";
const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = Number(process.env.DB_PORT || 3306);
const dbName = process.env.DB_NAME || "trade_nest_spot";
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASS || "";
const referralCommissionPercent = Number(process.env.REFERRAL_COMMISSION_PERCENT || 10);
const valorionBasicKey = process.env.VALORION_BASIC_KEY || "";
const valorionCashinApiKey = process.env.VALORION_CASHIN_API_KEY || "";
const valorionCashoutApiKey = process.env.VALORION_CASHOUT_API_KEY || valorionCashinApiKey;
const valorionCashoutPixKey = process.env.VALORION_CASHOUT_PIX_KEY || "";
const valorionPostbackUrl = process.env.VALORION_POSTBACK_URL || "";
const valorionWebhookUrl = process.env.VALORION_WEBHOOK_URL || valorionPostbackUrl;
const coingeckoBaseUrl = "https://api.coingecko.com/api/v3";

app.use(
  cors({
    origin: corsOrigin.split(",").map((item) => item.trim()),
  })
);
app.use(express.json());

const dbPool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPass,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const cacheStore = new Map();
const inflightStore = new Map();
const permissionCache = new Map();

async function getUserPermissions(userId) {
  const cacheKey = String(userId);
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  const [rows] = await dbPool.execute(
    "SELECT p.chave " +
      "FROM permissoes p " +
      "INNER JOIN role_permissoes rp ON rp.permissao_id = p.id " +
      "INNER JOIN usuario_roles ur ON ur.role_id = rp.role_id " +
      "WHERE ur.usuario_id = ?",
    [userId]
  );

  const permissions = new Set((rows || []).map((row) => row.chave));
  permissionCache.set(cacheKey, {
    permissions,
    expiresAt: Date.now() + 2 * 60 * 1000,
  });
  return permissions;
}

function clearUserPermissionCache(userId) {
  permissionCache.delete(String(userId));
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    (async () => {
      if (!req.user?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (req.user?.role === "admin") {
        return next();
      }
      const permissions = await getUserPermissions(req.user.sub);
      if (permissions.has(permissionKey)) {
        return next();
      }
      return res.status(403).json({ message: "Forbidden" });
    })().catch((error) => {
      console.error("Permission check error", error);
      return res.status(500).json({ message: "Erro ao validar permissao" });
    });
  };
}

async function logAudit({ req, action, targetType, targetId, metadata }) {
  try {
    const actorId = Number(req.user?.sub) || null;
    const ipAddress = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 120);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 200);
    const payload = metadata ? JSON.stringify(metadata) : null;
    await dbPool.execute(
      "INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, metadata, ip_address, user_agent) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      [actorId, action, targetType, targetId, payload, ipAddress, userAgent]
    );
  } catch (error) {
    console.error("Audit log error", error);
  }
}

function createRequestId() {
  return Math.random().toString(36).slice(2, 10);
}

function getCacheEntry(key, allowStale = false) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    if (allowStale && Date.now() <= entry.staleUntil) {
      return entry;
    }
    cacheStore.delete(key);
    return null;
  }
  return entry;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function trimMessage(text) {
  const raw = String(text || "").trim();
  if (!raw) return "Coingecko request failed";
  return raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cachedFetchJson(url, ttlMs, requestId) {
  const key = url;
  const cached = getCacheEntry(key);
  if (cached) return cached.data;

  if (inflightStore.has(key)) {
    return inflightStore.get(key);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const promise = fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "cryptoapp/1.0",
    },
    signal: controller.signal,
  })
    .then(async (response) => {
      const text = await response.text();
      const json = safeJsonParse(text);

      if (!response.ok) {
        const existing = getCacheEntry(key, true);
        if (response.status === 429 && existing) {
          return existing.data;
        }
        const message = json?.message || trimMessage(text);
        throw {
          status: response.status,
          message,
          url,
          requestId,
        };
      }

      const data = json ?? {};
      cacheStore.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
        staleUntil: Date.now() + ttlMs + 5 * 60 * 1000,
      });
      return data;
    })
    .catch((error) => {
      if (error?.name === "AbortError") {
        throw { status: 504, message: "Timeout ao consultar CoinGecko", url, requestId };
      }
      if (error?.status) throw error;
      throw { status: 502, message: "Falha de rede ao consultar CoinGecko", url, requestId };
    })
    .finally(() => {
      clearTimeout(timeout);
      inflightStore.delete(key);
    });

  inflightStore.set(key, promise);
  return promise;
}

async function getAvailableCryptoSymbols() {
  const requestId = createRequestId();
  const url = `${coingeckoBaseUrl}/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=20&page=1&sparkline=false`;
  const data = await cachedFetchJson(url, 2 * 60 * 1000, requestId);
  const list = Array.isArray(data) ? data : [];
  return list.map((item) => String(item?.symbol || "").toLowerCase()).filter(Boolean);
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      referral_code: user.referral_code,
      cpf: user.cpf,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function createTwofaPendingToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      twofa_pending: true,
    },
    jwtSecret,
    { expiresIn: twofaPendingExpiresIn }
  );
}

function normalizeTwofaCode(code) {
  return String(code || "").replace(/\s+/g, "");
}

function isValidTwofaCode(code) {
  return /^\d{6}$/.test(normalizeTwofaCode(code));
}

function verifyTwofaCode(secret, code) {
  if (!secret) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: normalizeTwofaCode(code),
    window: 1,
  });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

async function valorionGet(url) {
  if (!valorionBasicKey) {
    throw new Error("VALORION_BASIC_KEY not configured");
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${valorionBasicKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || "Valorion request failed";
    throw new Error(message);
  }
  return data;
}

async function getSettingValue(key) {
  try {
    const [rows] = await dbPool.execute(
      "SELECT valor FROM settings WHERE chave = ? LIMIT 1",
      [key]
    );
    return rows && rows[0] ? rows[0].valor : null;
  } catch (error) {
    console.error("Settings read error", error);
    return null;
  }
}

async function getSettingNumber(key, fallback) {
  const raw = await getSettingValue(key);
  const value = Number(raw);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

async function getCoingeckoCache(key) {
  const [rows] = await dbPool.execute(
    "SELECT payload, atualizado_em FROM coingecko_cache WHERE chave = ? LIMIT 1",
    [key]
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  const payload = safeJsonParse(row.payload) || null;
  return {
    payload,
    updatedAt: row.atualizado_em ? new Date(row.atualizado_em).getTime() : 0,
  };
}

async function setCoingeckoCache(key, payload) {
  await dbPool.execute(
    "INSERT INTO coingecko_cache (chave, payload) VALUES (?, ?) " +
      "ON DUPLICATE KEY UPDATE payload = VALUES(payload)",
    [key, JSON.stringify(payload)]
  );
}

function getCacheFreshness(entry, maxAgeMs) {
  if (!entry || !entry.updatedAt) return false;
  return Date.now() - entry.updatedAt <= maxAgeMs;
}

function buildOhlcFromPrices(prices, targetCandles) {
  if (!Array.isArray(prices) || prices.length === 0) return [];
  const step = Math.max(1, Math.ceil(prices.length / targetCandles));
  const candles = [];
  for (let i = 0; i < prices.length; i += step) {
    const bucket = prices.slice(i, i + step);
    if (bucket.length === 0) continue;
    const open = bucket[0][1];
    const close = bucket[bucket.length - 1][1];
    let high = open;
    let low = open;
    bucket.forEach(([, price]) => {
      if (price > high) high = price;
      if (price < low) low = price;
    });
    candles.push([bucket[0][0], open, high, low, close]);
  }
  return candles;
}

async function prewarmCoingeckoCache() {
  try {
    const params = new URLSearchParams();
    params.set("vs_currency", "brl");
    params.set("order", "market_cap_desc");
    params.set("per_page", "10");
    params.set("page", "1");
    params.set("sparkline", "true");
    const marketsUrl = `${coingeckoBaseUrl}/coins/markets?${params.toString()}`;
    const marketsKey = `coins/markets?${params.toString()}`;
    const marketsData = await cachedFetchJson(marketsUrl, 300000, "prewarm");
    await setCoingeckoCache(marketsKey, marketsData);

    const ids = Array.isArray(marketsData) ? marketsData.slice(0, 5).map((item) => item.id) : [];
    for (const id of ids) {
      const chartParams = new URLSearchParams();
      chartParams.set("vs_currency", "brl");
      chartParams.set("days", "1");
      const chartUrl = `${coingeckoBaseUrl}/coins/${encodeURIComponent(id)}/market_chart?${chartParams.toString()}`;
      const chartKey = `coins/${id}/market_chart?${chartParams.toString()}`;
      const chartData = await cachedFetchJson(chartUrl, 300000, "prewarm");
      await setCoingeckoCache(chartKey, chartData);

      const ohlcParams = new URLSearchParams();
      ohlcParams.set("vs_currency", "brl");
      ohlcParams.set("days", "1");
      const ohlcUrl = `${coingeckoBaseUrl}/coins/${encodeURIComponent(id)}/ohlc?${ohlcParams.toString()}`;
      const ohlcKey = `coins/${id}/ohlc?${ohlcParams.toString()}`;
      const ohlcData = await cachedFetchJson(ohlcUrl, 300000, "prewarm");
      await setCoingeckoCache(ohlcKey, ohlcData);

      await sleep(500);
    }
  } catch (error) {
    console.error("CoinGecko prewarm error", error?.message || error);
  }
}

async function valorionCashin(payload, apiKeyOverride) {
  const apiKey = apiKeyOverride || valorionCashinApiKey;
  if (!apiKey) {
    throw new Error("VALORION_CASHIN_API_KEY not configured");
  }
  const response = await fetch("https://api-fila-cash-in-out.onrender.com/v2/pix/charge", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || "CashIn failed";
    throw new Error(message);
  }
  return data;
}

async function valorionCashoutAuth(apiKeyOverride) {
  const apiKey = apiKeyOverride || valorionCashoutApiKey;
  if (!apiKey || !valorionCashoutPixKey) {
    throw new Error("VALORION_CASHOUT_API_KEY/VALORION_CASHOUT_PIX_KEY not configured");
  }
  const response = await fetch("https://api-fila-cash-in-out.onrender.com/v2/pix/transaction/auth", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "X-Pix-Key": valorionCashoutPixKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || "CashOut auth failed";
    throw new Error(message);
  }
  return data;
}

async function valorionCashoutCreate(token, payload, apiKeyOverride) {
  const apiKey = apiKeyOverride || valorionCashoutApiKey;
  const response = await fetch("https://api-fila-cash-in-out.onrender.com/v2/pix/transaction/create", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "X-Pix-Key": valorionCashoutPixKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || "CashOut create failed";
    throw new Error(message);
  }
  return data;
}

async function ensureSaldoRow(userId) {
  await dbPool.execute(
    "INSERT INTO saldos (usuario_id, saldo_disponivel, saldo_bloqueado) VALUES (?, 0, 0) " +
      "ON DUPLICATE KEY UPDATE usuario_id = usuario_id",
    [userId]
  );
}

async function ensureReferralBalance(userId) {
  await dbPool.execute(
    "INSERT INTO referral_balances (usuario_id, saldo_disponivel) VALUES (?, 0) " +
      "ON DUPLICATE KEY UPDATE usuario_id = usuario_id",
    [userId]
  );
}

async function applyReferralCommission(userId, approvedAmount, transactionId) {
  const amount = Number(approvedAmount);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const [userRows] = await dbPool.execute(
    "SELECT referred_by FROM usuarios WHERE id = ? LIMIT 1",
    [userId]
  );
  const referrerId = userRows && userRows[0] ? userRows[0].referred_by : null;
  if (!referrerId) return;

  const minDeposit = await getSettingNumber("min_deposit", 50);
  if (amount < minDeposit) return;

  const [[{ existing_commission }]] = await dbPool.execute(
    "SELECT COUNT(*) AS existing_commission FROM referral_commissions WHERE referred_id = ?",
    [userId]
  );
  if (Number(existing_commission) > 0) return;

  const [[{ approved_count }]] = await dbPool.execute(
    "SELECT COUNT(*) AS approved_count FROM transacoes_pix WHERE usuario_id = ? AND tipo = 'CASH_IN' AND status = 'APROVADO'",
    [userId]
  );
  if (Number(approved_count) !== 1) return;

  const rewardRaw = amount * (referralCommissionPercent / 100);
  const reward = Number(rewardRaw.toFixed(2));
  if (reward <= 0) return;

  await ensureReferralBalance(referrerId);
  await dbPool.execute(
    "INSERT INTO referral_commissions (referrer_id, referred_id, transaction_id, deposit_amount, commission_amount, commission_percent, status) " +
      "VALUES (?, ?, ?, ?, ?, ?, 'PAID')",
    [referrerId, userId, transactionId || null, amount, reward, referralCommissionPercent]
  );
  await dbPool.execute(
    "UPDATE referral_balances SET saldo_disponivel = saldo_disponivel + ? WHERE usuario_id = ?",
    [reward, referrerId]
  );
}

function mapPixStatus(rawStatus) {
  const value = String(rawStatus || "").toUpperCase();
  if (value.includes("PAID") || value.includes("APPROV") || value === "COMPLETED" || value === "SUCCESS") {
    return "APROVADO";
  }
  if (value.includes("CANCEL") || value.includes("EXPIRE") || value.includes("VOID") || value === "FAILED") {
    return "CANCELADO";
  }
  return "PENDENTE";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

function generateTempPassword() {
  const raw = crypto.randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "");
  return `${raw}9A`;
}

function isValidCpf(cpf) {
  const digits = String(cpf || "").replace(/\D/g, "");
  return digits.length === 11;
}

function parseCsvFilter(raw, allowed) {
  if (!raw) return [];
  const values = String(raw)
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (!allowed || allowed.length === 0) return values;
  return values.filter((value) => allowed.includes(value));
}

function parseDateRange(query) {
  const startRaw = String(query.startDate || "").trim();
  const endRaw = String(query.endDate || "").trim();
  if (!startRaw && !endRaw) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    return { startDate, endDate };
  }
  const startDate = startRaw || endRaw;
  const endDate = endRaw || startRaw;
  return { startDate, endDate };
}

async function getLatestNotificationTime() {
  const [rows] = await dbPool.execute("SELECT MAX(created_at) AS latest FROM notifications");
  const latest = rows && rows[0] ? rows[0].latest : null;
  return latest ? new Date(latest).getTime() : 0;
}

async function createTradeOpportunityNotification() {
  const requestId = createRequestId();
  const url = `${coingeckoBaseUrl}/coins/markets?vs_currency=brl&order=volume_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;
  const data = await cachedFetchJson(url, 60000, requestId);
  const list = Array.isArray(data) ? data : [];
  const candidates = list.filter((item) => Number(item?.price_change_percentage_24h) > 2);
  const pick = (candidates.length ? candidates : list)[0];
  if (!pick) return null;

  const expectedGain = Math.max(2, Math.round(Number(pick.price_change_percentage_24h || 2)));
  const title = `Oportunidade IA: ${pick.name}`;
  const message = `O robo detectou potencial de lucro em ${pick.name}. Possivel movimento de ${expectedGain}% nas proximas horas.`;

  const [result] = await dbPool.execute(
    "INSERT INTO notifications (title, message, sinal_id, crypto_id, crypto_symbol, crypto_icon_url, current_price, expected_gain_pct) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      title,
      message,
      null,
      pick.id,
      String(pick.symbol || "").toUpperCase(),
      pick.image || null,
      Number(pick.current_price || 0),
      expectedGain,
    ]
  );

  return result?.insertId || null;
}

async function ensureAutoNotification() {
  return ensureSignalNotification();
}

async function getCoinMarketBySymbol(symbol) {
  const requestId = createRequestId();
  const url = `${coingeckoBaseUrl}/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
  const data = await cachedFetchJson(url, 5 * 60 * 1000, requestId);
  const list = Array.isArray(data) ? data : [];
  const normalized = String(symbol || "").toLowerCase();
  return list.find((item) => String(item?.symbol || "").toLowerCase() === normalized) || null;
}

async function ensureSignalNotification() {
  const today = new Date().toISOString().slice(0, 10);
  const [rows] = await dbPool.execute(
    "SELECT id, crypto_symbol, horario_inicio, horario_fim, lucro_percentual " +
      "FROM sinais WHERE DATE(horario_inicio) = ? ORDER BY horario_inicio DESC LIMIT 1",
    [today]
  );
  const sinal = rows && rows[0];
  if (!sinal) return null;

  const [existing] = await dbPool.execute(
    "SELECT id FROM notifications WHERE sinal_id = ? LIMIT 1",
    [sinal.id]
  );
  if (existing && existing.length > 0) {
    return null;
  }

  const coin = await getCoinMarketBySymbol(sinal.crypto_symbol);
  const symbol = String(sinal.crypto_symbol || "").toUpperCase();
  const lucro = Number(sinal.lucro_percentual || 0);
  const title = `Sinal IA: ${symbol}`;
  const message = `O CoinX IA detectou oportunidade em ${symbol}. Possivel lucro de ${lucro}% no periodo do sinal.`;

  const [result] = await dbPool.execute(
    "INSERT INTO notifications (title, message, sinal_id, crypto_id, crypto_symbol, crypto_icon_url, current_price, expected_gain_pct) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      title,
      message,
      sinal.id,
      coin?.id || null,
      symbol,
      coin?.image || null,
      Number(coin?.current_price || 0),
      lucro,
    ]
  );

  return result?.insertId || null;
}

function normalizeDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw.replace("T", " ") : raw;
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

async function runScheduledNotifications() {
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 19).replace("T", " ");
  const [rows] = await dbPool.execute(
    "SELECT * FROM notification_schedules " +
      "WHERE active = 1 AND start_at <= ? AND (end_at IS NULL OR end_at >= ?) " +
      "ORDER BY start_at ASC",
    [nowStr, nowStr]
  );

  const createdIds = [];
  for (const schedule of rows || []) {
    const lastSent = schedule.last_sent_at ? new Date(schedule.last_sent_at).getTime() : 0;
    const intervalMs = Math.max(1, Number(schedule.interval_minutes || 1440)) * 60 * 1000;
    if (lastSent && Date.now() - lastSent < intervalMs) {
      continue;
    }

    let iconUrl = null;
    let currentPrice = schedule.current_price;
    if (schedule.crypto_symbol) {
      const coin = await getCoinMarketBySymbol(schedule.crypto_symbol);
      iconUrl = coin?.image || null;
      if (!currentPrice && coin?.current_price) {
        currentPrice = Number(coin.current_price);
      }
    }

    const [result] = await dbPool.execute(
      "INSERT INTO notifications (title, message, sinal_id, crypto_id, crypto_symbol, crypto_icon_url, current_price, expected_gain_pct) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        schedule.title,
        schedule.message,
        null,
        schedule.crypto_id,
        schedule.crypto_symbol,
        iconUrl,
        currentPrice,
        schedule.expected_gain_pct,
      ]
    );

    await dbPool.execute(
      "UPDATE notification_schedules SET last_sent_at = ? WHERE id = ?",
      [nowStr, schedule.id]
    );
    if (result?.insertId) {
      createdIds.push(result.insertId);
    }
  }

  return createdIds;
}

// --- SINAL DIARIO AUTOMATICO ---
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
async function inserirSinalDiario() {
  // Sinal do meio-dia
  const hoje = new Date();
  hoje.setHours(12, getRandomInt(0, 30), 0, 0);
  const inicio1 = new Date(hoje);
  const fim1 = new Date(hoje);
  fim1.setMinutes(inicio1.getMinutes() + getRandomInt(5, 15));
  // Sinal das 19h
  const hoje19 = new Date();
  hoje19.setHours(19, getRandomInt(0, 30), 0, 0);
  const inicio2 = new Date(hoje19);
  const fim2 = new Date(hoje19);
  fim2.setMinutes(inicio2.getMinutes() + getRandomInt(5, 15));
  const available = await getAvailableCryptoSymbols();
  if (!available.length) {
    return;
  }
  // Sinal 1
  const symbol1 = available[getRandomInt(0, available.length - 1)];
  const lucro_percentual1 = getRandomFloat(8, 18, 2);
  await dbPool.execute(
    'INSERT INTO sinais (crypto_symbol, horario_inicio, horario_fim, lucro_percentual) VALUES (?, ?, ?, ?)',
    [symbol1, inicio1.toISOString().slice(0, 19).replace('T', ' '), fim1.toISOString().slice(0, 19).replace('T', ' '), lucro_percentual1]
  );
  // Sinal 2
  const symbol2 = available[getRandomInt(0, available.length - 1)];
  const lucro_percentual2 = getRandomFloat(8, 18, 2);
  await dbPool.execute(
    'INSERT INTO sinais (crypto_symbol, horario_inicio, horario_fim, lucro_percentual) VALUES (?, ?, ?, ?)',
    [symbol2, inicio2.toISOString().slice(0, 19).replace('T', ' '), fim2.toISOString().slice(0, 19).replace('T', ' '), lucro_percentual2]
  );
  await ensureSignalNotification();
}
// Agendar para rodar todo dia às 11:59:50 (garante que o sinal será para o dia)
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 11 && now.getMinutes() === 59 && now.getSeconds() < 10) {
    // Verifica se já existe sinal para hoje
    const hoje = new Date().toISOString().slice(0, 10);
    const [rows] = await dbPool.execute('SELECT id FROM sinais WHERE DATE(horario_inicio) = ?', [hoje]);
    if (!rows.length) await inserirSinalDiario();
  }
}, 10000);

// Rotina diária para registrar saldo histórico dos usuários
async function registrarSaldosHistoricos() {
  try {
    // Busca todos os usuários
    const [usuarios] = await dbPool.execute("SELECT id FROM usuarios");
    for (const usuario of usuarios) {
      // Busca saldo atual
      const [saldos] = await dbPool.execute(
        "SELECT saldo_disponivel FROM saldos WHERE usuario_id = ?",
        [usuario.id]
      );
      const saldo = saldos && saldos[0] ? Number(saldos[0].saldo_disponivel) : 0;
      // Insere ou atualiza saldo histórico do dia
      await dbPool.execute(
        "INSERT INTO saldos_historico (usuario_id, data_ref, saldo) VALUES (?, CURDATE(), ?) ON DUPLICATE KEY UPDATE saldo = VALUES(saldo)",
        [usuario.id, saldo]
      );
    }
    console.log("Saldos históricos registrados para todos os usuários.");
  } catch (error) {
    console.error("Erro ao registrar saldos históricos:", error);
  }
}

// Agenda para rodar todo dia às 00:05
function agendarRegistroSaldosHistoricos() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 5, 0, 0);
  if (next < now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    registrarSaldosHistoricos();
    setInterval(registrarSaldosHistoricos, 24 * 60 * 60 * 1000); // a cada 24h
  }, delay);
}
agendarRegistroSaldosHistoricos();


app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha obrigatorios" });
  }

  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT u.id, u.nome, u.email, u.cpf, u.senha_hash, u.ativo, u.referral_code, u.twofa_enabled, r.nome AS role " +
        "FROM usuarios u " +
        "LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id " +
        "LEFT JOIN roles r ON r.id = ur.role_id " +
        "WHERE u.email = ? LIMIT 1",
      [email]
    );

    const userRow = rows && rows[0];
    if (!userRow || !userRow.ativo) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }

    const isValid = await bcrypt.compare(password, userRow.senha_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }

    const user = {
      id: userRow.id,
      name: userRow.nome,
      email: userRow.email,
      role: userRow.role || "user",
      referral_code: userRow.referral_code,
      cpf: userRow.cpf,
    };

    if (Number(userRow.twofa_enabled) === 1) {
      const tempToken = createTwofaPendingToken(user.id);
      return res.json({
        requires2fa: true,
        tempToken,
        expiresIn: twofaPendingExpiresIn,
      });
    }

    const token = createToken(user);
    return res.json({
      token,
      user,
      expiresIn: jwtExpiresIn,
    });
  })().catch((error) => {
    console.error("Login error", error);
    return res.status(500).json({ message: "Erro ao autenticar" });
  });
});

app.post("/api/login/2fa", (req, res) => {
  const { tempToken, code } = req.body || {};

  if (!tempToken || !code) {
    return res.status(400).json({ message: "Token temporario e codigo sao obrigatorios" });
  }

  if (!isValidTwofaCode(code)) {
    return res.status(400).json({ message: "Codigo invalido" });
  }

  (async () => {
    let payload;
    try {
      payload = jwt.verify(tempToken, jwtSecret);
    } catch {
      return res.status(401).json({ message: "Token temporario invalido" });
    }

    if (!payload?.twofa_pending || !payload?.sub) {
      return res.status(401).json({ message: "Token temporario invalido" });
    }

    const [rows] = await dbPool.execute(
      "SELECT u.id, u.nome, u.email, u.cpf, u.referral_code, u.twofa_enabled, u.twofa_secret, r.nome AS role " +
        "FROM usuarios u " +
        "LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id " +
        "LEFT JOIN roles r ON r.id = ur.role_id " +
        "WHERE u.id = ? LIMIT 1",
      [payload.sub]
    );

    const userRow = rows && rows[0];
    if (!userRow || Number(userRow.twofa_enabled) !== 1 || !userRow.twofa_secret) {
      return res.status(401).json({ message: "2FA nao configurado" });
    }

    const isValid = verifyTwofaCode(userRow.twofa_secret, code);
    if (!isValid) {
      return res.status(401).json({ message: "Codigo invalido" });
    }

    const user = {
      id: userRow.id,
      name: userRow.nome,
      email: userRow.email,
      role: userRow.role || "user",
      referral_code: userRow.referral_code,
      cpf: userRow.cpf,
    };
    const token = createToken(user);

    return res.json({
      token,
      user,
      expiresIn: jwtExpiresIn,
    });
  })().catch((error) => {
    console.error("2FA login error", error);
    return res.status(500).json({ message: "Erro ao validar 2FA" });
  });
});

app.get("/api/2fa/status", authMiddleware, (req, res) => {
  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT twofa_enabled FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const enabled = Number(rows?.[0]?.twofa_enabled || 0) === 1;
    return res.json({ enabled });
  })().catch((error) => {
    console.error("2FA status error", error);
    return res.status(500).json({ message: "Erro ao obter status 2FA" });
  });
});

app.post("/api/2fa/setup", authMiddleware, (req, res) => {
  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT id, email, twofa_enabled FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const userRow = rows && rows[0];
    if (!userRow) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }
    if (Number(userRow.twofa_enabled) === 1) {
      return res.status(400).json({ message: "2FA ja esta ativo" });
    }

    const label = userRow.email ? `${twofaIssuer}:${userRow.email}` : twofaIssuer;
    const secret = speakeasy.generateSecret({ name: label, issuer: twofaIssuer });
    const otpauthUrl = secret.otpauth_url;
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    await dbPool.execute(
      "UPDATE usuarios SET twofa_temp_secret = ?, twofa_updated_at = NOW() WHERE id = ?",
      [secret.base32, userRow.id]
    );

    return res.json({
      otpauthUrl,
      qrCodeDataUrl,
    });
  })().catch((error) => {
    console.error("2FA setup error", error);
    return res.status(500).json({ message: "Erro ao iniciar 2FA" });
  });
});

app.post("/api/2fa/enable", authMiddleware, (req, res) => {
  const { code } = req.body || {};

  if (!isValidTwofaCode(code)) {
    return res.status(400).json({ message: "Codigo invalido" });
  }

  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT twofa_temp_secret, twofa_enabled FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const userRow = rows && rows[0];
    if (!userRow?.twofa_temp_secret) {
      return res.status(400).json({ message: "2FA nao iniciado" });
    }
    if (Number(userRow.twofa_enabled) === 1) {
      return res.status(400).json({ message: "2FA ja esta ativo" });
    }

    const isValid = verifyTwofaCode(userRow.twofa_temp_secret, code);
    if (!isValid) {
      return res.status(401).json({ message: "Codigo invalido" });
    }

    await dbPool.execute(
      "UPDATE usuarios SET twofa_enabled = 1, twofa_secret = ?, twofa_temp_secret = NULL, twofa_updated_at = NOW() WHERE id = ?",
      [userRow.twofa_temp_secret, req.user.sub]
    );

    return res.json({ enabled: true });
  })().catch((error) => {
    console.error("2FA enable error", error);
    return res.status(500).json({ message: "Erro ao ativar 2FA" });
  });
});

app.post("/api/2fa/disable", authMiddleware, (req, res) => {
  const { code } = req.body || {};

  if (!isValidTwofaCode(code)) {
    return res.status(400).json({ message: "Codigo invalido" });
  }

  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT twofa_secret, twofa_enabled FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const userRow = rows && rows[0];
    if (!userRow?.twofa_secret || Number(userRow.twofa_enabled) !== 1) {
      return res.status(400).json({ message: "2FA nao esta ativo" });
    }

    const isValid = verifyTwofaCode(userRow.twofa_secret, code);
    if (!isValid) {
      return res.status(401).json({ message: "Codigo invalido" });
    }

    await dbPool.execute(
      "UPDATE usuarios SET twofa_enabled = 0, twofa_secret = NULL, twofa_temp_secret = NULL, twofa_updated_at = NOW() WHERE id = ?",
      [req.user.sub]
    );

    return res.json({ enabled: false });
  })().catch((error) => {
    console.error("2FA disable error", error);
    return res.status(500).json({ message: "Erro ao desativar 2FA" });
  });
});

app.get("/api/profile", authMiddleware, (req, res) => {
  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT nome, email, cpf, telefone FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const userRow = rows && rows[0];
    if (!userRow) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    return res.json({
      profile: {
        name: userRow.nome,
        email: userRow.email,
        cpf: userRow.cpf,
        telefone: userRow.telefone || "",
      },
    });
  })().catch((error) => {
    console.error("Profile get error", error);
    return res.status(500).json({ message: "Erro ao buscar perfil" });
  });
});

app.put("/api/profile", authMiddleware, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const telefoneRaw = String(req.body?.telefone || "").trim();
  const telefone = telefoneRaw ? telefoneRaw.replace(/\D+/g, "") : null;

  if (!name) {
    return res.status(400).json({ message: "Nome e obrigatorio" });
  }
  if (telefone && (telefone.length < 10 || telefone.length > 11)) {
    return res.status(400).json({ message: "Telefone invalido" });
  }

  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT email FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const userRow = rows && rows[0];
    if (!userRow) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    const requestedEmail = String(req.body?.email || "").trim();
    if (requestedEmail && requestedEmail !== userRow.email) {
      return res.status(400).json({ message: "Email nao pode ser alterado" });
    }

    await dbPool.execute(
      "UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?",
      [name, telefone, req.user.sub]
    );

    return res.json({ success: true });
  })().catch((error) => {
    console.error("Profile update error", error);
    return res.status(500).json({ message: "Erro ao atualizar perfil" });
  });
});

app.get("/api/profile/bank", authMiddleware, (req, res) => {
  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT pix_key_type, pix_key, bank_name, bank_agency, bank_account, bank_account_type " +
        "FROM usuarios_dados_bancarios WHERE usuario_id = ? LIMIT 1",
      [req.user.sub]
    );
    return res.json({ data: rows?.[0] || null });
  })().catch((error) => {
    console.error("Profile bank get error", error);
    return res.status(500).json({ message: "Erro ao buscar dados bancarios" });
  });
});

app.put("/api/profile/bank", authMiddleware, (req, res) => {
  const cleanValue = (value, max) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
  };

  const pixKeyType = cleanValue(req.body?.pixKeyType, 30);
  const pixKey = cleanValue(req.body?.pixKey, 120);
  const bankName = cleanValue(req.body?.bankName, 80);
  const bankAgency = cleanValue(req.body?.bankAgency, 20);
  const bankAccount = cleanValue(req.body?.bankAccount, 30);
  const bankAccountType = cleanValue(req.body?.bankAccountType, 20);

  (async () => {
    await dbPool.execute(
      "INSERT INTO usuarios_dados_bancarios (" +
        "usuario_id, pix_key_type, pix_key, bank_name, bank_agency, bank_account, bank_account_type" +
      ") VALUES (?, ?, ?, ?, ?, ?, ?) " +
        "ON DUPLICATE KEY UPDATE " +
        "pix_key_type = VALUES(pix_key_type), " +
        "pix_key = VALUES(pix_key), " +
        "bank_name = VALUES(bank_name), " +
        "bank_agency = VALUES(bank_agency), " +
        "bank_account = VALUES(bank_account), " +
        "bank_account_type = VALUES(bank_account_type)",
      [
        req.user.sub,
        pixKeyType,
        pixKey,
        bankName,
        bankAgency,
        bankAccount,
        bankAccountType,
      ]
    );

    return res.json({ success: true });
  })().catch((error) => {
    console.error("Profile bank save error", error);
    return res.status(500).json({ message: "Erro ao salvar dados bancarios" });
  });
});

app.post("/api/register", (req, res) => {
  const { nome, email, senha, telefone, indicacao, cpf } = req.body || {};

  if (!nome || !email || !senha || !cpf) {
    return res.status(400).json({ message: "Nome, email, cpf e senha sao obrigatorios" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email invalido" });
  }

  if (!isStrongPassword(senha)) {
    return res.status(400).json({ message: "Senha fraca (min 8, 1 letra e 1 numero)" });
  }

  if (!isValidCpf(cpf)) {
    return res.status(400).json({ message: "CPF invalido" });
  }

  (async () => {
    const [existing] = await dbPool.execute(
      "SELECT id FROM usuarios WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing && existing.length > 0) {
      return res.status(409).json({ message: "Email ja cadastrado" });
    }

    let referredBy = null;
    if (indicacao) {
      const [refRows] = await dbPool.execute(
        "SELECT id FROM usuarios WHERE referral_code = ? LIMIT 1",
        [indicacao]
      );
      if (!refRows || refRows.length === 0) {
        return res.status(400).json({ message: "Codigo de indicacao invalido" });
      }
      referredBy = refRows[0].id;
    }

    const referralCode = await generateReferralCode(dbPool);
    const senhaHash = await bcrypt.hash(senha, 10);
    const telefoneValue = telefone ? String(telefone).replace(/\D/g, "") : null;
    const [result] = await dbPool.execute(
      "INSERT INTO usuarios (nome, email, cpf, telefone, senha_hash, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nome, email, String(cpf).replace(/\D/g, ""), telefoneValue, senhaHash, referralCode, referredBy]
    );

    await dbPool.execute(
      "INSERT INTO usuario_roles (usuario_id, role_id) SELECT ?, id FROM roles WHERE nome = 'user'",
      [result.insertId]
    );

    const user = { id: result.insertId, name: nome, email, role: "user", referral_code: referralCode, cpf };
    const token = createToken(user);

    return res.status(201).json({
      token,
      user,
      expiresIn: jwtExpiresIn,
    });
  })().catch((error) => {
    console.error("Register error", error);
    return res.status(500).json({ message: "Erro ao cadastrar" });
  });
});

app.get("/api/me", authMiddleware, (req, res) => {
  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT u.id, u.nome, u.email, u.cpf, u.referral_code, r.nome AS role " +
        "FROM usuarios u " +
        "LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id " +
        "LEFT JOIN roles r ON r.id = ur.role_id " +
        "WHERE u.id = ? LIMIT 1",
      [req.user.sub]
    );

    const userRow = rows && rows[0];
    if (!userRow) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    return res.json({
      user: {
        id: userRow.id,
        name: userRow.nome,
        email: userRow.email,
        role: userRow.role || "user",
        referral_code: userRow.referral_code,
        cpf: userRow.cpf,
      },
    });
  })().catch((error) => {
    console.error("Me error", error);
    return res.status(500).json({ message: "Erro ao buscar usuario" });
  });
});

app.put("/api/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { nome, telefone, foto_url } = req.body || {};
    const updates = [];
    const params = [];
    if (nome) { updates.push("nome = ?"); params.push(nome); }
    if (telefone) { updates.push("telefone = ?"); params.push(telefone); }
    if (foto_url) { updates.push("foto_url = ?"); params.push(foto_url); }
    if (updates.length === 0) {
      return res.status(400).json({ message: "Nenhum campo válido para atualizar" });
    }
    params.push(userId);
    await dbPool.execute(`UPDATE usuarios SET ${updates.join(", ")} WHERE id = ?`, params);
    return res.json({ status: "ok" });
  } catch (error) {
    console.error("Profile update error", error);
    return res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
});

app.get("/api/referrals/summary", authMiddleware, (req, res) => {
  (async () => {
    const userId = req.user.sub;

    await ensureReferralBalance(userId);

    const [[{ total }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total FROM usuarios WHERE referred_by = ?",
      [userId]
    );

    const [[{ active }]] = await dbPool.execute(
      "SELECT COUNT(*) AS active FROM usuarios WHERE referred_by = ? AND ativo = 1",
      [userId]
    );

    const minDeposit = await getSettingNumber("min_deposit", 50);
    const minReferralWithdraw = await getSettingNumber("min_referral_withdraw", 50);
    const maxReferralWithdraw = await getSettingNumber("max_referral_withdraw", 0);
    const [[{ total_balance }]] = await dbPool.execute(
      "SELECT saldo_disponivel AS total_balance FROM referral_balances WHERE usuario_id = ?",
      [userId]
    );

    const totalBalance = Number(total_balance) || 0;

    return res.json({
      total: Number(total) || 0,
      active: Number(active) || 0,
      totalBalance,
      availableBalance: totalBalance,
      commissionPercent: referralCommissionPercent,
      minDeposit,
      minReferralWithdraw,
      maxReferralWithdraw,
    });
  })().catch((error) => {
    console.error("Referral summary error", error);
    return res.status(500).json({ message: "Erro ao buscar indicadores" });
  });
});

app.post("/api/referrals/withdraw", authMiddleware, (req, res) => {
  const { amount, pixKey, pixType, beneficiaryName, beneficiaryDocument } = req.body || {};
  const requestedAmount = Number(amount);

  (async () => {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ message: "Valor invalido" });
    }

    const minReferralWithdraw = await getSettingNumber("min_referral_withdraw", 50);
    if (requestedAmount < minReferralWithdraw) {
      return res.status(400).json({ message: `Saque minimo: ${minReferralWithdraw}` });
    }
    const maxReferralWithdraw = await getSettingNumber("max_referral_withdraw", 0);
    if (maxReferralWithdraw > 0 && requestedAmount > maxReferralWithdraw) {
      return res.status(400).json({ message: `Saque maximo: ${maxReferralWithdraw}` });
    }

    await ensureReferralBalance(req.user.sub);
    const [[balanceRow]] = await dbPool.execute(
      "SELECT saldo_disponivel FROM referral_balances WHERE usuario_id = ?",
      [req.user.sub]
    );
    const saldo = Number(balanceRow?.saldo_disponivel || 0);
    if (requestedAmount > saldo) {
      return res.status(400).json({ message: "Saldo de indicacoes insuficiente" });
    }

    const [userRows] = await dbPool.execute(
      "SELECT nome, cpf FROM usuarios WHERE id = ? LIMIT 1",
      [req.user.sub]
    );
    const userRow = userRows && userRows[0];
    if (!userRow) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    let finalPixKey = pixKey;
    let finalPixType = pixType;
    if (!finalPixKey || !finalPixType) {
      const [bankRows] = await dbPool.execute(
        "SELECT pix_key, pix_key_type FROM usuarios_dados_bancarios WHERE usuario_id = ? LIMIT 1",
        [req.user.sub]
      );
      const bankRow = bankRows && bankRows[0];
      finalPixKey = finalPixKey || bankRow?.pix_key || null;
      finalPixType = finalPixType || bankRow?.pix_key_type || null;
    }

    if (!finalPixKey || !finalPixType) {
      return res.status(400).json({ message: "Chave Pix obrigatoria" });
    }

    const name = beneficiaryName || userRow.nome;
    const document = beneficiaryDocument || userRow.cpf;
    if (!name || !document) {
      return res.status(400).json({ message: "Dados do beneficiario invalidos" });
    }

    const apiKey = (await getSettingValue("gateway_api_key")) || valorionCashoutApiKey;
    const authData = await valorionCashoutAuth(apiKey);
    const token = authData?.access_token;
    if (!token) {
      throw new Error("Token de cashout invalido");
    }

    const externalReference = `referral_${req.user.sub}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      amount: Number(requestedAmount),
      pixKey: finalPixKey,
      pixType: finalPixType,
      beneficiaryName: name,
      beneficiaryDocument: document,
      postbackUrl: valorionWebhookUrl,
    };

    const data = await valorionCashoutCreate(token, payload, apiKey);
    await dbPool.execute(
      "UPDATE referral_balances SET saldo_disponivel = saldo_disponivel - ? WHERE usuario_id = ?",
      [requestedAmount, req.user.sub]
    );

    await dbPool.execute(
      "INSERT INTO referral_withdrawals (usuario_id, status, valor, pix_key, pix_type, beneficiary_name, beneficiary_document, id_transaction, external_reference) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.user.sub,
        "PENDENTE",
        requestedAmount,
        finalPixKey,
        finalPixType,
        name,
        document,
        data?.idTransaction || null,
        data?.externalreference || externalReference,
      ]
    );

    return res.json({ status: "ok", amount: requestedAmount });
  })().catch((error) => {
    console.error("Referral withdraw error", error);
    return res.status(500).json({ message: error?.message || "Erro ao solicitar saque" });
  });
});

app.get("/api/referrals/list", authMiddleware, (req, res) => {
  (async () => {
    const userId = req.user.sub;
    const [rows] = await dbPool.execute(
      "SELECT u.id, u.nome, u.criado_em, u.ativo, " +
        "rc.commission_amount AS reward " +
        "FROM usuarios u " +
        "LEFT JOIN referral_commissions rc ON rc.referred_id = u.id AND rc.referrer_id = ? " +
        "WHERE u.referred_by = ? " +
        "ORDER BY u.criado_em DESC",
      [userId, userId]
    );

    return res.json({
      referrals: rows.map((row) => ({
        id: row.id,
        name: row.nome,
        createdAt: row.criado_em,
        reward: Number(row.reward || 0),
        status: row.ativo ? "Ativo" : "Pendente",
      })),
    });
  })().catch((error) => {
    console.error("Referral list error", error);
    return res.status(500).json({ message: "Erro ao listar indicacoes" });
  });
});

app.get("/api/admin/summary", authMiddleware, requirePermission("admin.summary.view"), (req, res) => {
  (async () => {
    const [[{ total_users }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_users FROM usuarios"
    );
    const [[{ active_users }]] = await dbPool.execute(
      "SELECT COUNT(*) AS active_users FROM usuarios WHERE ativo = 1"
    );
    const [[{ total_referrals }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_referrals FROM usuarios WHERE referred_by IS NOT NULL"
    );
    const [[{ total_transactions }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_transactions FROM transacoes_pix"
    );
    const [[{ total_cashin }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_cashin FROM transacoes_pix WHERE tipo = 'CASH_IN'"
    );
    const [[{ total_cashout }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_cashout FROM transacoes_pix WHERE tipo = 'CASH_OUT'"
    );
    const [[{ total_approved }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_approved FROM transacoes_pix WHERE status = 'APROVADO'"
    );
    const [[{ total_pending }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_pending FROM transacoes_pix WHERE status = 'PENDENTE'"
    );
    const [[{ total_canceled }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_canceled FROM transacoes_pix WHERE status = 'CANCELADO'"
    );
    const [[{ total_cashin_value }]] = await dbPool.execute(
      "SELECT COALESCE(SUM(valor_liquido), 0) AS total_cashin_value FROM transacoes_pix WHERE tipo = 'CASH_IN' AND status = 'APROVADO'"
    );
    const [[{ total_cashout_value }]] = await dbPool.execute(
      "SELECT COALESCE(SUM(valor_liquido), 0) AS total_cashout_value FROM transacoes_pix WHERE tipo = 'CASH_OUT' AND status = 'APROVADO'"
    );

    let totalDeposits = 0;
    let totalDepositValue = 0;
    const [tableRows] = await dbPool.execute(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ? AND table_name = 'depositos'",
      [dbName]
    );
    if (tableRows && tableRows[0] && tableRows[0].total > 0) {
      const [[{ total_deposits }]] = await dbPool.execute(
        "SELECT COUNT(*) AS total_deposits FROM depositos"
      );
      const [[{ total_value }]] = await dbPool.execute(
        "SELECT COALESCE(SUM(valor), 0) AS total_value FROM depositos"
      );
      totalDeposits = Number(total_deposits) || 0;
      totalDepositValue = Number(total_value) || 0;
    }

    return res.json({
      totalUsers: Number(total_users) || 0,
      activeUsers: Number(active_users) || 0,
      totalReferrals: Number(total_referrals) || 0,
      totalDeposits,
      totalDepositValue,
      totalTransactions: Number(total_transactions) || 0,
      totalCashin: Number(total_cashin) || 0,
      totalCashout: Number(total_cashout) || 0,
      totalApproved: Number(total_approved) || 0,
      totalPending: Number(total_pending) || 0,
      totalCanceled: Number(total_canceled) || 0,
      totalCashinValue: Number(total_cashin_value) || 0,
      totalCashoutValue: Number(total_cashout_value) || 0,
    });
  })().catch((error) => {
    console.error("Admin summary error", error);
    return res.status(500).json({ message: "Erro ao buscar resumo" });
  });
});

app.get("/api/admin/settings/gateway", authMiddleware, requirePermission("admin.settings.view"), (req, res) => {
  (async () => {
    const apiKey = await getSettingValue("gateway_api_key");
    const minDeposit = await getSettingNumber("min_deposit", 50);
    const minWithdraw = await getSettingNumber("min_withdraw", 50);
    const maxDeposit = await getSettingNumber("max_deposit", 0);
    const maxWithdraw = await getSettingNumber("max_withdraw", 0);
    const minReferralWithdraw = await getSettingNumber("min_referral_withdraw", 50);
    const maxReferralWithdraw = await getSettingNumber("max_referral_withdraw", 0);
    const cashinFeePercent = await getSettingNumber("cashin_fee_percent", 0);
    const cashoutFeePercent = await getSettingNumber("cashout_fee_percent", 0);
    return res.json({
      apiKey: apiKey || "",
      minDeposit,
      minWithdraw,
      maxDeposit,
      maxWithdraw,
      minReferralWithdraw,
      maxReferralWithdraw,
      cashinFeePercent,
      cashoutFeePercent,
    });
  })().catch((error) => {
    console.error("Admin settings read error", error);
    return res.status(500).json({ message: "Erro ao buscar configuracoes" });
  });
});

app.put("/api/admin/settings/gateway", authMiddleware, requirePermission("admin.settings.edit"), (req, res) => {
  const apiKey = String(req.body?.apiKey || "").trim();
  const minDeposit = Number(req.body?.minDeposit);
  const minWithdraw = Number(req.body?.minWithdraw);
  const maxDeposit = Number(req.body?.maxDeposit);
  const maxWithdraw = Number(req.body?.maxWithdraw);
  const minReferralWithdraw = Number(req.body?.minReferralWithdraw);
  const maxReferralWithdraw = Number(req.body?.maxReferralWithdraw);
  const cashinFeePercent = Number(req.body?.cashinFeePercent);
  const cashoutFeePercent = Number(req.body?.cashoutFeePercent);
  const hasApiKey = Boolean(apiKey);
  const hasMinDeposit = Number.isFinite(minDeposit) && minDeposit >= 0;
  const hasMinWithdraw = Number.isFinite(minWithdraw) && minWithdraw >= 0;
  const hasMaxDeposit = Number.isFinite(maxDeposit) && maxDeposit >= 0;
  const hasMaxWithdraw = Number.isFinite(maxWithdraw) && maxWithdraw >= 0;
  const hasMinReferralWithdraw = Number.isFinite(minReferralWithdraw) && minReferralWithdraw >= 0;
  const hasMaxReferralWithdraw = Number.isFinite(maxReferralWithdraw) && maxReferralWithdraw >= 0;
  const hasCashinFee = Number.isFinite(cashinFeePercent) && cashinFeePercent >= 0;
  const hasCashoutFee = Number.isFinite(cashoutFeePercent) && cashoutFeePercent >= 0;
  if (!hasApiKey && !hasMinDeposit && !hasMinWithdraw && !hasMaxDeposit && !hasMaxWithdraw && !hasMinReferralWithdraw && !hasMaxReferralWithdraw && !hasCashinFee && !hasCashoutFee) {
    return res.status(400).json({ message: "Informe algum valor para atualizar" });
  }

  (async () => {
    if (hasApiKey) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('gateway_api_key', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [apiKey]
      );
    }
    if (hasMinDeposit) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('min_deposit', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(minDeposit)]
      );
    }
    if (hasMinWithdraw) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('min_withdraw', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(minWithdraw)]
      );
    }
    if (hasMaxDeposit) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('max_deposit', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(maxDeposit)]
      );
    }
    if (hasMaxWithdraw) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('max_withdraw', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(maxWithdraw)]
      );
    }
    if (hasMinReferralWithdraw) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('min_referral_withdraw', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(minReferralWithdraw)]
      );
    }
    if (hasMaxReferralWithdraw) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('max_referral_withdraw', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(maxReferralWithdraw)]
      );
    }
    if (hasCashinFee) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('cashin_fee_percent', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(cashinFeePercent)]
      );
    }
    if (hasCashoutFee) {
      await dbPool.execute(
        "INSERT INTO settings (chave, valor) VALUES ('cashout_fee_percent', ?) " +
          "ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
        [String(cashoutFeePercent)]
      );
    }
    await logAudit({
      req,
      action: "admin.settings.gateway.update",
      targetType: "settings",
      targetId: null,
      metadata: {
        hasApiKey,
        minDeposit: hasMinDeposit ? minDeposit : null,
        minWithdraw: hasMinWithdraw ? minWithdraw : null,
        maxDeposit: hasMaxDeposit ? maxDeposit : null,
        maxWithdraw: hasMaxWithdraw ? maxWithdraw : null,
        minReferralWithdraw: hasMinReferralWithdraw ? minReferralWithdraw : null,
        maxReferralWithdraw: hasMaxReferralWithdraw ? maxReferralWithdraw : null,
        cashinFeePercent: hasCashinFee ? cashinFeePercent : null,
        cashoutFeePercent: hasCashoutFee ? cashoutFeePercent : null,
      },
    });
    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Admin settings update error", error);
    return res.status(500).json({ message: "Erro ao salvar configuracoes" });
  });
});

app.get("/api/admin/settings/audit", authMiddleware, requirePermission("admin.settings.view"), (req, res) => {
  (async () => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const [rows] = await dbPool.execute(
      "SELECT a.id, a.action, a.metadata, a.created_at, u.nome AS actor_name, u.email AS actor_email " +
        "FROM audit_logs a " +
        "LEFT JOIN usuarios u ON u.id = a.actor_user_id " +
        "WHERE a.target_type = 'settings' " +
        "ORDER BY a.created_at DESC " +
        `LIMIT ${limit} OFFSET ${offset}`
    );

    return res.json({
      logs: (rows || []).map((row) => ({
        id: row.id,
        action: row.action,
        metadata: row.metadata ? safeJsonParse(row.metadata) : null,
        createdAt: row.created_at,
        actorName: row.actor_name,
        actorEmail: row.actor_email,
      })),
    });
  })().catch((error) => {
    console.error("Admin settings audit error", error);
    return res.status(500).json({ message: "Erro ao buscar historico" });
  });
});

app.get("/api/wallet/settings", authMiddleware, (req, res) => {
  (async () => {
    const minDeposit = await getSettingNumber("min_deposit", 50);
    const minWithdraw = await getSettingNumber("min_withdraw", 50);
    return res.json({ minDeposit, minWithdraw });
  })().catch((error) => {
    console.error("Wallet settings error", error);
    return res.status(500).json({ message: "Erro ao buscar configuracoes" });
  });
});

app.get("/api/notifications/auto", authMiddleware, (req, res) => {
  (async () => {
    await runScheduledNotifications();
    const createdId = await ensureAutoNotification();
    return res.json({ status: "ok", createdId: createdId || null });
  })().catch((error) => {
    console.error("Notifications auto error", error);
    return res.status(500).json({ message: "Erro ao gerar notificacao" });
  });
});

app.get("/api/notifications", authMiddleware, (req, res) => {
  (async () => {
    const userId = Number(req.user?.sub);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const auto = String(req.query.auto || "").trim();
    if (auto === "1") {
      await runScheduledNotifications();
      await ensureAutoNotification();
    }

    const [rows] = await dbPool.execute(
      "SELECT n.id, n.title, n.message, n.crypto_id, n.crypto_symbol, n.crypto_icon_url, n.current_price, n.expected_gain_pct, n.created_at, " +
        "un.read_at, s.horario_fim " +
        "FROM notifications n " +
        "LEFT JOIN user_notifications un ON un.notification_id = n.id AND un.user_id = ? " +
        "LEFT JOIN sinais s ON s.id = n.sinal_id " +
        "WHERE n.sinal_id IS NULL OR s.horario_fim >= NOW() " +
        "ORDER BY n.created_at DESC " +
        `LIMIT ${limit} OFFSET ${offset}`,
      [userId]
    );

    return res.json({
      notifications: (rows || []).map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        cryptoId: row.crypto_id,
        cryptoSymbol: row.crypto_symbol,
        cryptoIconUrl: row.crypto_icon_url,
        currentPrice: Number(row.current_price || 0),
        expectedGainPct: Number(row.expected_gain_pct || 0),
        createdAt: row.created_at,
        isRead: Boolean(row.read_at),
      })),
    });
  })().catch((error) => {
    console.error("Notifications list error", error);
    return res.status(500).json({ message: "Erro ao buscar notificacoes" });
  });
});

app.get("/api/admin/notifications/schedules", authMiddleware, requirePermission("admin.notifications.view"), (req, res) => {
  (async () => {
    const [rows] = await dbPool.execute(
      "SELECT id, title, message, crypto_id, crypto_symbol, expected_gain_pct, current_price, start_at, end_at, interval_minutes, last_sent_at, active, created_at " +
        "FROM notification_schedules ORDER BY created_at DESC"
    );

    return res.json({
      schedules: (rows || []).map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        cryptoId: row.crypto_id,
        cryptoSymbol: row.crypto_symbol,
        expectedGainPct: Number(row.expected_gain_pct || 0),
        currentPrice: Number(row.current_price || 0),
        startAt: row.start_at,
        endAt: row.end_at,
        intervalMinutes: Number(row.interval_minutes || 1440),
        lastSentAt: row.last_sent_at,
        active: Boolean(row.active),
        createdAt: row.created_at,
      })),
    });
  })().catch((error) => {
    console.error("Admin notification schedules error", error);
    return res.status(500).json({ message: "Erro ao buscar notificacoes" });
  });
});

app.post("/api/admin/notifications/schedules", authMiddleware, requirePermission("admin.notifications.manage"), (req, res) => {
  (async () => {
    const title = String(req.body?.title || "").trim();
    const message = String(req.body?.message || "").trim();
    const cryptoId = String(req.body?.cryptoId || "").trim() || null;
    const cryptoSymbol = String(req.body?.cryptoSymbol || "").trim() || null;
    const expectedGainPct = req.body?.expectedGainPct !== undefined ? Number(req.body.expectedGainPct) : null;
    const currentPrice = req.body?.currentPrice !== undefined ? Number(req.body.currentPrice) : null;
    const startAt = normalizeDateTime(req.body?.startAt);
    const endAt = normalizeDateTime(req.body?.endAt);
    const intervalMinutes = Number(req.body?.intervalMinutes || 1440);
    const active = req.body?.active === false ? 0 : 1;

    if (!title || !message || !startAt || !Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      return res.status(400).json({ message: "Dados invalidos" });
    }

    const [result] = await dbPool.execute(
      "INSERT INTO notification_schedules (title, message, crypto_id, crypto_symbol, expected_gain_pct, current_price, start_at, end_at, interval_minutes, active) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        message,
        cryptoId,
        cryptoSymbol,
        Number.isFinite(expectedGainPct) ? expectedGainPct : null,
        Number.isFinite(currentPrice) ? currentPrice : null,
        startAt,
        endAt,
        Math.round(intervalMinutes),
        active,
      ]
    );

    await logAudit({
      req,
      action: "admin.notifications.schedule.create",
      targetType: "notifications",
      targetId: result?.insertId || null,
      metadata: { title, startAt, endAt, intervalMinutes },
    });

    return res.status(201).json({ status: "ok", id: result?.insertId || null });
  })().catch((error) => {
    console.error("Admin notification schedule create error", error);
    return res.status(500).json({ message: "Erro ao salvar notificacao" });
  });
});

app.put("/api/admin/notifications/schedules/:id", authMiddleware, requirePermission("admin.notifications.manage"), (req, res) => {
  (async () => {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({ message: "Notificacao invalida" });
    }

    const active = req.body?.active === false ? 0 : 1;
    await dbPool.execute(
      "UPDATE notification_schedules SET active = ? WHERE id = ?",
      [active, scheduleId]
    );

    await logAudit({
      req,
      action: "admin.notifications.schedule.update",
      targetType: "notifications",
      targetId: scheduleId,
      metadata: { active },
    });

    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Admin notification schedule update error", error);
    return res.status(500).json({ message: "Erro ao atualizar notificacao" });
  });
});

app.post("/api/admin/notifications/schedules/:id/send", authMiddleware, requirePermission("admin.notifications.manage"), (req, res) => {
  (async () => {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({ message: "Notificacao invalida" });
    }

    const [rows] = await dbPool.execute(
      "SELECT * FROM notification_schedules WHERE id = ? LIMIT 1",
      [scheduleId]
    );
    const schedule = rows && rows[0];
    if (!schedule) {
      return res.status(404).json({ message: "Notificacao nao encontrada" });
    }

    let iconUrl = null;
    let currentPrice = schedule.current_price;
    if (schedule.crypto_symbol) {
      const coin = await getCoinMarketBySymbol(schedule.crypto_symbol);
      iconUrl = coin?.image || null;
      if (!currentPrice && coin?.current_price) {
        currentPrice = Number(coin.current_price);
      }
    }

    const [result] = await dbPool.execute(
      "INSERT INTO notifications (title, message, sinal_id, crypto_id, crypto_symbol, crypto_icon_url, current_price, expected_gain_pct) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        schedule.title,
        schedule.message,
        null,
        schedule.crypto_id,
        schedule.crypto_symbol,
        iconUrl,
        currentPrice,
        schedule.expected_gain_pct,
      ]
    );

    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    await dbPool.execute(
      "UPDATE notification_schedules SET last_sent_at = ? WHERE id = ?",
      [nowStr, scheduleId]
    );

    await logAudit({
      req,
      action: "admin.notifications.schedule.send",
      targetType: "notifications",
      targetId: scheduleId,
      metadata: { notificationId: result?.insertId || null },
    });

    return res.json({ status: "ok", id: result?.insertId || null });
  })().catch((error) => {
    console.error("Admin notification schedule send error", error);
    return res.status(500).json({ message: "Erro ao enviar notificacao" });
  });
});

app.delete("/api/admin/notifications/schedules/:id", authMiddleware, requirePermission("admin.notifications.manage"), (req, res) => {
  (async () => {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      return res.status(400).json({ message: "Notificacao invalida" });
    }

    await dbPool.execute("DELETE FROM notification_schedules WHERE id = ?", [scheduleId]);

    await logAudit({
      req,
      action: "admin.notifications.schedule.delete",
      targetType: "notifications",
      targetId: scheduleId,
      metadata: null,
    });

    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Admin notification schedule delete error", error);
    return res.status(500).json({ message: "Erro ao remover notificacao" });
  });
});

app.get("/api/admin/sinais", authMiddleware, requirePermission("admin.notifications.view"), (req, res) => {
  (async () => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const [rows] = await dbPool.execute(
      "SELECT id, crypto_symbol, horario_inicio, horario_fim, lucro_percentual, criado_em " +
        "FROM sinais ORDER BY horario_inicio DESC " +
        `LIMIT ${limit}`
    );

    return res.json({
      sinais: (rows || []).map((row) => ({
        id: row.id,
        cryptoSymbol: row.crypto_symbol,
        horarioInicio: row.horario_inicio,
        horarioFim: row.horario_fim,
        lucroPercentual: Number(row.lucro_percentual || 0),
        criadoEm: row.criado_em,
      })),
    });
  })().catch((error) => {
    console.error("Admin sinais list error", error);
    return res.status(500).json({ message: "Erro ao listar sinais" });
  });
});

app.post("/api/admin/sinais", authMiddleware, requirePermission("admin.notifications.manage"), (req, res) => {
  (async () => {
    const cryptoSymbol = String(req.body?.cryptoSymbol || "").trim().toLowerCase();
    const lucroPercentual = Number(req.body?.lucroPercentual || 0);
    const horarioInicio = normalizeDateTime(req.body?.horarioInicio);
    const horarioFim = normalizeDateTime(req.body?.horarioFim);

    if (!cryptoSymbol || !horarioInicio || !horarioFim || !Number.isFinite(lucroPercentual)) {
      return res.status(400).json({ message: "Dados invalidos" });
    }

    const available = await getAvailableCryptoSymbols();
    if (!available.includes(cryptoSymbol)) {
      return res.status(400).json({ message: "Moeda nao disponivel na plataforma" });
    }

    const [result] = await dbPool.execute(
      "INSERT INTO sinais (crypto_symbol, horario_inicio, horario_fim, lucro_percentual) VALUES (?, ?, ?, ?)",
      [cryptoSymbol, horarioInicio, horarioFim, lucroPercentual]
    );

    await logAudit({
      req,
      action: "admin.sinais.create",
      targetType: "sinais",
      targetId: result?.insertId || null,
      metadata: { cryptoSymbol, horarioInicio, horarioFim, lucroPercentual },
    });

    await ensureSignalNotification();

    return res.status(201).json({ status: "ok", id: result?.insertId || null });
  })().catch((error) => {
    console.error("Admin sinais create error", error);
    return res.status(500).json({ message: "Erro ao criar sinal" });
  });
});

app.post("/api/admin/sinais/gerar-agora", authMiddleware, requirePermission("admin.notifications.manage"), (req, res) => {
  (async () => {
    const durationMinutes = Math.min(Math.max(Number(req.body?.durationMinutes || 15), 5), 180);
    const lucroPercentual = Number(req.body?.lucroPercentual || getRandomFloat(8, 18, 2));
    const available = await getAvailableCryptoSymbols();
    const requestedSymbol = String(req.body?.cryptoSymbol || "").trim().toLowerCase();
    if (!available.length) {
      return res.status(400).json({ message: "Sem moedas disponiveis" });
    }
    if (requestedSymbol && !available.includes(requestedSymbol)) {
      return res.status(400).json({ message: "Moeda nao disponivel na plataforma" });
    }
    const cryptoSymbol = requestedSymbol || available[getRandomInt(0, available.length - 1)];

    const inicio = new Date();
    const fim = new Date(inicio.getTime() + durationMinutes * 60 * 1000);

    const [result] = await dbPool.execute(
      "INSERT INTO sinais (crypto_symbol, horario_inicio, horario_fim, lucro_percentual) VALUES (?, ?, ?, ?)",
      [
        cryptoSymbol,
        inicio.toISOString().slice(0, 19).replace("T", " "),
        fim.toISOString().slice(0, 19).replace("T", " "),
        lucroPercentual,
      ]
    );

    await logAudit({
      req,
      action: "admin.sinais.generate_now",
      targetType: "sinais",
      targetId: result?.insertId || null,
      metadata: { cryptoSymbol, durationMinutes, lucroPercentual },
    });

    await ensureSignalNotification();

    return res.status(201).json({ status: "ok", id: result?.insertId || null });
  })().catch((error) => {
    console.error("Admin sinais generate error", error);
    return res.status(500).json({ message: "Erro ao gerar sinal" });
  });
});

app.get("/api/notifications/unread-count", authMiddleware, (req, res) => {
  (async () => {
    const userId = Number(req.user?.sub);
    const [[{ total }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total " +
        "FROM notifications n " +
        "LEFT JOIN user_notifications un ON un.notification_id = n.id AND un.user_id = ? " +
        "LEFT JOIN sinais s ON s.id = n.sinal_id " +
        "WHERE un.read_at IS NULL AND (n.sinal_id IS NULL OR s.horario_fim >= NOW())",
      [userId]
    );

    return res.json({ unread: Number(total || 0) });
  })().catch((error) => {
    console.error("Notifications unread error", error);
    return res.status(500).json({ message: "Erro ao buscar notificacoes" });
  });
});

app.post("/api/notifications/:id/read", authMiddleware, (req, res) => {
  (async () => {
    const userId = Number(req.user?.sub);
    const notificationId = Number(req.params.id);
    if (!Number.isFinite(notificationId)) {
      return res.status(400).json({ message: "Notificacao invalida" });
    }

    await dbPool.execute(
      "INSERT INTO user_notifications (user_id, notification_id, read_at) VALUES (?, ?, NOW()) " +
        "ON DUPLICATE KEY UPDATE read_at = NOW()",
      [userId, notificationId]
    );

    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Notifications read error", error);
    return res.status(500).json({ message: "Erro ao atualizar notificacao" });
  });
});

app.post("/api/notifications/read-all", authMiddleware, (req, res) => {
  (async () => {
    const userId = Number(req.user?.sub);
    await dbPool.execute(
      "INSERT INTO user_notifications (user_id, notification_id, read_at) " +
        "SELECT ?, n.id, NOW() FROM notifications n " +
        "LEFT JOIN user_notifications un ON un.notification_id = n.id AND un.user_id = ? " +
        "WHERE un.notification_id IS NULL",
      [userId, userId]
    );
    await dbPool.execute(
      "UPDATE user_notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL",
      [userId]
    );
    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Notifications read all error", error);
    return res.status(500).json({ message: "Erro ao atualizar notificacoes" });
  });
});

app.get("/api/admin/users", authMiddleware, requirePermission("admin.users.view"), (req, res) => {
  (async () => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim();

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push("(u.nome LIKE ? OR u.email LIKE ? OR u.cpf LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (role && ["admin", "user"].includes(role)) {
      conditions.push(
        "EXISTS (SELECT 1 FROM usuario_roles ur2 INNER JOIN roles r2 ON r2.id = ur2.role_id WHERE ur2.usuario_id = u.id AND r2.nome = ?)"
      );
      params.push(role);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows] = await dbPool.execute(
      `SELECT COUNT(*) AS total FROM usuarios u ${where}`,
      params
    );

    const listSql =
      "SELECT u.id, u.nome, u.email, u.cpf, u.ativo, u.criado_em, GROUP_CONCAT(r.nome) AS roles " +
      "FROM usuarios u " +
      "LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id " +
      "LEFT JOIN roles r ON r.id = ur.role_id " +
      `${where} ` +
      "GROUP BY u.id, u.nome, u.email, u.cpf, u.ativo, u.criado_em " +
      "ORDER BY u.criado_em DESC " +
      `LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await dbPool.execute(listSql, params);

    return res.json({
      total: Number(countRows?.[0]?.total || 0),
      users: rows.map((row) => ({
        id: row.id,
        name: row.nome,
        email: row.email,
        cpf: row.cpf,
        active: Boolean(row.ativo),
        createdAt: row.criado_em,
        roles: row.roles ? String(row.roles).split(",") : [],
      })),
    });
  })().catch((error) => {
    console.error("Admin users error", error);
    return res.status(500).json({ message: "Erro ao buscar usuarios" });
  });
});

app.get("/api/admin/users/:id", authMiddleware, requirePermission("admin.users.view"), (req, res) => {
  (async () => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    await ensureSaldoRow(userId);

    const [rows] = await dbPool.execute(
      "SELECT u.id, u.nome, u.email, u.cpf, u.ativo, s.saldo_disponivel, s.saldo_bloqueado, " +
        "GROUP_CONCAT(r.nome) AS roles " +
        "FROM usuarios u " +
        "LEFT JOIN saldos s ON s.usuario_id = u.id " +
        "LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id " +
        "LEFT JOIN roles r ON r.id = ur.role_id " +
        "WHERE u.id = ? " +
        "GROUP BY u.id, u.nome, u.email, u.cpf, u.ativo, s.saldo_disponivel, s.saldo_bloqueado",
      [userId]
    );

    const row = rows && rows[0];
    if (!row) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    return res.json({
      user: {
        id: row.id,
        name: row.nome,
        email: row.email,
        cpf: row.cpf,
        active: Boolean(row.ativo),
        roles: row.roles ? String(row.roles).split(",") : [],
        saldoDisponivel: Number(row.saldo_disponivel || 0),
        saldoBloqueado: Number(row.saldo_bloqueado || 0),
      },
    });
  })().catch((error) => {
    console.error("Admin user detail error", error);
    return res.status(500).json({ message: "Erro ao buscar usuario" });
  });
});

app.put("/api/admin/users/:id", authMiddleware, requirePermission("admin.users.edit"), (req, res) => {
  (async () => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const role = String(req.body?.role || "").trim();
    const saldoDisponivel = Number(req.body?.saldoDisponivel);
    const saldoBloqueado = req.body?.saldoBloqueado !== undefined ? Number(req.body?.saldoBloqueado) : null;

    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).json({ message: "Role invalida" });
    }

    if (Number(req.user?.sub) === userId && role !== "admin") {
      return res.status(400).json({ message: "Nao e permitido remover seu proprio admin" });
    }

    await ensureSaldoRow(userId);

    if (Number.isFinite(saldoDisponivel) && saldoDisponivel >= 0) {
      await dbPool.execute(
        "UPDATE saldos SET saldo_disponivel = ? WHERE usuario_id = ?",
        [saldoDisponivel, userId]
      );
    }

    if (saldoBloqueado !== null && Number.isFinite(saldoBloqueado) && saldoBloqueado >= 0) {
      await dbPool.execute(
        "UPDATE saldos SET saldo_bloqueado = ? WHERE usuario_id = ?",
        [saldoBloqueado, userId]
      );
    }

    await dbPool.execute("DELETE FROM usuario_roles WHERE usuario_id = ?", [userId]);
    await dbPool.execute(
      "INSERT INTO usuario_roles (usuario_id, role_id) SELECT ?, id FROM roles WHERE nome = ?",
      [userId, role]
    );

    clearUserPermissionCache(userId);

    await logAudit({
      req,
      action: "admin.user.update",
      targetType: "usuario",
      targetId: userId,
      metadata: {
        role,
        saldoDisponivel: Number.isFinite(saldoDisponivel) ? saldoDisponivel : null,
        saldoBloqueado: Number.isFinite(saldoBloqueado) ? saldoBloqueado : null,
      },
    });
    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Admin user update error", error);
    return res.status(500).json({ message: "Erro ao atualizar usuario" });
  });
});

app.put("/api/admin/users/:id/status", authMiddleware, requirePermission("admin.users.edit"), (req, res) => {
  (async () => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const active = req.body?.active === true;
    if (Number(req.user?.sub) === userId && !active) {
      return res.status(400).json({ message: "Nao e permitido desativar o proprio usuario" });
    }

    await dbPool.execute("UPDATE usuarios SET ativo = ? WHERE id = ?", [active ? 1 : 0, userId]);

    await logAudit({
      req,
      action: active ? "admin.user.activate" : "admin.user.deactivate",
      targetType: "usuario",
      targetId: userId,
      metadata: { active },
    });

    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Admin user status error", error);
    return res.status(500).json({ message: "Erro ao atualizar status" });
  });
});

app.post("/api/admin/users/:id/reset-password", authMiddleware, requirePermission("admin.users.edit"), (req, res) => {
  (async () => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const tempPassword = generateTempPassword();
    const senhaHash = await bcrypt.hash(tempPassword, 10);
    await dbPool.execute("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [senhaHash, userId]);

    await logAudit({
      req,
      action: "admin.user.reset_password",
      targetType: "usuario",
      targetId: userId,
      metadata: null,
    });

    return res.json({ temporaryPassword: tempPassword });
  })().catch((error) => {
    console.error("Admin reset password error", error);
    return res.status(500).json({ message: "Erro ao resetar senha" });
  });
});

app.get("/api/admin/users/:id/audit", authMiddleware, requirePermission("admin.users.view"), (req, res) => {
  (async () => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows] = await dbPool.execute(
      "SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.ip_address, a.user_agent, a.created_at, " +
        "u.nome AS actor_name, u.email AS actor_email " +
        "FROM audit_logs a " +
        "LEFT JOIN usuarios u ON u.id = a.actor_user_id " +
        "WHERE a.target_type = 'usuario' AND a.target_id = ? " +
        "ORDER BY a.created_at DESC " +
        `LIMIT ${limit} OFFSET ${offset}`,
      [String(userId)]
    );

    return res.json({
      logs: (rows || []).map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata ? safeJsonParse(row.metadata) : null,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at,
        actorName: row.actor_name,
        actorEmail: row.actor_email,
      })),
    });
  })().catch((error) => {
    console.error("Admin audit logs error", error);
    return res.status(500).json({ message: "Erro ao buscar auditoria" });
  });
});

app.get("/api/admin/transactions", authMiddleware, requirePermission("admin.transactions.view"), (req, res) => {
  (async () => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const status = String(req.query.status || "").trim();
    const tipo = String(req.query.tipo || "").trim();
    const user = String(req.query.user || "").trim();
    const startDate = String(req.query.startDate || "").trim();
    const endDate = String(req.query.endDate || "").trim();
    const minValueRaw = String(req.query.minValue || "").trim();
    const maxValueRaw = String(req.query.maxValue || "").trim();
    const minValue = Number(minValueRaw.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", "."));
    const maxValue = Number(maxValueRaw.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", "."));
    const orderBy = String(req.query.orderBy || "").trim();
    const orderDirRaw = String(req.query.orderDir || "").trim().toLowerCase();
    const orderDir = orderDirRaw === "asc" ? "ASC" : "DESC";
    const orderByMap = {
      date: "t.criado_em",
      value: "COALESCE(t.valor_liquido, t.valor_bruto)",
      status: "t.status",
      tipo: "t.tipo",
    };
    const orderColumn = orderByMap[orderBy] || orderByMap.date;

    const conditions = [];
    const params = [];

    const statusList = parseCsvFilter(status, ["APROVADO", "PENDENTE", "CANCELADO"]);
    if (statusList.length) {
      conditions.push(`t.status IN (${statusList.map(() => "?").join(",")})`);
      params.push(...statusList);
    }
    const tipoList = parseCsvFilter(tipo, ["CASH_IN", "CASH_OUT"]);
    if (tipoList.length) {
      conditions.push(`t.tipo IN (${tipoList.map(() => "?").join(",")})`);
      params.push(...tipoList);
    }
    if (user) {
      const userId = Number.isFinite(Number(user)) ? Number(user) : -1;
      const like = `%${user}%`;
      conditions.push("(u.id = ? OR u.email LIKE ? OR u.nome LIKE ?)");
      params.push(userId, like, like);
    }
    if (startDate) {
      conditions.push("t.criado_em >= ?");
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push("t.criado_em <= ?");
      params.push(`${endDate} 23:59:59`);
    }
    if (minValueRaw && Number.isFinite(minValue)) {
      conditions.push("COALESCE(t.valor_liquido, t.valor_bruto) >= ?");
      params.push(minValue);
    }
    if (maxValueRaw && Number.isFinite(maxValue)) {
      conditions.push("COALESCE(t.valor_liquido, t.valor_bruto) <= ?");
      params.push(maxValue);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRows] = await dbPool.execute(
      "SELECT COUNT(*) AS total FROM transacoes_pix t LEFT JOIN usuarios u ON u.id = t.usuario_id " + where,
      params
    );

    const listSql =
      "SELECT t.id, t.usuario_id, t.tipo, t.status, t.valor_bruto, t.valor_liquido, t.id_transaction, t.external_reference, t.id_local, t.criado_em, " +
      "u.nome AS usuario_nome, u.email AS usuario_email " +
      "FROM transacoes_pix t " +
      "LEFT JOIN usuarios u ON u.id = t.usuario_id " +
      where +
      ` ORDER BY ${orderColumn} ${orderDir} ` +
      `LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await dbPool.execute(listSql, params);

    return res.json({
      total: Number(countRows?.[0]?.total || 0),
      transactions: rows.map((row) => ({
        id: row.id,
        userId: row.usuario_id,
        userName: row.usuario_nome,
        userEmail: row.usuario_email,
        tipo: row.tipo,
        status: row.status,
        valorBruto: Number(row.valor_bruto || 0),
        valorLiquido: Number(row.valor_liquido || 0),
        idTransaction: row.id_transaction,
        externalReference: row.external_reference,
        localId: row.id_local,
        createdAt: row.criado_em,
      })),
    });
  })().catch((error) => {
    console.error("Admin transactions error", error);
    return res.status(500).json({ message: "Erro ao buscar transacoes" });
  });
});

app.get("/api/admin/transactions/:id", authMiddleware, requirePermission("admin.transactions.view"), (req, res) => {
  (async () => {
    const transactionId = Number(req.params.id);
    if (!Number.isFinite(transactionId)) {
      return res.status(400).json({ message: "Transacao invalida" });
    }

    const [rows] = await dbPool.execute(
      "SELECT t.id, t.usuario_id, t.tipo, t.status, t.valor_bruto, t.valor_liquido, t.id_transaction, t.external_reference, " +
        "t.id_local, t.payment_code, t.payment_code_base64, t.criado_em, t.atualizado_em, " +
        "u.nome AS usuario_nome, u.email AS usuario_email, u.cpf AS usuario_cpf " +
        "FROM transacoes_pix t " +
        "LEFT JOIN usuarios u ON u.id = t.usuario_id " +
        "WHERE t.id = ? LIMIT 1",
      [transactionId]
    );

    const row = rows && rows[0];
    if (!row) {
      return res.status(404).json({ message: "Transacao nao encontrada" });
    }

    return res.json({
      transaction: {
        id: row.id,
        userId: row.usuario_id,
        userName: row.usuario_nome,
        userEmail: row.usuario_email,
        userCpf: row.usuario_cpf,
        tipo: row.tipo,
        status: row.status,
        valorBruto: Number(row.valor_bruto || 0),
        valorLiquido: Number(row.valor_liquido || 0),
        idTransaction: row.id_transaction,
        externalReference: row.external_reference,
        localId: row.id_local,
        paymentCode: row.payment_code,
        paymentCodeBase64: row.payment_code_base64,
        createdAt: row.criado_em,
        updatedAt: row.atualizado_em,
      },
    });
  })().catch((error) => {
    console.error("Admin transaction detail error", error);
    return res.status(500).json({ message: "Erro ao buscar transacao" });
  });
});

app.get("/api/admin/affiliates", authMiddleware, requirePermission("admin.affiliates.view"), (req, res) => {
  (async () => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const search = String(req.query.search || "").trim();

    let where = "WHERE u.referral_code IS NOT NULL";
    const params = [];
    if (search) {
      where += " AND (u.nome LIKE ? OR u.email LIKE ? OR u.cpf LIKE ? OR u.referral_code LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const [countRows] = await dbPool.execute(
      `SELECT COUNT(*) AS total FROM usuarios u ${where}`,
      params
    );

    const listSql =
      "SELECT u.id, u.nome, u.email, u.cpf, u.referral_code, u.criado_em, " +
      "COUNT(r.id) AS total_referidos, " +
      "COALESCE(SUM(rc.commission_amount), 0) AS total_commission, " +
      "COALESCE(SUM(CASE WHEN rc.status = 'PAID' THEN rc.commission_amount ELSE 0 END), 0) AS paid_commission, " +
      "COALESCE(SUM(CASE WHEN rc.status != 'PAID' THEN rc.commission_amount ELSE 0 END), 0) AS pending_commission " +
      "FROM usuarios u " +
      "LEFT JOIN usuarios r ON r.referred_by = u.id " +
      "LEFT JOIN referral_commissions rc ON rc.referrer_id = u.id " +
      `${where} ` +
      "GROUP BY u.id, u.nome, u.email, u.cpf, u.referral_code, u.criado_em " +
      "ORDER BY total_commission DESC, total_referidos DESC, u.criado_em DESC " +
      `LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await dbPool.execute(listSql, params);

    return res.json({
      total: Number(countRows?.[0]?.total || 0),
      affiliates: rows.map((row) => ({
        id: row.id,
        name: row.nome,
        email: row.email,
        cpf: row.cpf,
        referralCode: row.referral_code,
        createdAt: row.criado_em,
        totalReferred: Number(row.total_referidos || 0),
        totalCommission: Number(row.total_commission || 0),
        paidCommission: Number(row.paid_commission || 0),
        pendingCommission: Number(row.pending_commission || 0),
      })),
    });
  })().catch((error) => {
    console.error("Admin affiliates error", error);
    return res.status(500).json({ message: "Erro ao buscar afiliados" });
  });
});

app.get("/api/admin/affiliates/summary", authMiddleware, requirePermission("admin.affiliates.view"), (req, res) => {
  (async () => {
    const [[{ total_affiliates }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_affiliates FROM usuarios WHERE referral_code IS NOT NULL"
    );
    const [[{ total_referred }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_referred FROM usuarios WHERE referred_by IS NOT NULL"
    );
    const [[summary]] = await dbPool.execute(
      "SELECT " +
        "COALESCE(SUM(commission_amount), 0) AS total_commission, " +
        "COALESCE(SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END), 0) AS paid_commission, " +
        "COALESCE(SUM(CASE WHEN status != 'PAID' THEN commission_amount ELSE 0 END), 0) AS pending_commission " +
        "FROM referral_commissions"
    );

    return res.json({
      totalAffiliates: Number(total_affiliates || 0),
      totalReferred: Number(total_referred || 0),
      totalCommission: Number(summary?.total_commission || 0),
      paidCommission: Number(summary?.paid_commission || 0),
      pendingCommission: Number(summary?.pending_commission || 0),
      commissionPercent: referralCommissionPercent,
    });
  })().catch((error) => {
    console.error("Admin affiliates summary error", error);
    return res.status(500).json({ message: "Erro ao buscar resumo de afiliados" });
  });
});

app.get("/api/admin/reports/overview", authMiddleware, requirePermission("admin.reports.view"), (req, res) => {
  (async () => {
    const { startDate, endDate } = parseDateRange(req.query || {});
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Datas invalidas" });
    }

    const rangeStart = `${startDate} 00:00:00`;
    const rangeEnd = `${endDate} 23:59:59`;

    const [[{ total_users }]] = await dbPool.execute("SELECT COUNT(*) AS total_users FROM usuarios");
    const [[{ new_users }]] = await dbPool.execute(
      "SELECT COUNT(*) AS new_users FROM usuarios WHERE criado_em BETWEEN ? AND ?",
      [rangeStart, rangeEnd]
    );

    const [[summaryRow]] = await dbPool.execute(
      "SELECT " +
        "COUNT(*) AS total_transactions, " +
        "SUM(CASE WHEN status = 'APROVADO' THEN 1 ELSE 0 END) AS total_approved, " +
        "SUM(CASE WHEN status = 'PENDENTE' THEN 1 ELSE 0 END) AS total_pending, " +
        "SUM(CASE WHEN status = 'CANCELADO' THEN 1 ELSE 0 END) AS total_canceled, " +
        "SUM(CASE WHEN tipo = 'CASH_IN' AND status = 'APROVADO' THEN valor_liquido ELSE 0 END) AS cashin_value, " +
        "SUM(CASE WHEN tipo = 'CASH_OUT' AND status = 'APROVADO' THEN valor_liquido ELSE 0 END) AS cashout_value " +
        "FROM transacoes_pix WHERE criado_em BETWEEN ? AND ?",
      [rangeStart, rangeEnd]
    );

    const [[{ total_cashin }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_cashin FROM transacoes_pix " +
        "WHERE tipo = 'CASH_IN' AND criado_em BETWEEN ? AND ?",
      [rangeStart, rangeEnd]
    );
    const [[{ total_cashout }]] = await dbPool.execute(
      "SELECT COUNT(*) AS total_cashout FROM transacoes_pix " +
        "WHERE tipo = 'CASH_OUT' AND criado_em BETWEEN ? AND ?",
      [rangeStart, rangeEnd]
    );

    const [seriesRows] = await dbPool.execute(
      "SELECT DATE(t.criado_em) AS dia, " +
        "SUM(CASE WHEN t.tipo = 'CASH_IN' AND t.status = 'APROVADO' THEN t.valor_liquido ELSE 0 END) AS cashin_value, " +
        "SUM(CASE WHEN t.tipo = 'CASH_OUT' AND t.status = 'APROVADO' THEN t.valor_liquido ELSE 0 END) AS cashout_value, " +
        "COUNT(*) AS total_transactions, " +
        "SUM(CASE WHEN t.status = 'APROVADO' THEN 1 ELSE 0 END) AS approved_transactions " +
        "FROM transacoes_pix t " +
        "WHERE t.criado_em BETWEEN ? AND ? " +
        "GROUP BY DATE(t.criado_em) " +
        "ORDER BY DATE(t.criado_em) ASC",
      [rangeStart, rangeEnd]
    );

    const totalTransactions = Number(summaryRow?.total_transactions || 0);
    const totalApproved = Number(summaryRow?.total_approved || 0);
    const approvalRate = totalTransactions > 0 ? Math.round((totalApproved / totalTransactions) * 100) : 0;

    return res.json({
      range: { startDate, endDate },
      summary: {
        totalUsers: Number(total_users || 0),
        newUsers: Number(new_users || 0),
        totalTransactions,
        totalApproved,
        totalPending: Number(summaryRow?.total_pending || 0),
        totalCanceled: Number(summaryRow?.total_canceled || 0),
        totalCashin: Number(total_cashin || 0),
        totalCashout: Number(total_cashout || 0),
        cashinValue: Number(summaryRow?.cashin_value || 0),
        cashoutValue: Number(summaryRow?.cashout_value || 0),
        approvalRate,
      },
      series: (seriesRows || []).map((row) => ({
        date: row.dia ? new Date(row.dia).toISOString().slice(0, 10) : null,
        cashinValue: Number(row.cashin_value || 0),
        cashoutValue: Number(row.cashout_value || 0),
        totalTransactions: Number(row.total_transactions || 0),
        approvedTransactions: Number(row.approved_transactions || 0),
      })),
    });
  })().catch((error) => {
    console.error("Admin reports overview error", error);
    return res.status(500).json({ message: "Erro ao buscar relatorios" });
  });
});

async function generateReferralCode(pool) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const [rows] = await pool.execute(
      "SELECT id FROM usuarios WHERE referral_code = ? LIMIT 1",
      [code]
    );
    if (!rows || rows.length === 0) {
      return code;
    }
  }
  throw new Error("Nao foi possivel gerar codigo de indicacao unico");
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/coingecko/coins/markets", (req, res) => {
  (async () => {
    const requestId = createRequestId();
    const params = new URLSearchParams();
    const vsCurrency = String(req.query.vs_currency || "brl");
    params.set("vs_currency", vsCurrency);
    if (req.query.order) params.set("order", String(req.query.order));
    if (req.query.per_page) params.set("per_page", String(req.query.per_page));
    if (req.query.page) params.set("page", String(req.query.page));
    if (req.query.sparkline) params.set("sparkline", String(req.query.sparkline));
    if (req.query.ids) params.set("ids", String(req.query.ids));

    const url = `${coingeckoBaseUrl}/coins/markets?${params.toString()}`;
    const cacheKey = `coins/markets?${params.toString()}`;
    let dbCache = null;
    try {
      dbCache = await getCoingeckoCache(cacheKey);
    } catch (cacheError) {
      console.error("CoinGecko cache read error", cacheError);
    }
    const cacheAgeMs = dbCache ? Date.now() - dbCache.updatedAt : null;
    const isFresh = cacheAgeMs !== null && cacheAgeMs <= 10 * 60 * 1000;

    if (dbCache?.payload && isFresh) {
      res.setHeader("X-Cache", "db-hit");
      return res.json(dbCache.payload);
    }

    try {
      const data = await cachedFetchJson(url, 120000, requestId);
      try {
        await setCoingeckoCache(cacheKey, data);
      } catch (cacheError) {
        console.error("CoinGecko cache write error", cacheError);
      }
      res.setHeader("X-Cache", "proxy");
      return res.json(data);
    } catch (error) {
      if (dbCache?.payload) {
        res.setHeader("X-Cache", "db-stale");
        return res.json(dbCache.payload);
      }
      throw error;
    }
  })().catch((error) => {
    console.error("CoinGecko markets error", {
      requestId: error?.requestId || "n/a",
      status: error?.status || 500,
      message: error?.message || "Erro no proxy CoinGecko",
      url: error?.url,
    });
    return res.status(error?.status || 500).json({ message: error?.message || "Erro no proxy CoinGecko" });
  });
});

app.get("/api/coingecko/coins/:id/market_chart", (req, res) => {
  (async () => {
    const requestId = createRequestId();
    const params = new URLSearchParams();
    params.set("vs_currency", String(req.query.vs_currency || "brl"));
    params.set("days", String(req.query.days || "1"));
    const url = `${coingeckoBaseUrl}/coins/${encodeURIComponent(req.params.id)}/market_chart?${params.toString()}`;
    const cacheKey = `coins/${req.params.id}/market_chart?${params.toString()}`;
    const fallbackParams = new URLSearchParams();
    fallbackParams.set("vs_currency", String(req.query.vs_currency || "brl"));
    fallbackParams.set("days", "1");
    const fallbackKey = `coins/${req.params.id}/market_chart?${fallbackParams.toString()}`;
    let dbCache = null;
    try {
      dbCache = await getCoingeckoCache(cacheKey);
    } catch (cacheError) {
      console.error("CoinGecko cache read error", cacheError);
    }

    if (dbCache?.payload && getCacheFreshness(dbCache, 30 * 60 * 1000)) {
      res.setHeader("X-Cache", "db-hit");
      return res.json(dbCache.payload);
    }

    try {
      const data = await cachedFetchJson(url, 300000, requestId);
      try {
        await setCoingeckoCache(cacheKey, data);
      } catch (cacheError) {
        console.error("CoinGecko cache write error", cacheError);
      }
      res.setHeader("X-Cache", "proxy");
      return res.json(data);
    } catch (error) {
      if (dbCache?.payload) {
        res.setHeader("X-Cache", "db-stale");
        return res.json(dbCache.payload);
      }
      if (cacheKey !== fallbackKey) {
        try {
          const fallbackCache = await getCoingeckoCache(fallbackKey);
          if (fallbackCache?.payload) {
            res.setHeader("X-Cache", "db-fallback");
            return res.json(fallbackCache.payload);
          }
        } catch (cacheError) {
          console.error("CoinGecko fallback cache error", cacheError);
        }
      }
      throw error;
    }
  })().catch((error) => {
    console.error("CoinGecko market_chart error", {
      requestId: error?.requestId || "n/a",
      status: error?.status || 500,
      message: error?.message || "Erro no proxy CoinGecko",
      url: error?.url,
    });
    return res.status(error?.status || 500).json({ message: error?.message || "Erro no proxy CoinGecko" });
  });
});

app.get("/api/coingecko/coins/:id/market_chart/range", (req, res) => {
  (async () => {
    const requestId = createRequestId();
    const params = new URLSearchParams();
    params.set("vs_currency", String(req.query.vs_currency || "brl"));
    params.set("from", String(req.query.from || ""));
    params.set("to", String(req.query.to || ""));
    const url = `${coingeckoBaseUrl}/coins/${encodeURIComponent(req.params.id)}/market_chart/range?${params.toString()}`;
    const data = await cachedFetchJson(url, 180000, requestId);
    return res.json(data);
  })().catch((error) => {
    console.error("CoinGecko market_chart_range error", {
      requestId: error?.requestId || "n/a",
      status: error?.status || 500,
      message: error?.message || "Erro no proxy CoinGecko",
      url: error?.url,
    });
    return res.status(error?.status || 500).json({ message: error?.message || "Erro no proxy CoinGecko" });
  });
});

app.get("/api/coingecko/coins/:id/ohlc", (req, res) => {
  (async () => {
    const requestId = createRequestId();
    const params = new URLSearchParams();
    params.set("vs_currency", String(req.query.vs_currency || "brl"));
    params.set("days", String(req.query.days || "1"));
    const url = `${coingeckoBaseUrl}/coins/${encodeURIComponent(req.params.id)}/ohlc?${params.toString()}`;
    const cacheKey = `coins/${req.params.id}/ohlc?${params.toString()}`;
    const fallbackParams = new URLSearchParams();
    fallbackParams.set("vs_currency", String(req.query.vs_currency || "brl"));
    fallbackParams.set("days", "1");
    const fallbackKey = `coins/${req.params.id}/ohlc?${fallbackParams.toString()}`;
    const chartFallbackKey = `coins/${req.params.id}/market_chart?${fallbackParams.toString()}`;
    let dbCache = null;
    try {
      dbCache = await getCoingeckoCache(cacheKey);
    } catch (cacheError) {
      console.error("CoinGecko cache read error", cacheError);
    }

    if (dbCache?.payload && getCacheFreshness(dbCache, 30 * 60 * 1000)) {
      res.setHeader("X-Cache", "db-hit");
      return res.json(dbCache.payload);
    }

    try {
      const data = await cachedFetchJson(url, 300000, requestId);
      try {
        await setCoingeckoCache(cacheKey, data);
      } catch (cacheError) {
        console.error("CoinGecko cache write error", cacheError);
      }
      res.setHeader("X-Cache", "proxy");
      return res.json(data);
    } catch (error) {
      if (dbCache?.payload) {
        res.setHeader("X-Cache", "db-stale");
        return res.json(dbCache.payload);
      }
      if (cacheKey !== fallbackKey) {
        try {
          const fallbackCache = await getCoingeckoCache(fallbackKey);
          if (fallbackCache?.payload) {
            res.setHeader("X-Cache", "db-fallback");
            return res.json(fallbackCache.payload);
          }
        } catch (cacheError) {
          console.error("CoinGecko fallback cache error", cacheError);
        }
      }

      try {
        const chartCache = await getCoingeckoCache(chartFallbackKey);
        const prices = chartCache?.payload?.prices || [];
        if (prices.length > 0) {
          const target = Number(req.query.days || 1) <= 7 ? 120 : 80;
          const derived = buildOhlcFromPrices(prices, target);
          if (derived.length > 0) {
            res.setHeader("X-Cache", "derived");
            return res.json(derived);
          }
        }
      } catch (cacheError) {
        console.error("CoinGecko derived cache error", cacheError);
      }
      throw error;
    }
  })().catch((error) => {
    console.error("CoinGecko ohlc error", {
      requestId: error?.requestId || "n/a",
      status: error?.status || 500,
      message: error?.message || "Erro no proxy CoinGecko",
      url: error?.url,
    });
    return res.status(error?.status || 500).json({ message: error?.message || "Erro no proxy CoinGecko" });
  });
});

app.get("/api/valorion/saldo", authMiddleware, (req, res) => {
  valorionGet("https://app.valorion.com.br/api/s1/getsaldo/api/")
    .then((data) => res.json(data))
    .catch((error) => res.status(500).json({ message: error.message }));
});

app.get("/api/wallet/balance", authMiddleware, (req, res) => {
  (async () => {
    await ensureSaldoRow(req.user.sub);

    // Busca saldo atual
    const [rows] = await dbPool.execute(
      "SELECT u.id,s.saldo_disponivel, s.saldo_bloqueado FROM saldos s INNER JOIN usuarios u ON s.usuario_id = u.id WHERE u.id = ?",
      [req.user.sub]
    );
    const row = rows && rows[0];

    // Busca saldo de 24h atrás
    const [histRows] = await dbPool.execute(
      "SELECT saldo FROM saldos_historico WHERE usuario_id = ? AND data_ref = CURDATE() - INTERVAL 1 DAY",
      [req.user.sub]
    );
    const saldoAnterior = histRows && histRows[0] ? Number(histRows[0].saldo) : null;

    return res.json({
      saldoDisponivel: Number(row?.saldo_disponivel || 0),
      saldoBloqueado: Number(row?.saldo_bloqueado || 0),
      saldoAnterior
    });
  })().catch((error) => res.status(500).json({ message: error.message }));
});

app.get("/api/valorion/company", authMiddleware, (req, res) => {
  valorionGet("https://app.valorion.com.br/api/s1/getCompany/")
    .then((data) => res.json(data))
    .catch((error) => res.status(500).json({ message: error.message }));
});

app.get("/api/valorion/transaction/:id", authMiddleware, (req, res) => {
  const id = req.params.id;
  valorionGet(`https://app.valorion.com.br/api/s1/getTransaction/api/getTransactionStatus.php?id_transaction=${encodeURIComponent(id)}`)
    .then((data) => res.json(data))
    .catch((error) => res.status(500).json({ message: error.message }));
});

app.post("/api/valorion/cashin", authMiddleware, (req, res) => {
  const { amount, customer } = req.body || {};
  if (!amount || !customer?.name || !customer?.email || !customer?.cpf) {
    return res.status(400).json({ message: "Dados obrigatorios do cliente" });
  }

  const localId = crypto.randomUUID();
  const externalReference = `cashin_${req.user.sub}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const payload = {
    amount: Number(amount),
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "9999999999",
      cpf: customer.cpf,
      externaRef: customer.externaRef || localId,
      address: {
        street: customer.address?.street || "Rua Generica",
        streetNumber: customer.address?.streetNumber || "123",
        complement: customer.address?.complement || "Complemento",
        zipCode: customer.address?.zipCode || "00000000",
        neighborhood: customer.address?.neighborhood || "Bairro",
        city: customer.address?.city || "Cidade",
        state: customer.address?.state || "SP",
        country: customer.address?.country || "br",
      },
    },
    pix: {
      expiresInDays: 1,
    },
    items: [
      {
        title: "Deposito",
        quantity: 1,
        unitPrice: Number(amount),
        tangible: false,
      },
    ],
    postbackUrl: valorionPostbackUrl,
    metadata: "cashin",
    traceable: true,
    ip: req.ip,
  };

  (async () => {
    const minDeposit = await getSettingNumber("min_deposit", 50);
    if (Number(amount) < minDeposit) {
      return res.status(400).json({ message: `Deposito minimo: ${minDeposit}` });
    }
    const apiKey = (await getSettingValue("gateway_api_key")) || valorionCashinApiKey;
    const data = await valorionCashin(payload, apiKey);
    const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const idTransaction = data?.idTransaction || data?.idtransaction || null;
    const responseReference = data?.externalreference || data?.client_id || externalReference;
    await dbPool.execute(
      "INSERT INTO transacoes_pix (usuario_id, tipo, status, valor_bruto, valor_liquido, id_transaction, external_reference, payment_code, payment_code_base64, id_local) " +
        "VALUES (?, 'CASH_IN', ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON DUPLICATE KEY UPDATE status = VALUES(status), valor_bruto = VALUES(valor_bruto), valor_liquido = VALUES(valor_liquido), payment_code = VALUES(payment_code), payment_code_base64 = VALUES(payment_code_base64), external_reference = VALUES(external_reference), id_local = VALUES(id_local)",
      [
        req.user.sub,
        "PENDENTE",
        Number(amount),
        Number(amount),
        idTransaction,
        responseReference,
        data?.paymentCode || null,
        data?.paymentCodeBase64 || null,
        localId,
      ]
    );
    return res.json({ ...data, expiresAt, localId, externalReference: responseReference });
  })().catch((error) => res.status(500).json({ message: error.message }));
});

app.post("/api/valorion/cashout", authMiddleware, (req, res) => {
  const { amount, pixKey, pixType, beneficiaryName, beneficiaryDocument } = req.body || {};
  if (!amount || !pixKey || !pixType || !beneficiaryName || !beneficiaryDocument) {
    return res.status(400).json({ message: "Dados obrigatorios do saque" });
  }

  (async () => {
    const minWithdraw = await getSettingNumber("min_withdraw", 50);
    if (Number(amount) < minWithdraw) {
      return res.status(400).json({ message: `Saque minimo: ${minWithdraw}` });
    }
    const apiKey = (await getSettingValue("gateway_api_key")) || valorionCashoutApiKey;
    const authData = await valorionCashoutAuth(apiKey);
    const token = authData?.access_token;
    if (!token) {
      throw new Error("Token de cashout invalido");
    }

    const payload = {
      amount: Number(amount),
      pixKey,
      pixType,
      beneficiaryName,
      beneficiaryDocument,
      postbackUrl: valorionWebhookUrl,
    };

    const data = await valorionCashoutCreate(token, payload, apiKey);
    await ensureSaldoRow(req.user.sub);
    await dbPool.execute(
      "INSERT INTO transacoes_pix (usuario_id, tipo, status, valor_bruto, valor_liquido, id_transaction, external_reference) " +
        "VALUES (?, 'CASH_OUT', ?, ?, ?, ?, ?)",
      [
        req.user.sub,
        "PENDENTE",
        Number(amount),
        Number(data?.valor_liquido || amount),
        data?.idTransaction || null,
        data?.externalreference || null,
      ]
    );
    await dbPool.execute(
      "UPDATE saldos SET saldo_disponivel = GREATEST(saldo_disponivel - ?, 0), saldo_bloqueado = saldo_bloqueado + ? WHERE usuario_id = ?",
      [Number(amount), Number(amount), req.user.sub]
    );
    return res.json(data);
  })().catch((error) => res.status(500).json({ message: error.message }));
});

app.post("/api/valorion/webhook", (req, res) => {
  const payload = req.body || {};
  const isCashin = !!payload.paymentcode || !!payload.paymentCode || !!payload.paymentCodeBase64;
  const idTransaction = payload.idtransaction || payload.idTransaction || null;
  const externalReference =
    payload.externalreference ||
    payload.externalReference ||
    payload.externaRef ||
    payload.externa_ref ||
    null;
  const rawStatus = payload.status || payload.status_transaction || "UNKNOWN";
  const status = mapPixStatus(rawStatus);
  const valorLiquido = Number(payload.deposito_liquido || payload.cash_out_liquido || payload.valor_liquido || payload.amount || 0);
  const userExternal = payload.user_id || null;

  (async () => {
    let rows = [];
    if (idTransaction) {
      const [byTx] = await dbPool.execute(
        "SELECT id, usuario_id, tipo, status FROM transacoes_pix WHERE id_transaction = ? LIMIT 1",
        [idTransaction]
      );
      rows = byTx;
    }
    if ((!rows || rows.length === 0) && externalReference) {
      const [byRef] = await dbPool.execute(
        "SELECT id, usuario_id, tipo, status FROM transacoes_pix WHERE external_reference = ? OR id_local = ? LIMIT 1",
        [externalReference, externalReference]
      );
      rows = byRef;
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Transacao nao encontrada" });
    }

    const tx = rows[0];
    await dbPool.execute(
      "UPDATE transacoes_pix SET status = ?, payment_code = COALESCE(payment_code, ?), payment_code_base64 = COALESCE(payment_code_base64, ?) WHERE id = ?",
      [status, payload.paymentcode || payload.paymentCode || null, payload.paymentCodeBase64 || null, tx.id]
    );

    if (isCashin && status === "APROVADO" && tx.status !== "APROVADO") {
      await ensureSaldoRow(tx.usuario_id);
      await dbPool.execute(
        "UPDATE saldos SET saldo_disponivel = saldo_disponivel + ? WHERE usuario_id = ?",
        [valorLiquido, tx.usuario_id]
      );
      await applyReferralCommission(tx.usuario_id, valorLiquido, tx.id);
    }

    if (!isCashin && status === "APROVADO" && tx.status !== "APROVADO") {
      await dbPool.execute(
        "UPDATE saldos SET saldo_bloqueado = GREATEST(saldo_bloqueado - ?, 0) WHERE usuario_id = ?",
        [valorLiquido, tx.usuario_id]
      );
    }

    return res.json({ status: "ok" });
  })().catch((error) => {
    console.error("Webhook error", error, userExternal);
    return res.status(500).json({ message: "Erro no webhook" });
  });
});

// Lucro/Prejuízo do usuário logado (últimos 30 dias)
app.get("/api/wallet/profit-loss", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Considera apenas os últimos 30 dias
    const [trades] = await dbPool.execute(
      `SELECT lucro, prejuizo FROM trades WHERE usuario_id = ? AND criado_em >= CURDATE() - INTERVAL 30 DAY`,
      [userId]
    );
    let totalLucro = 0;
    let totalPrejuizo = 0;
    for (const t of trades) {
      totalLucro += Number(t.lucro || 0);
      totalPrejuizo += Number(t.prejuizo || 0);
    }
    const resultado = totalLucro - totalPrejuizo;
    res.json({ lucro: resultado });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao calcular lucro/prejuízo', error: e.message });
  }
});

// Total investido pelo usuário (soma das compras)
app.get("/api/wallet/total-investido", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const [rows] = await dbPool.execute(
      `SELECT SUM(valor_total) as total FROM trades WHERE usuario_id = ?`,
      [userId]
    );
    const totalInvestido = rows && rows[0] ? Number(rows[0].total || 0) : 0;
    res.json({ totalInvestido });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao buscar total investido', error: e.message });
  }
});

// Total de transações do usuário (apenas compras)
app.get("/api/wallet/total-transacoes", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const [rows] = await dbPool.execute(
      `SELECT COUNT(*) as total FROM trades WHERE usuario_id = ?`,
      [userId]
    );
    const totalTransacoes = rows && rows[0] ? Number(rows[0].total || 0) : 0;
    res.json({ totalTransacoes });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao buscar total de transações', error: e.message });
  }
});

// Listar transações recentes do usuário logado (últimas 10)
app.get("/api/wallet/recent-trades", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const [rows] = await dbPool.execute(
      `SELECT id, crypto_symbol, quantidade, valor_total, lucro, prejuizo, criado_em FROM trades WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 30`,
      [userId]
    );
    // Buscar imagens e nomes das moedas
    const symbolToId = {
      btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', usdc: 'usd-coin', sol: 'solana', ada: 'cardano', xrp: 'ripple', doge: 'dogecoin', bnb: 'binancecoin', bch: 'bitcoin-cash', trx: 'tron', link: 'chainlink', xmr: 'monero', hype: 'hyperliquid', leo: 'leo-token', wbt: 'whitebit', figr_heloc: 'figure-heloc', usds: 'usds', usde: 'ethena-usde', cc: 'canton-network',
      // Adicione outros conforme necessário
    };
    const ids = rows
      .map((c) => symbolToId[c.crypto_symbol?.toLowerCase()] || symbolToId[c.crypto_symbol] || c.crypto_symbol?.toLowerCase())
      .filter(Boolean);
    let coingeckoData = [];
    if (ids.length > 0) {
      const idsParam = [...new Set(ids)].join(",");
      try {
        const requestId = createRequestId();
        const url = `${coingeckoBaseUrl}/coins/markets?vs_currency=brl&ids=${encodeURIComponent(idsParam)}`;
        const data = await cachedFetchJson(url, 2 * 60 * 1000, requestId);
        coingeckoData = Array.isArray(data) ? data : [];
      } catch (err) {
        coingeckoData = [];
      }
    }
    // Monta resposta com dados reais
    const trades = rows.map(t => {
      const id = symbolToId[t.crypto_symbol?.toLowerCase()] || symbolToId[t.crypto_symbol] || t.crypto_symbol?.toLowerCase();
      const symbol = String(t.crypto_symbol || "").toLowerCase();
      const cg = coingeckoData.find((x) => x.id === id || x.symbol === symbol);
      return {
        ...t,
        image: cg?.image || "/placeholder.svg",
        name: cg?.name || t.crypto_symbol || "Cripto"
      };
    });
    res.json({ trades });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao buscar transações recentes', error: e.message });
  }
});

// Endpoint para registrar uma compra
app.post("/api/wallet/buy", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { crypto_symbol, quantidade, preco_unitario } = req.body;
    if (!crypto_symbol || !quantidade || !preco_unitario) {
      return res.status(400).json({ message: "Dados obrigatórios ausentes" });
    }
    const valor_total = Number(quantidade) * Number(preco_unitario);
    const agora = new Date();
    // Busca sinal ativo para a moeda
    const [sinais] = await dbPool.execute(
      `SELECT id, lucro_percentual FROM sinais WHERE crypto_symbol = ? AND horario_inicio <= ? AND horario_fim >= ? LIMIT 1`,
      [crypto_symbol, agora, agora]
    );
    let sinal_id = null;
    let lucro = 0;
    let prejuizo = 0;
    if (sinais.length > 0) {
      sinal_id = sinais[0].id;
      lucro = valor_total * (Number(sinais[0].lucro_percentual) / 100);
    } else {
      prejuizo = valor_total * 0.10; // Exemplo: 10% de prejuízo fora do sinal
    }
    await dbPool.execute(
      `INSERT INTO trades (usuario_id, crypto_symbol, quantidade, preco_unitario, valor_total, sinal_id, lucro, prejuizo, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, crypto_symbol, quantidade, preco_unitario, valor_total, sinal_id, lucro, prejuizo]
    );
    res.json({ status: "ok", lucro, prejuizo });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao registrar compra', error: e.message });
  }
});

// Endpoint para retornar as 4 criptos que o usuário mais comprou e teve lucro
app.get("/api/wallet/top-cryptos", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Busca as criptos compradas pelo usuário (independente de venda/lucro)
    const [rows] = await dbPool.execute(
      `SELECT crypto_symbol,
              SUM(valor_total) AS total_comprado,
              SUM(lucro) AS total_lucro,
              SUM(prejuizo) AS total_prejuizo
       FROM trades
       WHERE usuario_id = ?
       GROUP BY crypto_symbol
       HAVING total_comprado > 0
       /* ALTERAÇÃO: Ordena pelo lucro real (lucro - prejuizo) desc, pega as 4 maiores */
       ORDER BY (SUM(lucro) - SUM(prejuizo)) DESC
       LIMIT 4`,
      [userId]
    );
    // Busca os ids das top criptos para CoinGecko
    const symbolToId = {
      btc: 'bitcoin',
      eth: 'ethereum',
      usdt: 'tether',
      usdc: 'usd-coin',
      sol: 'solana',
      ada: 'cardano',
      xrp: 'ripple',
      doge: 'dogecoin',
      bnb: 'binancecoin',
      bch: 'bitcoin-cash',
      trx: 'tron',
      link: 'chainlink',
      xmr: 'monero',
      hype: 'hyperliquid',
      leo: 'leo-token',
      wbt: 'whitebit',
      figr_heloc: 'figure-heloc',
      usds: 'usds',
      usde: 'ethena-usde',
      cc: 'canton-network',
      // Adicione outros conforme necessário
    };
    const ids = rows
      .map((c) => symbolToId[c.crypto_symbol?.toLowerCase()] || symbolToId[c.crypto_symbol] || c.crypto_symbol?.toLowerCase())
      .filter(Boolean);
    let coingeckoData = [];
    if (ids.length > 0) {
      const idsParam = [...new Set(ids)].join(",");
      try {
        const requestId = createRequestId();
        const url = `${coingeckoBaseUrl}/coins/markets?vs_currency=brl&ids=${encodeURIComponent(idsParam)}`;
        const data = await cachedFetchJson(url, 2 * 60 * 1000, requestId);
        coingeckoData = Array.isArray(data) ? data : [];
      } catch (err) {
        coingeckoData = [];
      }
    }
    // Monta resposta com dados reais
    const cryptos = rows.map(c => {
      // Tenta encontrar o id correto
      const id = symbolToId[c.crypto_symbol?.toLowerCase()] || symbolToId[c.crypto_symbol] || c.crypto_symbol?.toLowerCase();
      const symbol = String(c.crypto_symbol || "").toLowerCase();
      const cg = coingeckoData.find((x) => x.id === id || x.symbol === symbol);
      const image = cg?.image || "/placeholder.svg";
      const preco = typeof cg?.current_price === "number" ? cg.current_price : 0;
      const lucro = Number(c.total_lucro) || 0;
      const prejuizo = Number(c.total_prejuizo) || 0;
      return {
        symbol: c.crypto_symbol,
        name: cg?.name || c.crypto_symbol,
        current_price: preco,
        lucro: lucro,
        prejuizo: prejuizo,
        image: image
      };
    });
    res.json({ cryptos });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao buscar criptos do usuário', error: e.message });
  }
});

// Histórico de saldo do usuário para gráfico de evolução
app.get("/api/wallet/portfolio-history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Busca últimos 30 dias de saldo
    const [rows] = await dbPool.execute(
      `SELECT data_ref, saldo FROM saldos_historico WHERE usuario_id = ? ORDER BY data_ref ASC LIMIT 30`,
      [userId]
    );
    // Formata para frontend
    const history = rows.map(r => ({
      date: r.data_ref,
      value: Number(r.saldo)
    }));
    res.json({ history });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao buscar histórico do portfólio', error: e.message });
  }
});

// --- ENDPOINT DE COMPRA ---
app.post('/api/trade/buy', authMiddleware, async (req, res) => {
  function getLocalDateTimeString(date) {
    // Retorna YYYY-MM-DD HH:mm:ss no horário local do servidor
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  const usuario_id = req.user.sub;
  const { crypto_symbol } = req.body;
  if (!crypto_symbol) return res.status(400).json({ message: 'Cripto obrigatória' });
  // Saldo do usuário
  const [[saldoRow]] = await dbPool.execute('SELECT saldo_disponivel FROM saldos WHERE usuario_id = ?', [usuario_id]);
  const saldo = Number(saldoRow?.saldo_disponivel || 0);
  if (saldo <= 0) return res.status(400).json({ message: 'Saldo insuficiente' });
  // Trava: não permite comprar se já houver trade em processamento
  const [emProcessamento] = await dbPool.execute(
    'SELECT id FROM trades_processando WHERE usuario_id = ? AND status = ? LIMIT 1',
    [usuario_id, 'processando']
  );
  if (emProcessamento.length > 0) {
    return res.status(400).json({ message: 'Você já possui uma compra em processamento. Aguarde a finalização para negociar novamente.' });
  }
  // Valor de compra aleatório (6.3% a 10%)
  const perc = getRandomFloat(6.3, 10, 2);
  let valor_compra = Number((saldo * (perc / 100)).toFixed(2));
  if (valor_compra < 1) valor_compra = saldo; // Se saldo muito baixo, usa tudo
  if (valor_compra > saldo) valor_compra = saldo;
  // Busca sinal do dia usando horário local
  const agora = new Date();
  const agoraStr = getLocalDateTimeString(agora);
  const [sinais] = await dbPool.execute(
    'SELECT * FROM sinais WHERE crypto_symbol = ? AND horario_inicio <= ? AND horario_fim >= ? LIMIT 1',
    [crypto_symbol, agoraStr, agoraStr]
  );
  // Se dentro do sinal, verifica se já teve lucro neste sinal
  if (sinais.length) {
    const sinal = sinais[0];
    // Verifica se já existe trade com lucro para este usuário e sinal
    const [tradesLucro] = await dbPool.execute(
      'SELECT id FROM trades WHERE usuario_id = ? AND sinal_id = ? AND lucro > 0 LIMIT 1',
      [usuario_id, sinal.id]
    );
    if (tradesLucro.length > 0) {
      // Já teve lucro neste sinal, NÃO desconta saldo nem processa trade
      return res.status(400).json({ message: 'Você já obteve lucro neste sinal. Só poderá lucrar novamente no próximo sinal.' });
    }
    // Deduz saldo
    await dbPool.execute('UPDATE saldos SET saldo_disponivel = saldo_disponivel - ? WHERE usuario_id = ?', [valor_compra, usuario_id]);
    // Primeira compra lucrativa neste sinal
    const [proc] = await dbPool.execute(
      'INSERT INTO trades_processando (usuario_id, crypto_symbol, valor_compra, status, sinal_id) VALUES (?, ?, ?, ?, ?)',
      [usuario_id, crypto_symbol, valor_compra, 'processando', sinal.id]
    );
    // Agenda conclusão após 2 minutos
    setTimeout(async () => {
      // Atualiza status
      await dbPool.execute('UPDATE trades_processando SET status = ? WHERE id = ?', ['concluido', proc.insertId]);
      // Credita 2x valor_compra
      await dbPool.execute('UPDATE saldos SET saldo_disponivel = saldo_disponivel + ? WHERE usuario_id = ?', [valor_compra * 2, usuario_id]);
      // Registra trade com lucro
      await dbPool.execute(
        'INSERT INTO trades (usuario_id, crypto_symbol, quantidade, preco_unitario, valor_total, sinal_id, lucro, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [usuario_id, crypto_symbol, 1, valor_compra, valor_compra, sinal.id, valor_compra]
      );
    }, 2 * 60 * 1000);
    return res.json({ status: 'processando', valor_compra, lucro: valor_compra, message: 'Compra em processamento. Lucro será creditado em até 5 minutos.' });
  } else {
    // Fora do sinal: desconta saldo e registra trade com prejuízo
    await dbPool.execute('UPDATE saldos SET saldo_disponivel = saldo_disponivel - ? WHERE usuario_id = ?', [valor_compra, usuario_id]);
    await dbPool.execute(
      'INSERT INTO trades (usuario_id, crypto_symbol, quantidade, preco_unitario, valor_total, sinal_id, prejuizo, criado_em) VALUES (?, ?, ?, ?, ?, NULL, ?, NOW())',
      [usuario_id, crypto_symbol, 1, valor_compra, valor_compra, valor_compra]
    );
    return res.json({ status: 'perda', valor_compra, message: 'Compra fora do sinal. Valor descontado.' });
  }
});

// Endpoint para checar se há trade em processamento
app.get('/api/trade/processing', authMiddleware, async (req, res) => {
  const usuario_id = req.user.sub;
  const [rows] = await dbPool.execute(
    'SELECT id FROM trades_processando WHERE usuario_id = ? AND status = ? LIMIT 1',
    [usuario_id, 'processando']
  );
  res.json({ processing: rows.length > 0 });
});

// Endpoint para detalhes do trade em processamento
app.get('/api/trade/processing-detail', authMiddleware, async (req, res) => {
  const usuario_id = req.user.sub;
  const [rows] = await dbPool.execute(
    'SELECT crypto_symbol, created_at FROM trades_processando WHERE usuario_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
    [usuario_id, 'processando']
  );
  res.json({ processing: rows[0] || null });
});

// Endpoint para listar sinais ativos (vigentes ou futuros)
app.get('/api/sinais', async (req, res) => {
  const agora = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const agoraStr = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())} ${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}`;
  const [rows] = await dbPool.execute(
    'SELECT * FROM sinais WHERE horario_fim >= ? ORDER BY horario_inicio ASC',
    [agoraStr]
  );
  res.json(rows);
});

app.get("/api/wallet/compras", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Busca compras em processamento ou concluídas na tabela trades_processando
    const [rows] = await dbPool.execute(
      `SELECT id, crypto_symbol, valor_compra AS valor_total, status, criado_em
       FROM trades_processando
       WHERE usuario_id = ? AND (status = 'processando' OR status = 'concluido')
       ORDER BY criado_em DESC`,
      [userId]
    );
    // Adiciona nome e imagem se necessário (mock ou join com outra tabela se existir)
    const compras = rows.map(c => ({
      ...c,
      name: c.crypto_symbol, // Ajuste se tiver nome real
      image: "/placeholder.svg" // Ajuste se tiver imagem real
    }));
    res.json({ compras });
  } catch (e) {
    res.status(500).json({ message: 'Erro ao buscar compras', error: e.message });
  }
});

const webRoot = path.resolve(__dirname, "..");
app.use(express.static(webRoot));

app.get("*", (req, res) => {
  res.sendFile(path.join(webRoot, "index.html"));
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

setTimeout(() => {
  prewarmCoingeckoCache();
  setInterval(prewarmCoingeckoCache, 10 * 60 * 1000);
}, 5000);
