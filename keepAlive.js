// keepAlive.js
const express = require("express");

function keepAlive(registerRoutes) {
  const app = express();

  // 👇 нужно для POST JSON
  app.use(express.json({ limit: "1mb" }));

  const PORT = Number(process.env.PORT || 8080);

  app.get("/", (_req, res) => res.status(200).send("✅ Bot is alive"));
  app.get("/health", (_req, res) => res.send("ok"));

  // 👇 подключаем внешние роуты (если есть)
  if (typeof registerRoutes === "function") {
    registerRoutes(app);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ HTTP healthcheck listening on ${PORT} (0.0.0.0)`);
  });
}

module.exports = keepAlive;
