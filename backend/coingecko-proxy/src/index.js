require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const createCoingeckoRouter = require("./routes/coingecko");

const app = express();
const port = Number(process.env.PORT || 3010);
const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(",").map((item) => item.trim()),
  })
);

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

app.get("/health", (req, res) => {
  res.json({ status: "ok", coingecko_proxy: "running" });
});

app.use("/api/coingecko", createCoingeckoRouter({ cache }));

app.listen(port, () => {
  console.log(`CoinGecko proxy running on port ${port}`);
});

// npm install express cors axios dotenv express-rate-limit node-cache
// node src/index.js
