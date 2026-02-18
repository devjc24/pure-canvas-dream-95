const express = require("express");
const { proxyRequest } = require("../utils/proxy");

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

function getCacheKey(path, query) {
  const params = new URLSearchParams(query || {});
  return `${path}?${params.toString()}`;
}

function getCacheTtl(path) {
  if (path.startsWith("/coins/markets")) return 60;
  if (path.startsWith("/simple/price")) return 60;
  return 0;
}

module.exports = function createCoingeckoRouter({ cache }) {
  const router = express.Router();

  // Rotas explicitas solicitadas
  router.get("/ping", async (req, res) => {
    return handleProxy(req, res, cache);
  });

  router.get("/coins/markets", async (req, res) => {
    return handleProxy(req, res, cache);
  });

  router.get("/coins/:id/market_chart", async (req, res) => {
    return handleProxy(req, res, cache);
  });

  router.get("/simple/price", async (req, res) => {
    return handleProxy(req, res, cache);
  });

  router.get("/coins/:id", async (req, res) => {
    return handleProxy(req, res, cache);
  });

  // Fallback para qualquer outra rota da CoinGecko
  router.get("/*", async (req, res) => {
    return handleProxy(req, res, cache);
  });

  async function handleProxy(req, res, cacheStore) {
    const path = req.path;
    const query = req.query || {};
    const ttl = getCacheTtl(path);
    const cacheKey = getCacheKey(path, query);

    if (ttl > 0 && cacheStore) {
      const cached = cacheStore.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    try {
      const data = await proxyRequest({
        baseUrl: COINGECKO_BASE_URL,
        path,
        query,
        timeoutMs: 10000,
      });

      if (ttl > 0 && cacheStore) {
        cacheStore.set(cacheKey, data, ttl);
      }

      return res.json(data);
    } catch (error) {
      const status = error?.status || 500;
      const message = error?.message || "Erro ao consultar CoinGecko";
      console.error("CoinGecko proxy error", {
        status,
        message,
        path,
        query,
      });
      return res.status(status).json({ message });
    }
  }

  return router;
};
