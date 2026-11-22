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
        return new Response(
          JSON.stringify({ ok: true, user: { uid, email, username: finalUsername, role: finalRole, idToken: idToken, refreshToken: fbData.refreshToken } }),
          { headers: { "Content-Type": "application/json" } }
        );


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

    // 4-2. レート制限チェック（POST /api/rate-limit）
    if (request.method === "POST" && url.pathname === "/api/rate-limit") {
      const { ip } = await request.json();
      const now = Date.now();
      const key = "rate_" + ip;
      const record = (await this.state.storage.get(key)) || { count: 0, resetAt: now + 60000 };
      if (now > record.resetAt) {
        record.count = 1;
        record.resetAt = now + 60000;
      } else {
        record.count += 1;
      }
      await this.state.storage.put(key, record);
      if (record.count > 5) {
        return new Response("Too Many Requests", { status: 429 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // 4-3. 最新ショート動画のタップ数カウント・取得・リセット（/api/video-tap）
    if (url.pathname === "/api/video-tap") {
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (body.action === "reset") {
          if (body.key !== ADMIN_KEY) {
            return new Response("Unauthorized", { status: 401 });
          }
          const resetDate = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
          await this.state.storage.put("video_taps", { count: 0, resetAt: resetDate });
          return new Response(JSON.stringify({ ok: true, count: 0, resetAt: resetDate }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        const current = (await this.state.storage.get("video_taps")) || { count: 0, resetAt: "初期状態" };
        current.count = (current.count || 0) + 1;
        await this.state.storage.put("video_taps", current);
        return new Response(JSON.stringify({ ok: true, count: current.count }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (request.method === "GET") {
        if (url.searchParams.get("key") !== ADMIN_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const current = (await this.state.storage.get("video_taps")) || { count: 0, resetAt: "初期状態" };
        return new Response(JSON.stringify(current), {
          headers: { "Content-Type": "application/json" },
        });
      }
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

       // ★会員登録・ログイン中継API（3重AIボット・攻撃防御付き）
    if (request.method === "POST" && url.pathname === "/api/auth") {
      try {
        const body = await request.json();
        const { mode, email, password, username, role, trap, cfToken } = body;

        // 防御1：ハニーポット（隠し罠に文字が入っていたらAIボットとして即遮断）
        if (trap && String(trap).trim() !== "") {
          return new Response(JSON.stringify({ ok: false, error: "不正なアクセスを検知しました。" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 防御2：Cloudflare Turnstile（人間認証の検証）
        const turnstileSecret = "0x4AAAAAAGMV94hg0Hke00tUwk62-bxjvEQ";
        if (cfToken) {
          var tsHost = "challenges." + "cloudflare.com";
          const tsRes = await fetch("https://" + tsHost + "/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "secret=" + encodeURIComponent(turnstileSecret) + "&response=" + encodeURIComponent(cfToken),
          });
          const tsData = await tsRes.json();
          if (!tsData.success) {
            return new Response(JSON.stringify({ ok: false, error: "人間認証に失敗しました。ページを再読み込みしてお試しください。" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // 防御3：レート制限（同じIPからの連続攻撃を1分間に5回までに制限）
        const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
        const rateRes = await stub.fetch(
          new Request("https://dummy/api/rate-limit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ip: clientIp }),
          })
        );
        if (!rateRes.ok) {
          return new Response(JSON.stringify({ ok: false, error: "短時間に試行回数が多すぎます。1分ほど待ってから再度お試しください。" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }

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
    // ★ログイン本人による利用区分の変更API（POST /api/update-role）
       // ★ログイン本人による利用区分の変更API（自動トークン更新対応・再ログイン不要）
    if (request.method === "POST" && url.pathname === "/api/update-role") {
      try {
        const body = await request.json();
        const { uid, email, username, role, idToken, refreshToken } = body;

        if (!uid || !["client", "creator", "both"].includes(role)) {
          return new Response(JSON.stringify({ ok: false, error: "不正なリクエストです" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let activeToken = idToken;

        // refreshTokenがあれば最新のidTokenを裏側で自動取得（期限切れ防止）
        if (refreshToken) {
          var tokenHost = "securetoken." + "googleapis.com";
          const refRes = await fetch("https://" + tokenHost + "/v1/token?key=" + FIREBASE_API_KEY, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken),
          });
          if (refRes.ok) {
            const refData = await refRes.json();
            activeToken = refData.id_token || activeToken;
          }
        }

        // Firebase（Firestore）のデータを更新
        if (activeToken) {
          var fsHost = "firestore." + "googleapis.com";
          var fsUrl = "https://" + fsHost + "/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/users/" + uid + "?updateMask.fieldPaths=role";
          await fetch(fsUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + activeToken },
            body: JSON.stringify({
              fields: {
                role: { stringValue: role }
              }
            }),
          });
        }

        // 運営管理画面（/admin）側の会員リストも最新区分に即時更新
        await stub.fetch(
          new Request("https://dummy/api/save-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: uid, username: username, role: role, email: email }),
          })
        );

        return new Response(JSON.stringify({ ok: true, idToken: activeToken }), {
          headers: { "Content-Type": "application/json" },
        });
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
      url.pathname === "/api/users" ||
      url.pathname === "/api/video-tap"
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

      const videoTapData = await (await stub.fetch(new Request(`https://dummy/api/video-tap?key=${ADMIN_KEY}`))).json();

      
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

      const videoBoxHtml = `
        <div style="background:#fff0f0;border:2px solid #ffcccc;border-radius:12px;padding:16px;margin-bottom:24px;">
          <h3 style="margin:0 0 8px;color:#d93025;">▶ 最新ショート動画のタップ回数</h3>
          <div style="font-size:28px;font-weight:bold;color:#0f0f0f;margin-bottom:4px;"><span id="video-tap-count">${videoTapData.count || 0}</span> タップ</div>
          <div style="font-size:12px;color:#666;margin-bottom:12px;">最終リセット日時：<span id="video-tap-reset">${videoTapData.resetAt || "初期状態"}</span></div>
          <button type="button" onclick="resetVideoTaps()" style="background:#d93025;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;">🔄 タップ回数を0にリセットする</button>
        </div>
        <script>
          async function resetVideoTaps() {
            if (!confirm("最新ショート動画のタップ回数を0にリセットしますか？")) return;
            const res = await fetch("/api/video-tap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "reset", key: "${ADMIN_KEY}" })
            });
            if (res.ok) {
              const d = await res.json();
              document.getElementById("video-tap-count").textContent = d.count;
              document.getElementById("video-tap-reset").textContent = d.resetAt;
              alert("タップ回数を0にリセットしました！");
            }
          }
        </script>
      `;

      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>運営管理画面</title></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:680px;margin:0 auto;">${videoBoxHtml}<h2>👥 登録会員一覧（${users.length}名）</h2>${usersHtml}<hr style="margin:30px 0;"><h2>📩 お問い合わせ受信BOX（最新100件）</h2>${itemsHtml}</body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );

    }

    return env.ASSETS.fetch(request);
  },
};
