export default async function handler(req, res) {
  const token = process.env.TG_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({
      ok: false,
      error: "Telegram configuration is missing on Vercel"
    });
  }

  try {
    const contentType = req.headers["content-type"] || "";

    // ---------- FILE UPLOAD ----------
    if (contentType.includes("multipart/form-data")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${token}/sendDocument`,
        {
          method: "POST",
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(body.length)
          },
          body
        }
      );

      const data = await telegramResponse.json();
      return res.status(telegramResponse.status).json(data);
    }

    const { method, file_id } = req.body || {};

    // ---------- DOWNLOAD FILE ----------
    if (method === "downloadFile") {
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${token}/getFile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id })
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

      return res.status(200).json({
        ok: true,
        content: await fileResponse.text()
      });
    }

    // ---------- OTHER TELEGRAM API CALLS ----------
    if (!method) {
      return res.status(400).json({
        ok: false,
        error: "Telegram method required"
      });
    }

    const params = { ...(req.body || {}) };
    delete params.method;

    // Always use server-side channel ID for document uploads.
    if (method === "sendDocument") {
      params.chat_id = chatId;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      }
    );

    return res.status(response.status).json(await response.json());

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
