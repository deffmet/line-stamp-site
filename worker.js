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
    // 4-4. ショート動画掲載データ・キュー自動切り替え・クリック計測API
    if (url.pathname === "/api/short-ads") {
      // アクティブ掲載枠の期限（7日間）＆クリック上限チェック＆自動バトンタッチ関数
      const syncShortAdQueue = async () => {
        let list = (await this.state.storage.get("short_ads")) || [];
        const now = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        let changed = false;

        // 1. 現在掲載中（approved）の期限切れ・上限到達チェック
        let activeAd = list.find((item) => item.status === "approved");
        if (activeAd) {
          const startedAt = Number(activeAd.startedAt || now);
          if (!activeAd.startedAt) {
            activeAd.startedAt = now;
            changed = true;
          }
          const isExpired = (now - startedAt) >= SEVEN_DAYS_MS;
          const isMaxed = Number(activeAd.clicks || 0) >= Number(activeAd.limit || 1000);
          if (isExpired || isMaxed) {
            activeAd.status = "completed";
            activeAd.endedReason = isMaxed ? "クリック上限到達" : "掲載期間（7日間）満了";
            activeAd.endedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
            activeAd = null;
            changed = true;
          }
        }

        // 2. 掲載中が空なら、決済済み予約（queued）の中から一番古いものを自動昇格
        if (!activeAd) {
          const queuedAds = list
            .filter((item) => item.status === "queued")
            .sort((a, b) => Number(a.paidAt || a.id) - Number(b.paidAt || b.id));
          if (queuedAds.length > 0) {
            const nextAd = queuedAds[0];
            nextAd.status = "approved";
            nextAd.clicks = 0;
            nextAd.startedAt = now;
            nextAd.startedDate = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
            activeAd = nextAd;
            changed = true;
          }
        }

        if (changed) {
          await this.state.storage.put("short_ads", list);
        }
        return { list, activeAd };
      };

      if (request.method === "GET") {
        const { list, activeAd } = await syncShortAdQueue();
        const mode = url.searchParams.get("mode");
        const uid = url.searchParams.get("uid");

        // トップページ表示用（現在掲載中の1件、なければ null で short1.mp4 へ戻る）
            // MP4動画ストリーミング配信（/api/short-ads?mode=video&id=〇〇）
        if (mode === "video") {
          const vidId = url.searchParams.get("id");
          const chunkCount = Number((await this.state.storage.get("short_ad_chunks_" + vidId)) || 0);
          let fullDataUrl = "";
          if (chunkCount > 0) {
            const parts = await Promise.all(
              Array.from({ length: chunkCount }, (_, i) => this.state.storage.get(`short_ad_vid_${vidId}_${i}`))
            );
            fullDataUrl = parts.join("");
          } else {
            fullDataUrl = (await this.state.storage.get("short_ad_video_" + vidId)) || "";
          }
          if (!fullDataUrl.startsWith("data:video/mp4")) {
            return new Response("Not Found", { status: 404 });
          }
          const b64 = fullDataUrl.split(",")[1] || "";
          const binStr = atob(b64);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          return new Response(bytes, {
            headers: { "Content-Type": "video/mp4", "Cache-Control": "public, max-age=3600" },
          });
        }

        // トップページ表示用（現在掲載中の1件、なければ null で short1.mp4 へ戻る）
        if (mode === "active") {
          if (!activeAd) return new Response(JSON.stringify(null), { headers: { "Content-Type": "application/json" } });
          return new Response(JSON.stringify({
            ...activeAd,
            videoData: "/api/short-ads?mode=video&id=" + activeAd.id
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }


        if (uid) {
          const myAds = list.filter((item) => item.uid === uid);
          return new Response(JSON.stringify(myAds), { headers: { "Content-Type": "application/json" } });
        }
        if (url.searchParams.get("key") !== ADMIN_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } });
      }

      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        let list = (await this.state.storage.get("short_ads")) || [];

        // 1クリック（0.1円）カウント（1端末1日1回ボット対策付き）
        if (body.action === "click") {
          const targetId = String(body.id || "");
          const deviceId = String(body.deviceId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
          if (!targetId || !deviceId || deviceId.length < 8) {
            return new Response(JSON.stringify({ ok: false }), { status: 400 });
          }
          const todayJst = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
          const clickKey = "adclk_" + targetId + "_" + deviceId + "_" + todayJst;
          const alreadyClicked = await this.state.storage.get(clickKey);
          const target = list.find((item) => String(item.id) === targetId && item.status === "approved");
          if (target && !alreadyClicked) {
            target.clicks = Number(target.clicks || 0) + 1;
            await this.state.storage.put(clickKey, 1);
            await this.state.storage.put("short_ads", list);
          }
          await syncShortAdQueue();
          return new Response(JSON.stringify({ ok: true, clicks: target ? target.clicks : 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // ステータス更新（承諾・決済完了・テスト決済完了・不許可）
        if (body.action === "set_status") {
          if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
          const target = list.find((item) => String(item.id) === String(body.id));
          if (target) {
            if (body.status === "paid" || body.status === "approved") {
              target.status = "queued";
              target.paidAt = Date.now();
              target.clicks = 0;
              target.rejectReason = "";
            } else if (body.status === "payment_pending") {
              target.status = "payment_pending";
              if (body.stripeUrl !== undefined) {
                target.stripeUrl = String(body.stripeUrl || "").trim().slice(0, 300);
              }
            } else {
              target.status = "rejected";
              target.rejectReason = String(body.reason || "").slice(0, 200);
            }
            target.reviewedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
            await this.state.storage.put("short_ads", list);
            await syncShortAdQueue();
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }

        // 申請削除（動画データも同時削除）
        if (body.action === "delete") {
          if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
          const delId = String(body.id);
          list = list.filter((item) => String(item.id) !== delId);
          await this.state.storage.delete("short_ad_video_" + delId);
          const cCount = Number((await this.state.storage.get("short_ad_chunks_" + delId)) || 0);
          for (let i = 0; i < cCount; i++) {
            await this.state.storage.delete(`short_ad_vid_${delId}_${i}`);
          }
          await this.state.storage.delete("short_ad_chunks_" + delId);
          await this.state.storage.put("short_ads", list);
          await syncShortAdQueue();
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }

        // 新規申し込み（最大25MB・720×1280px MP4動画をチャンク分割保存）
        if (!body.uid || !body.title || !body.url) {
          return new Response(JSON.stringify({ ok: false, error: "必須項目が不足しています" }), { status: 400 });
        }
        const videoBase64 = String(body.videoData || "");
        if (!videoBase64.startsWith("data:video/mp4") || videoBase64.length > 36000000) {
          return new Response(JSON.stringify({ ok: false, error: "MP4動画は25MB以内の720×1280pxファイルのみ対応しています" }), { status: 400 });
        }

        const newId = Date.now();
        const CHUNK_SIZE = 900000;
        const totalChunks = Math.ceil(videoBase64.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          await this.state.storage.put(`short_ad_vid_${newId}_${i}`, videoBase64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
        }
        await this.state.storage.put("short_ad_chunks_" + newId, totalChunks);

        const newItem = {
          id: newId,
          date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
          uid: String(body.uid),
          username: String(body.username || ""),
          email: String(body.email || ""),
          title: String(body.title).slice(0, 60),
          limit: Number(body.limit || 1000),
          url: String(body.url).slice(0, 300),
          mp4Info: String(body.mp4Info || "720×1280px MP4"),
          status: "pending",
          rejectReason: "",
          clicks: 0,
        };
        list.unshift(newItem);
        await this.state.storage.put("short_ads", list.slice(0, 300));
        return new Response(JSON.stringify({ ok: true, item: newItem }), { headers: { "Content-Type": "application/json" } });
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
         // 4-6. 会員イラスト投稿・編集・削除・検索・乱数キャッシュAPI（完全軽量インデックス＆個別キー分散保存）
    // 4-6. 会員イラスト投稿・編集・削除・検索・乱数キャッシュAPI
    if (
      url.pathname === "/api/illusts" ||
      url.pathname === "/api/illusts/recent" ||
      url.pathname === "/api/illusts/interact"
    ) {
      const now = Date.now();
      const validImg = (s) => String(s).startsWith("data:image/") || String(s) === "/Non_file.jpg";

      // メタ配列から必要な件数だけメイン画像を並列復元するヘルパー
      const attachMainImages = async (metaList, limitCount) => {
        const sliced = metaList.slice(0, limitCount);
        const items = await Promise.all(
          sliced.map(async (m) => {
            const full = await this.state.storage.get("illust_item_" + m.id);
            return full ? { ...m, mainImage: full.mainImage } : null;
          })
        );
        return items.filter(Boolean);
      };
      // ★閲覧数（1端末1日1回）＆いいね（手動トグル式・取り消し対応）API
      if (url.pathname === "/api/illusts/interact" && request.method === "POST") {
        try {
          const body = await request.json();
          const targetId = String(body.id || "");
          const action = String(body.action || "");
          const deviceId = String(body.deviceId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

          if (!targetId || !deviceId || deviceId.length < 8) {
            return new Response(JSON.stringify({ ok: false, error: "不正なリクエストです" }), { status: 400 });
          }

          const fullItem = await this.state.storage.get("illust_item_" + targetId);
          if (!fullItem) {
            return new Response(JSON.stringify({ ok: false, error: "作品が見つかりません" }), { status: 404 });
          }

          fullItem.views = Number(fullItem.views || 0);
          fullItem.likes = Number(fullItem.likes || 0);

          if (action === "view") {
            const todayJst = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
            const viewKey = "v_" + targetId + "_" + deviceId + "_" + todayJst;
            const alreadyViewed = await this.state.storage.get(viewKey);
            if (!alreadyViewed) {
              fullItem.views += 1;
              await this.state.storage.put(viewKey, 1);
              await this.state.storage.put("illust_item_" + targetId, fullItem);
            }
            const likeKey = "l_" + targetId + "_" + deviceId;
            const liked = Boolean(await this.state.storage.get(likeKey));
            return new Response(JSON.stringify({ ok: true, views: fullItem.views, likes: fullItem.likes, liked: liked }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          if (action === "like") {
            const likeKey = "l_" + targetId + "_" + deviceId;
            const alreadyLiked = await this.state.storage.get(likeKey);
            let liked = false;
            if (alreadyLiked) {
              fullItem.likes = Math.max(0, fullItem.likes - 1);
              await this.state.storage.delete(likeKey);
              liked = false;
            } else {
              fullItem.likes += 1;
              await this.state.storage.put(likeKey, 1);
              liked = true;
            }
            await this.state.storage.put("illust_item_" + targetId, fullItem);
            return new Response(JSON.stringify({ ok: true, views: fullItem.views, likes: fullItem.likes, liked: liked }), {
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ ok: false }), { status: 400 });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
        }
      }

      // A. トップページ新着用（30分 or 60分の50%サイコロ乱数キャッシュ）
      if (url.pathname === "/api/illusts/recent" && request.method === "GET") {
        let cache = await this.state.storage.get("recent_illust_cache");
        if (!cache || now >= cache.nextUpdateAt) {
          const indexList = (await this.state.storage.get("illust_index")) || [];
          const withImgs = await attachMainImages(indexList, 5);
          const intervalMs = Math.random() < 0.5 ? 30 * 60 * 1000 : 60 * 60 * 1000;
          cache = { items: withImgs, updatedAt: now, nextUpdateAt: now + intervalMs };
          await this.state.storage.put("recent_illust_cache", cache);
        }
        return new Response(JSON.stringify(cache), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      }

      // B. 一覧・検索・詳細・会員別取得（GET）
      if (request.method === "GET") {
        const id = url.searchParams.get("id");
        if (id) {
          const item = await this.state.storage.get("illust_item_" + id);
          return new Response(JSON.stringify(item || null), {
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
          });
        }

        const indexList = (await this.state.storage.get("illust_index")) || [];
        const author = url.searchParams.get("author");
        if (author) {
          const filteredAuthor = indexList.filter((i) => i.username === author);
          const withImgs = await attachMainImages(filteredAuthor, 50);
          return new Response(JSON.stringify(withImgs), { headers: { "Content-Type": "application/json" } });
        }

        const q = (url.searchParams.get("q") || "").slice(0, 60).toLowerCase().trim();
        const tag = (url.searchParams.get("tag") || "").slice(0, 40).replace(/^#/, "").toLowerCase().trim();
        const sort = url.searchParams.get("sort") || "newest";

        let filtered = indexList.filter((item) => {
          const matchQ = !q ||
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.username && item.username.toLowerCase().includes(q)) ||
            (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)));
          const matchTag = !tag || (item.tags && item.tags.some((t) => t.toLowerCase() === tag));
          return matchQ && matchTag;
        });

        if (sort === "oldest") filtered = filtered.slice().reverse();
        const withImgs = await attachMainImages(filtered, 60);
        return new Response(JSON.stringify(withImgs), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
        });
      }

      // C. 新規投稿・本人編集・削除（POST）
      if (request.method === "POST") {
        try {
          const body = await request.json();
          if (body.trap && String(body.trap).trim() !== "") {
            return new Response(JSON.stringify({ ok: false, error: "不正アクセスを検知しました" }), { status: 403 });
          }

          let indexList = (await this.state.storage.get("illust_index")) || [];

          if (body.action === "admin_delete") {
            if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
            indexList = indexList.filter((i) => String(i.id) !== String(body.id));
            await this.state.storage.put("illust_index", indexList);
            await this.state.storage.delete("illust_item_" + body.id);
            await this.state.storage.delete("recent_illust_cache");
            return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
          }

          if (body.action === "user_delete") {
            const target = indexList.find((i) => String(i.id) === String(body.id));
            if (!target || target.uid !== String(body.uid)) {
              return new Response(JSON.stringify({ ok: false, error: "削除権限がありません" }), { status: 403 });
            }
            indexList = indexList.filter((i) => String(i.id) !== String(body.id));
            await this.state.storage.put("illust_index", indexList);
            await this.state.storage.delete("illust_item_" + body.id);
            await this.state.storage.delete("recent_illust_cache");
            return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
          }

          const uid = String(body.uid || "");
          if (!uid) return new Response(JSON.stringify({ ok: false, error: "ログインが必要です" }), { status: 401 });

          const cleanTitle = String(body.title || "").trim().slice(0, 60);
          const cleanDesc = String(body.description || "").trim().slice(0, 1000);
          const rawTags = Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(/[\s,、#＃]+/);
          const cleanTags = [...new Set(rawTags.map((t) => String(t).replace(/^[#＃]+/, "").trim().slice(0, 25)).filter(Boolean))].slice(0, 10);

          if (body.action === "edit") {
            const fullItem = await this.state.storage.get("illust_item_" + body.id);
            if (!fullItem || fullItem.uid !== uid) {
              return new Response(JSON.stringify({ ok: false, error: "編集権限がありません" }), { status: 403 });
            }
            if (!cleanTitle) return new Response(JSON.stringify({ ok: false, error: "タイトルは必須です" }), { status: 400 });
            fullItem.title = cleanTitle;
            fullItem.description = cleanDesc;
            fullItem.tags = cleanTags;
            if (body.mainImage && String(body.mainImage).startsWith("data:image/")) {
              fullItem.mainImage = String(body.mainImage);
            }
            if (Array.isArray(body.subImages)) {
              fullItem.subImages = body.subImages.filter(validImg).slice(0, 3);
            }
            await this.state.storage.put("illust_item_" + body.id, fullItem);

            const idxItem = indexList.find((i) => String(i.id) === String(body.id));
            if (idxItem) {
              idxItem.title = cleanTitle;
              idxItem.tags = cleanTags;
              await this.state.storage.put("illust_index", indexList);
            }
            await this.state.storage.delete("recent_illust_cache");
            return new Response(JSON.stringify({ ok: true, id: fullItem.id }), { headers: { "Content-Type": "application/json" } });
          }

          if (!cleanTitle || !body.mainImage || !String(body.mainImage).startsWith("data:image/")) {
            return new Response(JSON.stringify({ ok: false, error: "タイトルとメイン画像は必須です" }), { status: 400 });
          }

          const newId = now;
          const safeSubs = Array.isArray(body.subImages)
            ? body.subImages.filter(validImg).slice(0, 3)
            : ["/Non_file.jpg", "/Non_file.jpg", "/Non_file.jpg"];

          const itemObj = {
            id: newId,
            date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
            uid: uid,
            username: String(body.username || "").slice(0, 40),
            title: cleanTitle,
            description: cleanDesc,
            tags: cleanTags,
            mainImage: String(body.mainImage),
            subImages: safeSubs,
            adSlot: Math.floor(Math.random() * 3),
          };

          await this.state.storage.put("illust_item_" + newId, itemObj);
          indexList.unshift({
            id: newId,
            date: itemObj.date,
            uid: uid,
            username: itemObj.username,
            title: cleanTitle,
            tags: cleanTags,
          });
          await this.state.storage.put("illust_index", indexList.slice(0, 300));
          await this.state.storage.delete("recent_illust_cache");
          return new Response(JSON.stringify({ ok: true, id: newId }), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: "サーバーエラー: " + err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }
    // 4-7. LINEスタンプURL申請・審査・取り下げAPI（/api/illusts/stamp-url）
    if (url.pathname === "/api/illusts/stamp-url" && request.method === "POST") {
      try {
        const body = await request.json();
        const action = String(body.action || "");
        const illustId = String(body.illustId || "");
        const fullItem = await this.state.storage.get("illust_item_" + illustId);
        let urlLogs = (await this.state.storage.get("stamp_url_logs")) || [];

        const isValidLineUrl = (u) => {
          const s = String(u || "").trim();
          return /^https:\/\/(store\.line\.me\/stickershop\/product\/|line\.me\/S\/sticker\/)[a-zA-Z0-9_\-\/\?\=\&\%]+$/i.test(s);
        };

        // 会員本人による申請
        if (action === "apply") {
          if (!fullItem || fullItem.uid !== String(body.uid)) {
            return new Response(JSON.stringify({ ok: false, error: "申請権限がありません" }), { status: 403 });
          }
          const cleanUrl = String(body.stampUrl || "").trim().slice(0, 300);
          if (!isValidLineUrl(cleanUrl)) {
            return new Response(JSON.stringify({ ok: false, error: "LINEスタンプ公式購入ページのURLのみ申請可能です" }), { status: 400 });
          }
          fullItem.stampUrl = cleanUrl;
          fullItem.stampUrlStatus = "pending";
          fullItem.stampUrlUpdatedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
          await this.state.storage.put("illust_item_" + illustId, fullItem);

          urlLogs = urlLogs.filter((l) => String(l.illustId) !== illustId);
          urlLogs.unshift({
            id: Date.now(),
            date: fullItem.stampUrlUpdatedAt,
            illustId: illustId,
            illustTitle: fullItem.title,
            uid: fullItem.uid,
            username: fullItem.username,
            stampUrl: cleanUrl,
            status: "pending",
            note: "新規・再申請"
          });
          await this.state.storage.put("stamp_url_logs", urlLogs.slice(0, 1000));
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }

        // 会員本人による取り下げ
        if (action === "withdraw") {
          if (!fullItem || fullItem.uid !== String(body.uid)) {
            return new Response(JSON.stringify({ ok: false, error: "操作権限がありません" }), { status: 403 });
          }
          const prevUrl = fullItem.stampUrl || "";
          fullItem.stampUrl = "";
          fullItem.stampUrlStatus = "withdrawn";
          fullItem.stampUrlUpdatedAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
          await this.state.storage.put("illust_item_" + illustId, fullItem);

          const log = urlLogs.find((l) => String(l.illustId) === illustId);
          if (log) {
            log.status = "withdrawn";
            log.note = "⚠️ 本人により取り下げ（" + fullItem.stampUrlUpdatedAt + "）";
          } else {
            urlLogs.unshift({
              id: Date.now(),
              date: fullItem.stampUrlUpdatedAt,
              illustId: illustId,
              illustTitle: fullItem.title,
              uid: fullItem.uid,
              username: fullItem.username,
              stampUrl: prevUrl,
              status: "withdrawn",
              note: "⚠️ 本人により取り下げ"
            });
          }
          await this.state.storage.put("stamp_url_logs", urlLogs.slice(0, 1000));
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }

        // 運営による承認・不承認・ログ削除
        if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });

        if (action === "review") {
          const decision = body.decision === "approved" ? "approved" : "rejected";
          if (fullItem) {
            fullItem.stampUrlStatus = decision;
            if (decision === "rejected") fullItem.stampUrl = "";
            await this.state.storage.put("illust_item_" + illustId, fullItem);
          }
          const log = urlLogs.find((l) => String(l.illustId) === illustId);
          if (log) {
            log.status = decision;
            log.note = decision === "approved" ? "✅ 運営承認済み" : "❌ 運営不承認";
          }
          await this.state.storage.put("stamp_url_logs", urlLogs);
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }

        if (action === "delete_log") {
          urlLogs = urlLogs.filter((l) => String(l.illustId) !== illustId);
          if (fullItem) {
            fullItem.stampUrl = "";
            fullItem.stampUrlStatus = "";
            await this.state.storage.put("illust_item_" + illustId, fullItem);
          }
          await this.state.storage.put("stamp_url_logs", urlLogs);
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
      }
    }

    // 4-8. イラスト違反通報の保存・一覧・削除API（/api/illusts/report）
    if (url.pathname === "/api/illusts/report") {
      if (request.method === "GET") {
        if (url.searchParams.get("key") !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
        const list = (await this.state.storage.get("illust_reports")) || [];
        return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json" } });
      }
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        let list = (await this.state.storage.get("illust_reports")) || [];

        if (body.action === "delete_report") {
          if (body.key !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
          list = list.filter((r) => String(r.id) !== String(body.id));
          await this.state.storage.put("illust_reports", list);
          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        }
             if (!body.illustId || !body.category || !body.detail) {
       return new Response(JSON.stringify({ ok: false, error: "必須項目が不足しています" }), { status: 400 });
     }


        const reportObj = {
          id: Date.now(),
          date: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
          illustId: String(body.illustId || ""),
          illustTitle: String(body.illustTitle || "").slice(0, 80),
          targetUid: String(body.targetUid || "不明"),
          targetUsername: String(body.targetUsername || "不明"),
          reporterUid: String(body.reporterUid || "未ログイン（ゲスト）"),
          reporterUsername: String(body.reporterUsername || "ゲスト"),
          reporterEmail: String(body.reporterEmail || "").trim().slice(0, 120),
          category: String(body.category || "").slice(0, 50),
          detail: String(body.detail || "").slice(0, 1000),
        };
        list.unshift(reportObj);
        await this.state.storage.put("illust_reports", list.slice(0, 1000));
        return new Response(JSON.stringify({ ok: true, report: reportObj }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === "/api/stamp-url-logs" && request.method === "GET") {
      if (url.searchParams.get("key") !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
      const logs = (await this.state.storage.get("stamp_url_logs")) || [];
      return new Response(JSON.stringify(logs), { headers: { "Content-Type": "application/json" } });
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
  async fetch(request, env, ctx) {

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
    // ★イラスト違反通報＋控えメール自動送信API（/api/report-illust）
    if (url.pathname === "/api/report-illust" && request.method === "POST") {
      try {
        const body = await request.json();
        const saveRes = await stub.fetch(new Request("https://dummy/api/illusts/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }));
        const saveData = await saveRes.json().catch(() => ({ ok: true }));

        const toEmail = String(body.reporterEmail || "").trim();
        const apiKey = (typeof env !== "undefined" && env && env.RESEND_API_KEY) ? String(env.RESEND_API_KEY).trim() : "";
        let mailStatus = "skipped";

        if (toEmail && apiKey) {
          const mailText =
            (body.reporterUsername || "会員") + " 様\n\n" +
            "HookupStickers への違反通報を受け付けました。ご協力ありがとうございます。\n" +
            "以下の内容で運営チームへ報告いたしました。\n\n" +
            "----------------------------------------\n" +
            "■ 対象作品：" + (body.illustTitle || "") + "（ID: " + (body.illustId || "") + "）\n" +
            "■ 通報カテゴリー：" + (body.category || "") + "\n" +
            "■ 通報内容：\n" + (body.detail || "") + "\n" +
            "----------------------------------------\n\n" +
            "※本メールは送信専用です。";

          const endpoint = ["https", "://", "api.", "resend.com", "/emails"].join("");
          const mailRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "HookupStickers 運営事務局 <noreply@hookupstickers.com>",
              to: [toEmail],
              subject: "【HookupStickers】違反通報の受付控え",
              text: mailText,
            }),
          });
          mailStatus = mailRes.ok ? "sent" : ("err_" + mailRes.status);
        } else if (!apiKey) {
          mailStatus = "no_key";
        }

        return new Response(JSON.stringify({ ok: true, saveData: saveData, mailStatus: mailStatus }), {
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
      url.pathname === "/api/plan-requests" ||
      url.pathname === "/api/stamp-url-logs" ||
      url.pathname.startsWith("/api/illusts")
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
     

      const activeAndQueued = shortAdsList.filter(a => a.status === "approved" || a.status === "queued" || a.status === "payment_pending");
      const finishedAds = shortAdsList.filter(a => a.status === "completed" || a.status === "rejected").slice(0, 10);
      const displayAds = [...pendingAds, ...activeAndQueued, ...finishedAds];

      const shortAdsHtml = displayAds.length === 0
        ? "<p style='font-size:13px;color:#666;'>表示するショート動画申請はありません。</p>"
        : displayAds.map(ad => {
            const st = ad.status || "pending";
            const feeYen = Math.round(Number(ad.limit || 1000) * 0.1);
            const clicks = Number(ad.clicks || 0);
            const limit = Number(ad.limit || 1000);
            let remainText = "";
            if (st === "approved" && ad.startedAt) {
              const leftMs = Math.max(0, (7 * 24 * 60 * 60 * 1000) - (Date.now() - Number(ad.startedAt)));
              const leftHours = Math.ceil(leftMs / (1000 * 60 * 60));
              remainText = ` ｜ 残り約${leftHours}時間`;
            }

            const statusLabel = st === "approved"
              ? "<span style='color:#2e7d32;font-weight:bold;'>🟢 トップ掲載中</span>"
              : st === "queued"
              ? "<span style='color:#6a1b9a;font-weight:bold;'>📅 掲載予約待ち（決済済み）</span>"
              : st === "payment_pending"
              ? "<span style='color:#1565c0;font-weight:bold;'>💳 決済処理中（お支払い待ち）</span>"
              : st === "completed"
              ? `<span style='color:#546e7a;font-weight:bold;'>🏁 掲載終了（${ad.endedReason || "完了"}）</span>`
              : st === "rejected"
              ? "<span style='color:#c62828;font-weight:bold;'>❌ 不許可</span>"
              : "<span style='color:#e65100;font-weight:bold;'>⏳ 未決定（古い順優先）</span>";

            return `
              <div class="ad-req-card" data-status="${st}" data-search="${(ad.title + " " + ad.username + " " + ad.uid + " " + ad.id).toLowerCase().replace(/"/g, "&quot;")}" style="background:#fff;border:2px solid ${st === "approved" ? "#2e7d32" : st === "queued" ? "#8e24aa" : st === "pending" ? "#e65100" : "#ffcc80"};border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px;">
                  <span style="font-size:11px;color:#777;">申請ID：<strong>${ad.id}</strong> ｜ ${ad.date}</span>
                  <span>${statusLabel}</span>
                </div>
                <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">🎬 ${ad.title.replace(/</g, "&lt;")}</div>
                <div style="font-size:12px;background:#fff8f0;border:1px solid #ffe0b2;padding:6px 10px;border-radius:6px;margin-bottom:6px;">
                  👤 <strong>申請会員：</strong><a href="/my_page_${encodeURIComponent(ad.username)}" target="_blank" style="color:#e65100;font-weight:bold;">${ad.username.replace(/</g, "&lt;")}</a>（UID: <code>${String(ad.uid || "").replace(/</g, "&lt;")}</code>）<br>
                  📊 <strong>クリック消化：</strong><strong>${clicks.toLocaleString()} / ${limit.toLocaleString()} 回</strong>（${feeYen.toLocaleString()}円分）${remainText} ｜ ${ad.mp4Info || ""}
                </div>
                <div style="font-size:12px;margin-bottom:6px;word-break:break-all;">リンク先：<a href="${ad.url.replace(/"/g, "&quot;")}" target="_blank" style="color:#e65100;">${ad.url.replace(/</g, "&lt;")}</a></div>
                ${ad.stripeUrl ? `<div style="font-size:11px;color:#1565c0;background:#e3f2fd;padding:5px 8px;border-radius:6px;margin-bottom:6px;word-break:break-all;">Stripe URL：${ad.stripeUrl.replace(/</g, "&lt;")}</div>` : ""}
                ${st === "rejected" && ad.rejectReason ? `<div style="background:#ffebee;color:#c62828;font-size:12px;padding:6px 10px;border-radius:6px;margin-bottom:8px;">拒否理由：${ad.rejectReason.replace(/</g, "&lt;")}</div>` : ""}
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                  <button type="button" onclick="reviewShortAd('${ad.id}', 'payment_pending', ${feeYen})" style="flex:1;min-width:120px;background:#1565c0;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">✅ 承諾（決済待ちへ）</button>
                  <button type="button" onclick="reviewShortAd('${ad.id}', 'paid', ${feeYen})" style="flex:1;min-width:120px;background:#2e7d32;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">💰 入金確認・掲載予約</button>
                  <button type="button" onclick="reviewShortAd('${ad.id}', 'test_paid', ${feeYen})" style="flex:1;min-width:130px;background:#6a1b9a;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">🧪 テスト決済完了（挙動確認）</button>
                  <button type="button" onclick="reviewShortAd('${ad.id}', 'rejected', ${feeYen})" style="background:#c62828;color:#fff;border:none;padding:8px 10px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">❌ 不許可</button>
                  <button type="button" onclick="deleteShortAd('${ad.id}')" style="background:#424242;color:#fff;border:none;padding:8px 10px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:11px;">🗑️ 削除</button>
                </div>
              </div>
            `;
          }).join("");

      const latestNoticeHtml = `
        <div style="background:#fff3e0;border:2px solid #e65100;border-radius:12px;padding:16px;margin-bottom:24px;">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
            <h2 style="margin:0;color:#e65100;font-size:17px;">🔔 動画申請・掲載キュー（未決定:${pendingAds.length}件）</h2>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <select id="tagFilterSelect" onchange="filterAdCards()" style="padding:6px 8px;border-radius:6px;border:1px solid #ffcc80;font-size:12px;">
                <option value="all">すべて表示</option>
                <option value="pending">⏳ 未決定のみ</option>
                <option value="payment_pending">💳 決済処理中</option>
                <option value="queued">📅 掲載予約待ち</option>
                <option value="approved">🟢 トップ掲載中</option>
                <option value="completed">🏁 掲載終了</option>
                <option value="rejected">❌ 不許可</option>
              </select>
              <input type="text" id="tagSearchInput" oninput="filterAdCards()" placeholder="タイトル・会員名・UID検索" style="padding:6px 8px;border-radius:6px;border:1px solid #ffcc80;font-size:12px;width:150px;">
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
          async function reviewShortAd(id, status, feeYen) {
            let reason = "";
            let stripeUrl = undefined;
            let sendStatus = status;
            if (status === "rejected") {
              reason = prompt("不許可（拒否）の理由を入力してください（会員画面に表示されます）：", "規約または動画基準を満たしていないため");
              if (reason === null) return;
            } else if (status === "payment_pending") {
              stripeUrl = prompt("この申請（" + feeYen + "円）用の Stripe 決済リンクURLを入力してください：", "https://stripe.com");
              if (stripeUrl === null) return;
            } else if (status === "paid") {
              if (!confirm("Stripeでの入金（" + feeYen + "円）を確認済みですか？\\n空き枠があれば即座に掲載開始、掲載中があれば予約待ちキューに入ります。")) return;
            } else if (status === "test_paid") {
              if (!confirm("【テスト挙動確認】決済リンクなしで決済完了扱いとし、トップページ掲載（または予約キュー）へ反映しますか？")) return;
              sendStatus = "paid";
            }
            const res = await fetch("/api/short-ads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "set_status", key: "${ADMIN_KEY}", id: id, status: sendStatus, reason: reason, stripeUrl: stripeUrl })
            });
            if (res.ok) location.reload();
          }
          async function deleteShortAd(id) {
            if (!confirm("この申請ログと動画データをサーバーから完全に抹消しますか？（元に戻せません）")) return;
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

      const allIllusts = await (await stub.fetch(new Request("https://dummy/api/illusts"))).json();
      const adminIllustsHtml = allIllusts.length === 0
        ? "<p style='font-size:13px;color:#666;'>まだ投稿されたイラストはありません。</p>"
        : allIllusts.map(il => `
            <div class="admin-illust-card" data-kw="${(il.title + " " + il.username + " " + (il.tags || []).join(" ") + " " + il.id).toLowerCase().replace(/"/g, "&quot;")}" style="background:#fff;border:1px solid #ffcc80;border-radius:10px;padding:10px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">
              <img src="${il.mainImage}" style="width:64px;height:64px;object-fit:contain;border-radius:8px;border:1px solid #eee;background:#fffdf9;">
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;color:#888;">ID: ${il.id} ｜ 投稿：${il.date}</div>
                <div style="font-weight:bold;font-size:14px;color:#2b1d12;">${il.title.replace(/</g, "&lt;")}</div>
                <div style="font-size:12px;color:#555;">投稿者：${il.username.replace(/</g, "&lt;")}</div>
              </div>
              <button type="button" onclick="adminDeleteIllust('${il.id}', '${il.title.replace(/'/g, "\\'")}')" style="background:#c62828;color:#fff;border:none;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;white-space:nowrap;">🗑️ 強制削除</button>
            </div>
          `).join("");

      const adminIllustBoxHtml = `
        <div style="background:#fff8f0;border:2px solid #ffcc80;border-radius:12px;padding:16px;margin-bottom:24px;">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
            <h2 style="margin:0;color:#e65100;font-size:17px;">🎨 投稿イラスト検索・削除管理（全${allIllusts.length}件）</h2>
            <input type="text" id="adminIllustSearch" oninput="filterAdminIllusts()" placeholder="作品名・会員名・タグ・IDで検索" style="padding:7px 10px;border-radius:8px;border:1px solid #ffcc80;font-size:12px;width:210px;">
          </div>
          <div style="max-height:360px;overflow-y:auto;">${adminIllustsHtml}</div>
        </div>
        <script>
          function filterAdminIllusts() {
            const kw = document.getElementById("adminIllustSearch").value.toLowerCase().trim();
            document.querySelectorAll(".admin-illust-card").forEach(c => {
              c.style.display = (!kw || c.dataset.kw.includes(kw)) ? "flex" : "none";
            });
          }
          async function adminDeleteIllust(id, title) {
            if (!confirm("イラスト「" + title + "」を完全に削除しますか？（この操作は取り消せません）")) return;
            const r = await fetch("/api/illusts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "admin_delete", key: "${ADMIN_KEY}", id: id })
            });
            if (r.ok) { alert("削除しました！"); location.reload(); }
          }
        </script>
      `;

      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>運営管理画面</title><link rel="icon" href="/icon.png?v=5" type="image/png"></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:680px;margin:0 auto;"><div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
  <a href="/admin/stamp-urls?key=${ADMIN_KEY}" style="background:#06c755;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:bold;">🔗 LINEスタンプURL審査ページへ</a>
  <a href="/admin/reports?key=${ADMIN_KEY}" style="background:#d93025;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:bold;">🚨 通報センターへ</a>
</div>
${latestNoticeHtml}${videoBoxHtml}<h2>👥 登録会員一覧（${users.length}名）</h2>${usersHtml}<hr style="margin:30px 0;"><h2>💡 企画依頼アイデアBOX（${planList.length}件）</h2>${plansHtml}<hr style="margin:30px 0;">${adminIllustBoxHtml}<h2>📩 お問い合わせ受信BOX（最新100件）</h2>${itemsHtml}</body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

        // ★管理専用ページ1：LINEスタンプ公式URL 審査・履歴管理（/admin/stamp-urls）
    if (url.pathname === "/admin/stamp-urls") {
      if (url.searchParams.get("key") !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
      const logs = await (await stub.fetch(new Request(`https://dummy/api/stamp-url-logs?key=${ADMIN_KEY}`))).json();
      const pendingLogs = logs.filter((l) => l.status === "pending").reverse();
      const otherLogs = logs.filter((l) => l.status !== "pending");
      const ordered = [...pendingLogs, ...otherLogs];

      const rowsHtml = ordered.length === 0
        ? "<p>まだLINEスタンプURLの申請はありません。</p>"
        : ordered.map((l) => {
            const stBadge = l.status === "approved" ? "<span style='color:#2e7d32;font-weight:bold;'>✅ 承認済み</span>"
              : l.status === "rejected" ? "<span style='color:#c62828;font-weight:bold;'>❌ 不承認</span>"
              : l.status === "withdrawn" ? "<span style='color:#ef6c00;font-weight:bold;'>⚠️ 本人取り下げ済み</span>"
              : "<span style='color:#e65100;font-weight:bold;'>⏳ 未判定（古い順優先）</span>";
            return `
              <div class="url-log-card" data-kw="${(l.illustTitle + " " + l.username + " " + l.stampUrl + " " + l.status).toLowerCase().replace(/"/g, "&quot;")}" style="background:#fff;border:2px solid ${l.status === "pending" ? "#06c755" : "#ddd"};border-radius:12px;padding:14px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:6px;">
                  <span>申請日時：${l.date}</span>
                  <span>${stBadge}</span>
                </div>
                <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">🎨 作品：${l.illustTitle.replace(/</g, "&lt;")}（投稿者：${l.username.replace(/</g, "&lt;")}）</div>
                <div style="font-size:12px;margin-bottom:4px;">🔗 紐づけイラストページ：<a href="/illust_detail.html?id=${encodeURIComponent(l.illustId)}" target="_blank">/illust_detail.html?id=${l.illustId}</a></div>
                <div style="font-size:12px;margin-bottom:8px;word-break:break-all;background:#f9f9f9;padding:8px;border-radius:6px;">申請LINE URL：<a href="${l.stampUrl.replace(/"/g, "&quot;")}" target="_blank" style="color:#06c755;font-weight:bold;">${l.stampUrl.replace(/</g, "&lt;")}</a><div style="color:#777;margin-top:4px;">状況メモ：${(l.note || "").replace(/</g, "&lt;")}</div></div>
                <div style="display:flex;gap:8px;">
                  <button type="button" onclick="reviewStampUrl('${l.illustId}','approved')" style="flex:1;background:#2e7d32;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;">✅ 承認</button>
                  <button type="button" onclick="reviewStampUrl('${l.illustId}','rejected')" style="flex:1;background:#c62828;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;">❌ 不承認</button>
                  <button type="button" onclick="deleteStampUrlLog('${l.illustId}')" style="background:#424242;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">🗑️ 削除</button>
                </div>
              </div>
            `;
          }).join("");

      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LINEスタンプURL審査ページ</title></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:720px;margin:0 auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <h1 style="margin:0;font-size:20px;">🔗 LINEスタンプ公式URL 審査管理（未判定:${pendingLogs.length}件）</h1>
            <a href="/admin?key=${ADMIN_KEY}" style="background:#333;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:13px;">← 管理トップへ</a>
          </div>
          <input type="text" id="urlSearchBox" oninput="filterUrlLogs()" placeholder="作品名・会員名・URL・ステータスで過去履歴検索" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:16px;font-size:14px;">
          ${rowsHtml}
          <script>
            function filterUrlLogs(){const kw=document.getElementById("urlSearchBox").value.toLowerCase().trim();document.querySelectorAll(".url-log-card").forEach(c=>{c.style.display=(!kw||c.dataset.kw.includes(kw))?"block":"none";});}
            async function reviewStampUrl(id,decision){if(!confirm(decision==="approved"?"このLINEスタンプURLを承認して公開しますか？":"この申請を不承認にしますか？"))return;const r=await fetch("/api/illusts/stamp-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"review",key:"${ADMIN_KEY}",illustId:id,decision:decision})});if(r.ok)location.reload();}
            async function deleteStampUrlLog(id){if(!confirm("このURL申請ログを完全に削除しますか？"))return;const r=await fetch("/api/illusts/stamp-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete_log",key:"${ADMIN_KEY}",illustId:id})});if(r.ok)location.reload();}
          </script>
        </body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

     // ★管理専用ページ2：通報センター（/admin/reports）
    if (url.pathname === "/admin/reports") {
      try {
        if (url.searchParams.get("key") !== ADMIN_KEY) return new Response("Unauthorized", { status: 401 });
        const repRes = await stub.fetch(new Request(`https://dummy/api/illusts/report?key=${ADMIN_KEY}`));
        const reports = await repRes.json().catch(() => []);
        const safeReports = Array.isArray(reports) ? reports : [];

        const repHtml = safeReports.length === 0
          ? "<p>現在、違反通報はありません。</p>"
          : safeReports.map((r) => {
              const title = String(r.illustTitle || "無題");
              const cat = String(r.category || "未分類");
              const detail = String(r.detail || "");
              const tUid = String(r.targetUid || "不明");
              const tName = String(r.targetUsername || "不明");
              const rUid = String(r.reporterUid || "不明");
              const rName = String(r.reporterUsername || "ゲスト");
              const kw = (title + " " + cat + " " + detail + " " + rUid + " " + tUid + " " + tName).toLowerCase().replace(/"/g, "&quot;");
              return `
                <div class="rep-card" data-kw="${kw}" style="background:#fff;border:2px solid #ef9a9a;border-radius:12px;padding:14px;margin-bottom:12px;">
                  <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:6px;">
                    <span>通報日時：${String(r.date || "")}</span>
                    <span style="background:#ffebee;color:#c62828;padding:2px 8px;border-radius:6px;font-weight:bold;">${cat.replace(/</g, "&lt;")}</span>
                  </div>
                  <div style="font-weight:bold;font-size:15px;margin-bottom:4px;">🎨 対象作品：${title.replace(/</g, "&lt;")}</div>
                  <div style="font-size:12px;margin-bottom:6px;">🔗 対象ページ：<a href="/illust_detail.html?id=${encodeURIComponent(String(r.illustId || ""))}" target="_blank">/illust_detail.html?id=${String(r.illustId || "")}</a></div>
                  <div style="font-size:12px;background:#f5f5f5;padding:8px;border-radius:6px;margin-bottom:6px;">
                    <div><strong>通報された会員ID：</strong>${tUid.replace(/</g, "&lt;")}（${tName.replace(/</g, "&lt;")}）</div>
                    <div><strong>通報した会員ID：</strong>${rUid.replace(/</g, "&lt;")}（${rName.replace(/</g, "&lt;")}）</div>
                  </div>
                  <div style="white-space:pre-wrap;font-size:13px;background:#fff8f8;border:1px solid #ffcdd2;padding:10px;border-radius:6px;margin-bottom:10px;">${detail.replace(/</g, "&lt;")}</div>
                  <div style="display:flex;gap:8px;">
                    <button type="button" onclick="purgeIllustPage('${String(r.illustId || "")}','${title.replace(/'/g, "\\'")}')" style="flex:1;background:#c62828;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:bold;cursor:pointer;">🔥 画像ページを完全削除する</button>
                    <button type="button" onclick="dismissReport('${String(r.id || "")}')" style="background:#616161;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">通報ログのみ消去</button>
                  </div>
                </div>
              `;
            }).join("");

        return new Response(
          `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>通報センター</title></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px;max-width:720px;margin:0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
              <h1 style="margin:0;font-size:20px;color:#c62828;">🚨 通報センター（全${safeReports.length}件・新着順）</h1>
              <a href="/admin?key=${ADMIN_KEY}" style="background:#333;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:13px;">← 管理トップへ</a>
            </div>
            <input type="text" id="repSearchBox" oninput="filterReports()" placeholder="作品名・カテゴリー・会員ID・内容で検索" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:16px;font-size:14px;">
            ${repHtml}
            <script>
              function filterReports(){const kw=document.getElementById("repSearchBox").value.toLowerCase().trim();document.querySelectorAll(".rep-card").forEach(c=>{c.style.display=(!kw||c.dataset.kw.includes(kw))?"block":"none";});}
              async function purgeIllustPage(illustId,title){if(!confirm("対象の画像ページ「"+title+"」をサーバーから完全に抹消しますか？（元に戻せません）"))return;const r=await fetch("/api/illusts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"admin_delete",key:"${ADMIN_KEY}",id:illustId})});if(r.ok)alert("画像ページを完全に削除しました！");}
              async function dismissReport(repId){if(!confirm("この通報ログを消去しますか？"))return;const r=await fetch("/api/illusts/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete_report",key:"${ADMIN_KEY}",id:repId})});if(r.ok)location.reload();}
            </script>
          </body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      } catch (err) {
        return new Response("通報センターエラー: " + err.message, { status: 500 });
      }
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
      const memberIllusts = await (await stub.fetch(new Request(`https://dummy/api/illusts?author=${encodeURIComponent(member.username)}`))).json();

      const galleryHtml = memberIllusts.length === 0
        ? `<div class="gallery-empty">まだ投稿されたスタンプイラストはありません。</div>`
        : `<div class="mp-grid">` + memberIllusts.map((il) => `
            <div class="mp-card">
              <button type="button" class="mp-del-btn" data-owner-uid="${member.uid}" onclick="deleteMyIllust(event, '${il.id}', '${il.title.replace(/'/g, "\\'")}')" title="作品を削除">🗑️</button>
              <a href="/illust_detail.html?id=${encodeURIComponent(il.id)}" class="mp-link">
                <img src="${il.mainImage}" class="mp-thumb" alt="${il.title.replace(/"/g, "&quot;")}" loading="lazy">
                <div class="mp-name">${il.title.replace(/</g, "&lt;")}</div>
              </a>
            </div>
          `).join("") + `</div>`;

      return new Response(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName} さんの会員ページ | HookupStickers</title><link rel="icon" href="/icon.png?v=5" type="image/png"><style>
          body{font-family:sans-serif;background:#fff8f0;margin:0;padding:0 16px 40px;color:#2b1d12}
          .wrap{max-width:960px;margin:0 auto}
          .profile-card{background:#fff;border:1px solid #ffe0b2;border-radius:16px;padding:16px 20px;box-shadow:0 4px 14px rgba(230,81,0,0.08);margin:16px 0 20px;z-index:50}
          @media (max-width: 768px){.profile-card{position:sticky;top:0;margin:0 -16px 16px;border-radius:0 0 16px 16px;border-top:none;padding:12px 16px}}
          .badge{display:inline-block;background:#fff3e0;color:#e65100;border:1px solid #ffcc80;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px;margin-bottom:4px}
          .title{font-size:20px;font-weight:bold;margin:0 0 4px}
          .url-box{background:#fff8f0;border:1px solid #ffe0b2;padding:6px 10px;border-radius:8px;font-size:11px;color:#5d4037;word-break:break-all;margin-top:8px}
          .section-card{background:#fff;border:1px solid #ffe0b2;border-radius:16px;padding:18px;margin-bottom:20px}
          .mp-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
          @media (max-width: 768px){.mp-grid{grid-template-columns:repeat(3,1fr);gap:8px}}
          .mp-card{position:relative;background:#fffdf9;border:1px solid #ffe0b2;border-radius:12px;padding:6px}
          .mp-link{text-decoration:none;color:inherit;display:block}
          .mp-thumb{width:100%;aspect-ratio:1/1;object-fit:contain;border-radius:8px;display:block}
          .mp-name{font-size:11px;font-weight:bold;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
          .mp-del-btn{display:none;position:absolute;top:4px;right:4px;z-index:5;background:rgba(198,40,40,0.9);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:11px;line-height:22px;padding:0;cursor:pointer;text-align:center}
          .gallery-empty{border:2px dashed #ffcc80;border-radius:12px;padding:36px 16px;text-align:center;color:#8d6e63;font-size:13px}
          .nav-links{display:flex;gap:12px;justify-content:center;margin-top:20px}
          .btn{display:inline-block;padding:10px 20px;border-radius:20px;text-decoration:none;font-weight:bold;font-size:14px;background:#e65100;color:#fff}
          .btn-sub{background:#3e2723}
        </style></head><body><div class="wrap">
          <div class="profile-card">
            <span class="badge">${safeRole}</span>
            <h1 class="title">👤 ${safeName} さんのマイページ</h1>
            <p style="font-size:12px;color:#795548;margin:0;">投稿作品数：${memberIllusts.length}件 ｜ 登録日：${member.date || "登録済み"}</p>
            <div class="url-box">専用URL：${url.origin}/my_page_${encodeURIComponent(member.username)}</div>
          </div>
          <div class="section-card">
            <h2 style="font-size:17px;margin:0 0 14px;">🎨 投稿スタンプイラスト一覧（全${memberIllusts.length}件）</h2>
            ${galleryHtml}
          </div>
          <div class="nav-links"><a href="/" class="btn">トップページへ</a><a href="/post_illust.html" class="btn btn-sub">＋ 新しく投稿する</a></div>
        </div>
        <script>
          let loginUser = null;
          try { loginUser = JSON.parse(localStorage.getItem("site_user") || "null"); } catch(e) {}
          if (loginUser && loginUser.uid) {
            document.querySelectorAll(".mp-del-btn").forEach(btn => {
              if (btn.dataset.ownerUid === loginUser.uid) btn.style.display = "block";
            });
          }
          async function deleteMyIllust(e, id, title) {
            e.preventDefault();
            e.stopPropagation();
            if (!confirm("【確認】作品「" + title + "」を削除しますか？\\n\\n※一度削除するとデータを元に戻すことはできません。\\n本当に削除する場合は「OK」、取り消す場合は「キャンセル」を押してください。")) return;
            const res = await fetch("/api/illusts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "user_delete", id: id, uid: loginUser.uid })
            });
            if (res.ok) { alert("作品を削除しました。"); location.reload(); }
            else { alert("削除に失敗しました。"); }
          }
        </script></body></html>`,
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



