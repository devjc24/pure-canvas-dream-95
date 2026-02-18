const axios = require("axios");

async function proxyRequest({ baseUrl, path, query, timeoutMs }) {
  const url = `${baseUrl}${path}`;
  try {
    const response = await axios.get(url, {
      params: query,
      timeout: timeoutMs || 10000,
      headers: {
        Accept: "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 429) {
        throw { status: 429, message: "Rate limit excedido na CoinGecko. Tente novamente." };
      }
      throw {
        status: error.response.status || 502,
        message: error.response.data?.message || "Erro ao consultar CoinGecko",
      };
    }
    if (error.code === "ECONNABORTED") {
      throw { status: 503, message: "Timeout ao consultar CoinGecko" };
    }
    throw { status: 502, message: "Falha de rede ao consultar CoinGecko" };
  }
}

module.exports = { proxyRequest };
