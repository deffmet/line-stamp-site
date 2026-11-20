export class OnlineCounter {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request) {
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

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
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

    // "/ws" へのアクセスが来たらリアルタイム人数カウントに接続
    if (url.pathname === "/ws") {
      const id = env.ONLINE_COUNTER.idFromName("global-room");
      const stub = env.ONLINE_COUNTER.get(id);
      return stub.fetch(request);
    }

    // それ以外は public フォルダのHTMLや画像を表示
    return env.ASSETS.fetch(request);
  },
};
