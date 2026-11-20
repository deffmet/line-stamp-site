// ★あなただけの秘密の閲覧パスワード（好きな半角英数字に変えてください）
const ADMIN_KEY = "dF20180223";

export class OnlineCounter {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 1. お問い合わせデータの保存（POST /api/contact）
    if (request.method === "POST" && url.pathname === "/api/contact") {
      const data = await request.json();
      const list = (await this.state.storage.get("inquiries")) || [];
      list.unshift({
        id: Date.now(),
        date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
        name: String(data.name || "").slice(0, 100),
        subject: String(data.subject || "").slice(0, 100),
        message: String(data.message || "").slice(0, 2000),
      });
      await this.state.storage.put("inquiries", list.slice(0, 100)); // 最新100件を保存
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. 管理者用：お問い合わせ一覧の取得（GET /api/inquiries）
    if (request.method === "GET" && url.pathname === "/api/inquiries") {
      if (url.searchParams.get("key") !== ADMIN_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }
      const list = (await this.state.storage.get("inquiries")) || [];
      return new Response(JSON.stringify(list), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. リアルタイム閲覧人数（WebSocket）
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.sessions.add(server);
    this.broadcastCount();

    server.addEventListener("close", () => {
      this.sessions.delete(server);
      this.broadcastCount();
    });
    server.addEventListener("error", () => {
      this.sessions.delete(server);
      this.broadcastCount();
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcastCount() {
    const count = this.sessions.size;
    for (const session of this.sessions) {
      try {
        session.send(String(count));
      } catch (e) {
        this.sessions.delete(session);
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = env.ONLINE_COUNTER.idFromName("global-room");
    const stub = env.ONLINE_COUNTER.get(id);

    // WebSocketまたはお問い合わせAPIへのアクセス
    if (url.pathname === "/ws" || url.pathname === "/api/contact" || url.pathname === "/api/inquiries") {
      return stub.fetch(request);
    }

    // ★秘密の管理者ページ（https://あなたのURL/admin?key=パスワード）
    if (url.pathname === "/admin") {
      if (url.searchParams.get("key") !== ADMIN_KEY) {
        return new Response("アクセス権限がありません（パスワードが違います）", {
          status: 401,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      const list = (await (await stub.fetch(new Request(`https://dummy/api/inquiries?key=${ADMIN_KEY}`))).json());
      const itemsHtml = list.length === 0
        ? "<p>まだお問い合わせはありません。</p>"
        : list.map(item => `
            <div style="background:#fff;border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:12px;">
              <div style="font-size:12px;color:#888;">${item.date}</div>
              <div style="font-weight:bold;font-size:16px;margin:4px 0;">${item.subject.replace(/</g, "&lt;")}</div>
              <div style="font-size:13px;color:#06c755;margin-bottom:8px;">宛名：${item.name.replace(/</g, "&lt;")}</div>
              <div style="white-space:pre-wrap;font-size:14px;background:#f9f9f9;padding:10px;border-radius:6px;">${item.message.replace(/</g, "&lt;")}</div>
            </div>
          `).join("");

      return new Response(`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>お問い合わせ受信BOX</title></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:680px;margin:0 auto;"><h2>📩 お問い合わせ受信BOX（最新100件）</h2>${itemsHtml}</body></html>`, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
