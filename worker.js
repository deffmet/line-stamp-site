// ★あなただけの秘密の閲覧パスワード（好きな半角英数字に変えてください）
const ADMIN_KEY = "dF20180223";
const FIREBASE_API_KEY = "AIzaSyBQsOsgY6DFzSNb0-3Wv14pqk6KlgcOvfc";
const FIREBASE_PROJECT_ID = "line-stamp-service-35bfe";

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
      await this.state.storage.put("inquiries", list.slice(0, 100));
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

    // 3. 会員情報の保存（POST /api/save-user）
    if (request.method === "POST" && url.pathname === "/api/save-user") {
      const data = await request.json();
      const users = (await this.state.storage.get("users")) || [];
      const filtered = users.filter((u) => u.uid !== data.uid);
      filtered.unshift({
        uid: data.uid,
        date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
        username: String(data.username || "").slice(0, 50),
        role: String(data.role || ""),
        email: String(data.email || "").slice(0, 100),
      });
      await this.state.storage.put("users", filtered.slice(0, 1000));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. 管理者用：会員一覧の取得（GET /api/users）
    if (request.method === "GET" && url.pathname === "/api/users") {
      if (url.searchParams.get("key") !== ADMIN_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }
      const users = (await this.state.storage.get("users")) || [];
      return new Response(JSON.stringify(users), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. リアルタイム閲覧人数（WebSocket）
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

    // ★会員登録・ログイン中継API（Cloudflareサーバー経由でFirebaseと通信）
    if (request.method === "POST" && url.pathname === "/api/auth") {
      try {
        const body = await request.json();
        const { mode, email, password, username, role } = body;

                      var authHost = "identitytoolkit." + "googleapis.com";
        var fsHost = "firestore." + "googleapis.com";

        var endpoint = mode === "register"
          ? "https://" + authHost + "/v1/accounts:signUp?key=" + FIREBASE_API_KEY
          : "https://" + authHost + "/v1/accounts:signInWithPassword?key=" + FIREBASE_API_KEY;

        const fbRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password, returnSecureToken: true }),
        });
        const fbData = await fbRes.json();

        if (!fbRes.ok) {
          return new Response(JSON.stringify({ ok: false, error: (fbData.error && fbData.error.message) || "AUTH_ERROR" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const uid = fbData.localId;
        const idToken = fbData.idToken;
        let finalUsername = username || email;
        let finalRole = role || "";

        if (mode === "register") {
          var fsUrl = "https://" + fsHost + "/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users?documentId=" + uid;
          await fetch(fsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
            body: JSON.stringify({
              fields: {
                username: { stringValue: finalUsername },
                role: { stringValue: finalRole },
                email: { stringValue: email },
                phoneVerified: { booleanValue: false },
              },
            }),
          });
          await stub.fetch(
            new Request("https://dummy/api/save-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uid: uid, username: finalUsername, role: finalRole, email: email }),
            })
          );
        } else {
          var docUrl = "https://" + fsHost + "/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users/" + uid;
          const docRes = await fetch(docUrl, {
            headers: { "Authorization": "Bearer " + idToken }
          });
          if (docRes.ok) {
            const docData = await docRes.json();
            if (docData.fields) {
              finalUsername = (docData.fields.username && docData.fields.username.stringValue) || email;
              finalRole = (docData.fields.role && docData.fields.role.stringValue) || "";
            }
          }
        }


        return new Response(
          JSON.stringify({ ok: true, user: { uid, email, username: finalUsername, role: finalRole } }),
          { headers: { "Content-Type": "application/json" } }
        );
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // WebSocketまたはデータAPIへのアクセス
    if (
      url.pathname === "/ws" ||
      url.pathname === "/api/contact" ||
      url.pathname === "/api/inquiries" ||
      url.pathname === "/api/save-user" ||
      url.pathname === "/api/users"
    ) {
      return stub.fetch(request);
    }

    // ★秘密の管理者ページ（お問い合わせ＋会員一覧も見られます）
    if (url.pathname === "/admin") {
      if (url.searchParams.get("key") !== ADMIN_KEY) {
        return new Response("アクセス権限がありません（パスワードが違います）", {
          status: 401,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      const list = await (await stub.fetch(new Request(`https://dummy/api/inquiries?key=${ADMIN_KEY}`))).json();
      const users = await (await stub.fetch(new Request(`https://dummy/api/users?key=${ADMIN_KEY}`))).json();

      const roleMap = { client: "依頼者", creator: "クリエイター", both: "両方" };
      const usersHtml =
        users.length === 0
          ? "<p>まだ登録会員はいません。</p>"
          : users
              .map(
                (u) => `
            <div style="background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:8px;">
              <div style="font-size:12px;color:#888;">登録日時：${u.date}</div>
              <div style="font-weight:bold;font-size:15px;">👤 ${u.username.replace(/</g, "&lt;")}（${roleMap[u.role] || "未設定"}）</div>
              <div style="font-size:13px;color:#555;">${u.email.replace(/</g, "&lt;")}</div>
            </div>`
              )
              .join("");

      const itemsHtml =
        list.length === 0
          ? "<p>まだお問い合わせはありません。</p>"
          : list
              .map(
                (item) => `
            <div style="background:#fff;border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:12px;">
              <div style="font-size:12px;color:#888;">${item.date}</div>
              <div style="font-weight:bold;font-size:16px;margin:4px 0;">${item.subject.replace(/</g, "&lt;")}</div>
              <div style="font-size:13px;color:#06c755;margin-bottom:8px;">宛名：${item.name.replace(/</g, "&lt;")}</div>
              <div style="white-space:pre-wrap;font-size:14px;background:#f9f9f9;padding:10px;border-radius:6px;">${item.message.replace(/</g, "&lt;")}</div>
            </div>`
              )
              .join("");

      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>運営管理画面</title></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:680px;margin:0 auto;"><h2>👥 登録会員一覧（${users.length}名）</h2>${usersHtml}<hr style="margin:30px 0;"><h2>📩 お問い合わせ受信BOX（最新100件）</h2>${itemsHtml}</body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
