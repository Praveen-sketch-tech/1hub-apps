export default async function handler(req, res) {
  const { method, ...params } = req.body || {};

  if (!method) {
    return res.status(400).json({ ok: false, error: "Telegram method required" });
  }

  const token = process.env.TG_TOKEN;

  if (!token) {
    return res.status(500).json({ ok: false, error: "TG_TOKEN is not configured on Vercel" });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
