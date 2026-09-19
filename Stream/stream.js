// hooks/streamStartHook.js
// hooks/streamStartHook.js
module.exports = function registerStreamStartHook(app, bot) {
  app.post("/hooks/stream-start", async (req, res) => {
    try {
      const secret = req.get("x-secret");
      if (secret !== process.env.STREAM_HOOK_SECRET) {
        return res.status(401).json({ ok: false });
      }

      const { twitchUrl, title } = req.body || {};
      if (!twitchUrl) {
        return res.status(400).json({ ok: false, error: "no twitchUrl" });
      }

      const text =
        `🔴 Стрим стартовал на Twitch!\n` +
        (title ? `🎮 ${title}\n` : "") +
        `${twitchUrl}`;

      await bot.sendMessage(process.env.TG_CHANNEL_ID, text, {
        disable_web_page_preview: false,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("stream-start error:", err);
      res.status(500).json({ ok: false });
    }
  });
};
