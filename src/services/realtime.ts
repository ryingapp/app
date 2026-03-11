import { getApiToken } from './api';

const REALTIME_WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ||
  (__DEV__ ? 'ws://192.168.1.235:5000/ws' : 'wss://tryingpos.com/ws');

export interface RealtimeMessage {
  type: string;
  payload?: any;
}

export function connectRealtime(onMessage: (message: RealtimeMessage) => void): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let closedByUser = false;

  const stopPing = () => {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  };

  const connect = () => {
    const token = getApiToken();
    if (!token) {
      // Token not ready yet — retry shortly
      if (!closedByUser) reconnectTimer = setTimeout(connect, 2000);
      return;
    }

    try {
      ws = new WebSocket(`${REALTIME_WS_URL}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        // Send a ping every 30 s to keep the connection alive
        stopPing();
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Ignore server pong — not a business event
          if (data.type === 'pong') return;
          onMessage(data);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        stopPing();
        if (!closedByUser) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        // handled by onclose + reconnect
      };
    } catch {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };

  connect();

  return () => {
    closedByUser = true;
    stopPing();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
