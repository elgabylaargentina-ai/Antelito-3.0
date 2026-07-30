import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface VisitLogEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  timeStr: string;
  isNewSession?: boolean;
  deviceInfo?: string;
  ip?: string;
}

interface VisitStats {
  totalVisits: number;
  lastVisit: number;
  sessionVisits: number;
  history: VisitLogEntry[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "visits.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial empty stats
const initialStats: VisitStats = {
  totalVisits: 0,
  lastVisit: Date.now(),
  sessionVisits: 0,
  history: []
};

// Load stats from disk
function loadStats(): VisitStats {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      if (data && data.trim()) {
        const parsed = JSON.parse(data);
        return {
          totalVisits: typeof parsed.totalVisits === "number" ? parsed.totalVisits : 0,
          lastVisit: typeof parsed.lastVisit === "number" ? parsed.lastVisit : Date.now(),
          sessionVisits: typeof parsed.sessionVisits === "number" ? parsed.sessionVisits : 0,
          history: Array.isArray(parsed.history) ? parsed.history : []
        };
      }
    }
  } catch (err) {
    console.error("Error reading visits.json:", err);
  }
  return { ...initialStats };
}

// Save stats to disk
function saveStats(stats: VisitStats) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving visits.json:", err);
  }
}

let currentStats = loadStats();

function parseDevice(ua: string | undefined): string {
  if (!ua) return "Desconocido";
  const lower = ua.toLowerCase();
  let os = "PC";
  if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone")) os = "iPhone";
  else if (lower.includes("ipad")) os = "iPad";
  else if (lower.includes("macintosh") || lower.includes("mac os")) os = "Mac";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("linux")) os = "Linux";

  let browser = "";
  if (lower.includes("chrome") || lower.includes("crios")) browser = "Chrome";
  else if (lower.includes("safari")) browser = "Safari";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg")) browser = "Edge";

  return `${os}${browser ? " (" + browser + ")" : ""}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for all incoming requests (crucial for cross-device & iframe access)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // API Routes
  app.get("/api/visits", (req, res) => {
    res.json(currentStats);
  });

  app.post("/api/visits/record", (req, res) => {
    try {
      const isNewSession = req.body?.isNewSession ?? true;
      const ua = req.headers["user-agent"];
      const deviceInfo = parseDevice(ua);

      const forwarded = req.headers["x-forwarded-for"];
      let clientIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : (req.socket?.remoteAddress || req.ip || "127.0.0.1");
      if (clientIp.startsWith("::ffff:")) {
        clientIp = clientIp.replace("::ffff:", "");
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString("es-ES", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      const timeStr = now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const newEntry: VisitLogEntry = {
        id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        dateStr,
        timeStr,
        isNewSession,
        deviceInfo,
        ip: clientIp
      };

      const updatedHistory = [newEntry, ...(currentStats.history || [])].slice(0, 500);

      currentStats = {
        totalVisits: (currentStats.totalVisits || 0) + 1,
        lastVisit: Date.now(),
        sessionVisits: (currentStats.sessionVisits || 0) + (isNewSession ? 1 : 0),
        history: updatedHistory
      };

      saveStats(currentStats);
      res.json(currentStats);
    } catch (err) {
      console.error("Error recording visit:", err);
      res.status(500).json({ error: "Failed to record visit", stats: currentStats });
    }
  });

  app.post("/api/visits/reset", (req, res) => {
    currentStats = {
      totalVisits: 0,
      lastVisit: Date.now(),
      sessionVisits: 0,
      history: []
    };
    saveStats(currentStats);
    res.json(currentStats);
  });

  // Vite or static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
