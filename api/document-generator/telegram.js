export default async function handler(req, res) {
  const { method, ...params } = req.body || {};
  const token = process.env.TG_TOKEN;

  if (!token) {
    return res.status(500).json({
      ok: false,
      error: "TG_TOKEN is not configured on Vercel"
    });
  }

  try {
    if (method === "downloadFile") {
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${token}/getFile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: params.file_id })
        }
      );

      const info = await infoResponse.json();

      if (!info.ok) {
        return res.status(400).json(info);
      }

      const fileResponse = await fetch(
        `https://api.telegram.org/file/bot${token}/${info.result.file_path}`
      );

      if (!fileResponse.ok) {
        return res.status(500).json({
          ok: false,
          error: "Telegram file download failed"
        });
      }

      const content = await fileResponse.text();

      return res.status(200).json({
        ok: true,
        content
      });
    }

    if (!method) {
      return res.status(400).json({
        ok: false,
        error: "Telegram method required"
      });
    }

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
