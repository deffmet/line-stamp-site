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

        // 4-1. 管理者用：会員データの削除（POST /api/delete-user）
    if (request.method === "POST" && url.pathname === "/api/delete-user") {
      const body = await request.json().catch(() => ({}));
      if (body.key !== ADMIN_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }
      const users = (await this.state.storage.get("users")) || [];
      const updated = users.filter((u) => u.uid !== body.uid);
      await this.state.storage.put("users", updated);
      return new Response(JSON.stringify({ ok: true }), {
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
       // 4-4. 会員と紐づくショート動画掲載データ（/api/short-ads）
       // 4-4. 会員と紐づくショート動画掲載データ（最大1000件・拒否理由・完全削除対応）
    if (url.pathname === "/api/short-ads") {
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        let list = (await this.state.storage.get("short_ads")) || [];

        if (body.action === "set_status") {
          if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
          const target = list.find((item) => String(item.id) === String(body.id));
          if (target) {
            target.status = body.status === "approved" ? "approved" : "rejected";
            target.rejectReason = target.status === "rejected" ? String(body.reason || "").slice(0, 200) : "";
            target.reviewedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
            await this.state.storage.put("short_ads", list);
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (body.action === "delete") {
          if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
          list = list.filter((item) => String(item.id) !== String(body.id));
          await this.state.storage.put("short_ads", list);
        
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

        if (!body.uid) return new Response(JSON.stringify({ ok: false, error: "ログインが必要です" }), { status: 401 });
        list.unshift({
          id: Date.now(),
          date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
          uid: String(body.uid),
          username: String(body.username || ""),
          email: String(body.email || ""),
          title: String(body.title || "").slice(0, 100),
          url: String(body.url || "").trim().slice(0, 300),
          limit: Number(body.limit || 1000),
          clicks: 0,
          status: "pending",
          rejectReason: "",
          mp4Info: String(body.mp4Info || ""),
        });
        await this.state.storage.put("short_ads", list.slice(0, 1000));
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }

      if (request.method === "GET") {
        const list = (await this.state.storage.get("short_ads")) || [];
        const uid = url.searchParams.get("uid");
        if (uid) {
          return new Response(JSON.stringify(list.filter((i) => i.uid === uid)), { headers: { "Content-Type": "application/json" } });
        }
        if (url.searchParams.get("key") !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
        return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } });
      }
    }

    // 4-5. 企画依頼アイデアの保存・取得・削除（/api/plan-requests）
    if (url.pathname === "/api/plan-requests") {
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        let list = (await this.state.storage.get("plan_requests")) || [];
        if (body.action === "delete") {
          if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
          list = list.filter((i) => String(i.id) !== String(body.id));
          await this.state.storage.put("plan_requests", list);
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }
        list.unshift({
          id: Date.now(),
          date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
          theme: String(body.theme || "").slice(0, 120),
          target: String(body.target || "").slice(0, 150),
          detail: String(body.detail || "").slice(0, 1500),
          sender: String(body.sender || "匿名").slice(0, 50),
        });
        await this.state.storage.put("plan_requests", list.slice(0, 300));
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
      if (request.method === "GET") {
        if (url.searchParams.get("key") !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
        const list = (await this.state.storage.get("plan_requests")) || [];
        return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } });
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

        // ★新規登録時のユーザー名重複チェック
        if (mode === "register") {
          const cleanName = String(username || "").trim();
          if (!cleanName) {
            return new Response(JSON.stringify({ ok: false, error: "ユーザー名を入力してください。" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const existingUsers = await (await stub.fetch(new Request(`https://dummy/api/users?key=${ADMIN_KEY}`))).json();
          const isDuplicate = existingUsers.some(
            (u) => u.username && u.username.toLowerCase() === cleanName.toLowerCase()
          );
          if (isDuplicate) {
            return new Response(JSON.stringify({ ok: false, error: "そのユーザー名はすでに使用されています。別の名前を入力してください。" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        
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
   url.pathname === "/api/delete-user" ||
   url.pathname === "/api/video-tap" ||
   url.pathname === "/api/short-ads" ||
   url.pathname === "/api/plan-requests"
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
            const shortAdsList = await (await stub.fetch(new Request(`https://dummy/api/short-ads?key=${ADMIN_KEY}`))).json();
      const pendingAds = shortAdsList.filter(a => (a.status || "pending") === "pending").reverse();
      const decidedAds = shortAdsList.filter(a => a.status === "approved" || a.status === "rejected").slice(0, 10);
      const displayAds = [...pendingAds, ...decidedAds];

      const shortAdsHtml = displayAds.length === 0
        ? "<p style='font-size:13px;color:#666;'>表示するショート動画申請はありません。</p>"
        : displayAds.map(ad => {
            const st = ad.status || "pending";
            const statusLabel = st === "approved"
              ? "<span style='color:#2e7d32;font-weight:bold;'>✅ 承諾済み</span>"
              : st === "rejected"
              ? "<span style='color:#c62828;font-weight:bold;'>❌ 不許可</span>"
              : "<span style='color:#e65100;font-weight:bold;'>⏳ 未決定（古い順優先）</span>";

            return `
              <div class="ad-req-card" data-status="${st}" data-search="${(ad.title + " " + ad.username).toLowerCase().replace(/"/g, "&quot;")}" style="background:#fff;border:2px solid ${st === "pending" ? "#e65100" : "#ffcc80"};border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:12px;color:#777;">申請：${ad.date}</span>
                  <span>${statusLabel}</span>
                </div>
                <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">🎬 ${ad.title.replace(/</g, "&lt;")}</div>
                <div style="font-size:12px;color:#444;margin-bottom:4px;">会員：${ad.username.replace(/</g, "&lt;")} ｜ 上限：${Number(ad.limit).toLocaleString()}回 ｜ ${ad.mp4Info || ""}</div>
                <div style="font-size:12px;margin-bottom:6px;word-break:break-all;"><a href="${ad.url.replace(/"/g, "&quot;")}" target="_blank" style="color:#e65100;">${ad.url.replace(/</g, "&lt;")}</a></div>
                ${st === "rejected" && ad.rejectReason ? `<div style="background:#ffebee;color:#c62828;font-size:12px;padding:6px 10px;border-radius:6px;margin-bottom:8px;">拒否理由：${ad.rejectReason.replace(/</g, "&lt;")}</div>` : ""}
                <div style="display:flex;gap:8px;margin-top:8px;">
                  <button type="button" onclick="reviewShortAd('${ad.id}', 'approved')" style="flex:1;background:#2e7d32;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">✅ 承諾</button>
                  <button type="button" onclick="reviewShortAd('${ad.id}', 'rejected')" style="flex:1;background:#c62828;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">❌ 不許可</button>
                  <button type="button" onclick="deleteShortAd('${ad.id}')" style="background:#424242;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">🗑️ 完全削除</button>
                </div>
              </div>
            `;
          }).join("");
            const latestNoticeHtml = `
        <div style="background:#fff3e0;border:2px solid #e65100;border-radius:12px;padding:16px;margin-bottom:24px;">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
            <h2 style="margin:0;color:#e65100;font-size:17px;">🔔 動画申請（未決定:${pendingAds.length}件 / 全${shortAdsList.length}件）</h2>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <select id="tagFilterSelect" onchange="filterAdCards()" style="padding:6px 8px;border-radius:6px;border:1px solid #ffcc80;font-size:12px;">
                <option value="all">すべて表示</option>
                <option value="pending">⏳ 未決定のみ</option>
                <option value="approved">✅ 承諾済み</option>
                <option value="rejected">❌ 不許可</option>
              </select>
              <input type="text" id="tagSearchInput" oninput="filterAdCards()" placeholder="タイトル・会員名で検索" style="padding:6px 8px;border-radius:6px;border:1px solid #ffcc80;font-size:12px;width:140px;">
            </div>
          </div>
          ${shortAdsHtml}
        </div>
        <script>
          function filterAdCards() {
            const tag = document.getElementById("tagFilterSelect").value;
            const kw = document.getElementById("tagSearchInput").value.toLowerCase().trim();
            document.querySelectorAll(".ad-req-card").forEach(card => {
              const matchTag = (tag === "all" || card.dataset.status === tag);
              const matchKw = (!kw || card.dataset.search.includes(kw));
              card.style.display = (matchTag && matchKw) ? "block" : "none";
            });
          }
          async function reviewShortAd(id, status) {
            let reason = "";
            if (status === "rejected") {
              reason = prompt("不許可（拒否）の理由を入力してください（会員画面に表示されます）：", "規約または動画基準を満たしていないため");
              if (reason === null) return;
            } else {
              if (!confirm("この申請を「承諾（掲載許可）」にしますか？")) return;
            }
            const res = await fetch("/api/short-ads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "set_status", key: "${ADMIN_KEY}", id: id, status: status, reason: reason })
            });
            if (res.ok) location.reload();
          }
          async function deleteShortAd(id) {
            if (!confirm("この申請ログをサーバーと会員画面から完全に抹消しますか？（元に戻せません）")) return;
            const res = await fetch("/api/short-ads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", key: "${ADMIN_KEY}", id: id })
            });
            if (res.ok) location.reload();
          }
        </script>
      `;



      
      const roleMap = { client: "依頼者", creator: "クリエイター", both: "両方" };
      const usersHtml =
        users.length === 0
          ? "<p>まだ登録会員はいません。</p>"
          : users
              .map(
                (u) => `
            <div style="background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
              <div>
                <div style="font-size:12px;color:#888;">登録日時：${u.date}</div>
                <div style="font-weight:bold;font-size:15px;">👤 ${u.username.replace(/</g, "&lt;")}（${roleMap[u.role] || "未設定"}）</div>
                <div style="font-size:13px;color:#555;">${u.email.replace(/</g, "&lt;")}</div>
              </div>
              <button type="button" onclick="deleteUser('${u.uid}', '${u.username.replace(/'/g, "\\'")}')" style="background:#d93025;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;white-space:nowrap;">🗑️ 削除</button>
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

          async function deleteUser(uid, name) {
            if (!confirm("会員「" + name + "」を一覧から削除しますか？（同じ名前で再登録できるようになります）")) return;
            const res = await fetch("/api/delete-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: "${ADMIN_KEY}", uid: uid })
            });
            if (res.ok) {
              alert("削除しました！");
              location.reload();
            }
          }
        </script>
      `;

            const planList = await (await stub.fetch(new Request(`https://dummy/api/plan-requests?key=${ADMIN_KEY}`))).json();
      const plansHtml = planList.length === 0
        ? "<p style='font-size:13px;color:#666;'>まだ企画依頼の応募はありません。</p>"
        : planList.map(p => `
            <div style="background:#fff;border:1px solid #ffcc80;border-radius:10px;padding:14px;margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#888;margin-bottom:4px;">
                <span>${p.date}（応募者：${p.sender.replace(/</g, "&lt;")}）</span>
                <button type="button" onclick="deletePlanReq('${p.id}')" style="background:#757575;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;">削除</button>
              </div>
              <div style="font-weight:bold;font-size:15px;color:#e65100;margin-bottom:4px;">① シチュエーション：${p.theme.replace(/</g, "&lt;")}</div>
              <div style="font-size:13px;font-weight:bold;margin-bottom:6px;">② 希望クリエイター・スタンプ：${p.target.replace(/</g, "&lt;")}</div>
              <div style="white-space:pre-wrap;font-size:13px;background:#fff8f0;padding:10px;border-radius:6px;">③ 詳細：${p.detail.replace(/</g, "&lt;")}</div>
            </div>
          `).join("") + `<script>async function deletePlanReq(id){if(!confirm("この企画アイデアを削除しますか？"))return;const r=await fetch("/api/plan-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete",key:"${ADMIN_KEY}",id:id})});if(r.ok)location.reload();}</script>`;


      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>運営管理画面</title><link rel="icon" href="/icon.png?v=5" type="image/png"></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:680px;margin:0 auto;">${latestNoticeHtml}${videoBoxHtml}<h2>👥 登録会員一覧（${users.length}名）</h2>${usersHtml}<hr style="margin:30px 0;"><hr style="margin:30px 0;"><h2>💡 企画依頼アイデアBOX（${planList.length}件）</h2>${plansHtml}<h2>📩 お問い合わせ受信BOX（最新100件）</h2>${itemsHtml}</body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );



    }
    // ★会員専用ページ（URL: /my_page_会員の名前）
    if (url.pathname.startsWith("/my_page_")) {
      const targetName = decodeURIComponent(url.pathname.replace("/my_page_", "")).trim();
      const users = await (await stub.fetch(new Request(`https://dummy/api/users?key=${ADMIN_KEY}`))).json();
      const member = users.find((u) => u.username === targetName);

      if (!member) {
        return new Response(
          `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ページが見つかりません</title><link rel="icon" href="/icon.png?v=3" type="image/png"></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#fff8f0;"><h2>404 - 会員ページが見つかりません</h2><p>指定されたユーザー「${targetName.replace(/</g, "&lt;")}」は存在しないか、まだ登録されていません。</p><a href="/" style="color:#e65100;font-weight:bold;">トップページへ戻る</a></body></html>`,
          { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }


      const roleMap = { client: "依頼者", creator: "クリエイター", both: "依頼者・クリエイター両方" };
      const safeName = member.username.replace(/</g, "&lt;");
      const safeRole = roleMap[member.role] || "会員";

      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName} さんの会員ページ | HookupStickers</title><link rel="icon" href="/icon.png?v=3" type="image/png"><style>body{font-family:sans-serif;background:#fff8f0;margin:0;padding:20px;color:#2b1d12}.wrap{max-width:720px;margin:0 auto}.card{background:#fff;border:1px solid #ffe0b2;border-radius:16px;padding:28px;box-shadow:0 4px 14px rgba(230,81,0,0.08);margin-bottom:20px}.badge{display:inline-block;background:#fff3e0;color:#e65100;border:1px solid #ffcc80;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;margin-bottom:8px}.title{font-size:24px;font-weight:bold;margin:0 0 8px}.url-box{background:#fff8f0;border:1px solid #ffe0b2;padding:10px 14px;border-radius:8px;font-size:12px;color:#5d4037;word-break:break-all;margin-top:12px}.gallery-empty{border:2px dashed #ffcc80;border-radius:12px;padding:40px 20px;text-align:center;color:#8d6e63;font-size:14px}.nav-links{display:flex;gap:12px;justify-content:center;margin-top:20px}.btn{display:inline-block;padding:10px 20px;border-radius:20px;text-decoration:none;font-weight:bold;font-size:14px;background:#e65100;color:#fff}.btn-sub{background:#3e2723}</style></head><body><div class="wrap"><div class="card"><span class="badge">${safeRole}</span><h1 class="title">👤 ${safeName} さんのマイページ</h1><p style="font-size:14px;color:#795548;margin:0;">登録日：${member.date || "登録済み"}</p><div class="url-box">専用URL：${url.origin}/my_page_${encodeURIComponent(member.username)}</div></div><div class="card"><h2 style="font-size:18px;margin-top:0;">🎨 投稿スタンプイラスト（240×240px）</h2><div class="gallery-empty">投稿イラスト機能は現在準備中です。<br>今後のアップデートでこちらに240×240pxのスタンプ作品が並びます！</div></div><div class="nav-links"><a href="/" class="btn">トップページへ</a><a href="/login.html" class="btn btn-sub">会員設定・区分変更</a></div></div></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // ★リアルタイムユーザー名重複チェックAPI
    if (url.pathname === "/api/check-username") {
      const name = (url.searchParams.get("name") || "").trim();
      if (!name) {
        return new Response(JSON.stringify({ available: false }), { headers: { "Content-Type": "application/json" } });
      }
      const existingUsers = await (await stub.fetch(new Request(`https://dummy/api/users?key=${ADMIN_KEY}`))).json();
      const isDuplicate = existingUsers.some(
        (u) => u.username && u.username.toLowerCase() === name.toLowerCase()
      );
      return new Response(JSON.stringify({ available: !isDuplicate }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/favicon.ico") {
      return Response.redirect(`${url.origin}/icon.png`, 302);
    }

    return env.ASSETS.fetch(request);
  },
};



