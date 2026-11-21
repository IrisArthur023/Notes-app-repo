import express from "express";
import http from "http";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const PYTHON_PORT = 5001;

// Spawn Python backend process
let pythonProcess: ChildProcess | null = null;

function startPythonBackend() {
  const scriptPath = path.join(process.cwd(), "backend", "app.py");
  console.log(`[Server] Starting Python backend on port ${PYTHON_PORT}...`);
  pythonProcess = spawn("python3", [scriptPath, String(PYTHON_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  pythonProcess.stdout?.on("data", (data) => {
    console.log(`[Python stdout] ${data.toString().trim()}`);
  });

  pythonProcess.stderr?.on("data", (data) => {
    console.error(`[Python stderr] ${data.toString().trim()}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[Server] Python backend exited with code ${code}`);
  });
}

// Ensure cleanup on shutdown
process.on("exit", () => {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill();
  }
});
process.on("SIGINT", () => process.exit());
process.on("SIGTERM", () => process.exit());

interface Collaborator {
  ws: WebSocket;
  userId: string;
  name: string;
  color: string;
  role: string;
  avatar?: string;
  cursor?: { line: number; ch: number };
  selection?: { start: { line: number; ch: number }; end: { line: number; ch: number } };
  lastActive: number;
}

// Document room manager for WebSockets
const rooms = new Map<string, Map<WebSocket, Collaborator>>();

function broadcastToRoom(docId: string, message: object, excludeWs?: WebSocket) {
  const room = rooms.get(docId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const [ws] of room.entries()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function getRoomCollaborators(docId: string) {
  const room = rooms.get(docId);
  if (!room) return [];
  const list = [];
  for (const [, collab] of room.entries()) {
    list.push({
      userId: collab.userId,
      name: collab.name,
      color: collab.color,
      role: collab.role,
      avatar: collab.avatar,
      cursor: collab.cursor,
      selection: collab.selection,
      lastActive: collab.lastActive,
    });
  }
  return list;
}

async function startServer() {
  startPythonBackend();

  // Wait 300ms for Python to bind
  await new Promise((r) => setTimeout(r, 300));

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Proxy /api requests to Python backend
  app.use("/api", (req, res) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: PYTHON_PORT,
      path: `/api${req.url}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${PYTHON_PORT}`,
      },
    };

    const pyReq = http.request(options, (pyRes) => {
      res.writeHead(pyRes.statusCode || 500, pyRes.headers);
      pyRes.pipe(res, { end: true });
    });

    pyReq.on("error", (err) => {
      console.error("[Server] Error forwarding to Python backend:", err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Python backend gateway error",
          details: err.message,
        });
      }
    });

    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      pyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
      pyReq.write(bodyData);
    }
    pyReq.end();
  });

  const server = http.createServer(app);

  // Set up WebSocket Server on the same HTTP server
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let currentDocId: string | null = null;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "join") {
          currentDocId = msg.docId;
          if (!rooms.has(currentDocId)) {
            rooms.set(currentDocId, new Map());
          }
          const room = rooms.get(currentDocId)!;

          const collaborator: Collaborator = {
            ws,
            userId: msg.user.id,
            name: msg.user.name,
            color: msg.user.color,
            role: msg.user.role,
            avatar: msg.user.avatar,
            cursor: msg.cursor || { line: 1, ch: 0 },
            selection: msg.selection,
            lastActive: Date.now(),
          };

          room.set(ws, collaborator);

          // Send current room state to joining user
          ws.send(
            JSON.stringify({
              type: "room_state",
              collaborators: getRoomCollaborators(currentDocId),
            })
          );

          // Broadcast user_joined to other collaborators
          broadcastToRoom(
            currentDocId,
            {
              type: "user_joined",
              user: {
                userId: collaborator.userId,
                name: collaborator.name,
                color: collaborator.color,
                role: collaborator.role,
                avatar: collaborator.avatar,
                cursor: collaborator.cursor,
              },
            },
            ws
          );
        } else if (msg.type === "cursor_move") {
          if (currentDocId && rooms.has(currentDocId)) {
            const collab = rooms.get(currentDocId)?.get(ws);
            if (collab) {
              collab.cursor = msg.cursor;
              collab.selection = msg.selection;
              collab.lastActive = Date.now();

              broadcastToRoom(
                currentDocId,
                {
                  type: "cursor_update",
                  userId: collab.userId,
                  cursor: msg.cursor,
                  selection: msg.selection,
                },
                ws
              );
            }
          }
        } else if (msg.type === "text_change") {
          if (currentDocId) {
            broadcastToRoom(
              currentDocId,
              {
                type: "text_change",
                docId: currentDocId,
                content: msg.content,
                senderId: msg.senderId,
                version: msg.version,
                timestamp: Date.now(),
              },
              ws
            );
          }
        } else if (msg.type === "comment_added") {
          if (currentDocId) {
            broadcastToRoom(currentDocId, {
              type: "comment_added",
              comment: msg.comment,
            });
          }
        } else if (msg.type === "version_created") {
          if (currentDocId) {
            broadcastToRoom(currentDocId, {
              type: "version_created",
              version: msg.version,
            });
          }
        } else if (msg.type === "role_updated") {
          if (currentDocId) {
            // Update role in collaborator map if present
            const room = rooms.get(currentDocId);
            if (room) {
              for (const [, c] of room.entries()) {
                if (c.userId === msg.userId) {
                  c.role = msg.newRole;
                }
              }
            }
            broadcastToRoom(currentDocId, {
              type: "role_updated",
              userId: msg.userId,
              newRole: msg.newRole,
            });
          }
        }
      } catch (e) {
        console.error("[WS] Error processing message:", e);
      }
    });

    ws.on("close", () => {
      if (currentDocId && rooms.has(currentDocId)) {
        const room = rooms.get(currentDocId)!;
        const leavingCollab = room.get(ws);
        room.delete(ws);
        if (leavingCollab) {
          broadcastToRoom(currentDocId, {
            type: "user_left",
            userId: leavingCollab.userId,
          });
        }
        if (room.size === 0) {
          rooms.delete(currentDocId);
        }
      }
    });
  });

  // Setup Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Live on http://0.0.0.0:${PORT} with WebSocket support`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal bootstrap error:", err);
  process.exit(1);
});
