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

function getLocationFromTimezone(tz: string | undefined, lang: string | undefined): string {
  if (!tz) {
    if (lang?.toLowerCase().includes('ar')) return 'Argentina';
    if (lang?.toLowerCase().includes('es')) return 'España / Latam';
    return 'Desconocida';
  }
  
  const parts = tz.split('/');
  const city = parts[parts.length - 1]?.replace(/_/g, ' ') || '';

  const countryMap: Record<string, string> = {
    'Buenos_Aires': 'Argentina',
    'Cordoba': 'Argentina',
    'Mendoza': 'Argentina',
    'Catamarca': 'Argentina',
    'Jujuy': 'Argentina',
    'Ushuaia': 'Argentina',
    'Santiago': 'Chile',
    'Montevideo': 'Uruguay',
    'Asuncion': 'Paraguay',
    'Bogota': 'Colombia',
    'Lima': 'Perú',
    'Caracas': 'Venezuela',
    'Mexico_City': 'México',
    'Cancun': 'México',
    'Guadalajara': 'México',
    'Monterrey': 'México',
    'Madrid': 'España',
    'New_York': 'EE.UU. (EST)',
    'Los_Angeles': 'EE.UU. (PST)',
    'Chicago': 'EE.UU. (CST)',
    'Miami': 'EE.UU.',
    'Sao_Paulo': 'Brasil',
    'La_Paz': 'Bolivia',
    'Quito': 'Ecuador',
    'Panama': 'Panamá',
    'San_Jose': 'Costa Rica',
    'Guatemala': 'Guatemala',
    'San_Salvador': 'El Salvador',
    'Tegucigalpa': 'Honduras',
    'Managua': 'Nicaragua',
    'Santo_Domingo': 'Rep. Dominicana',
    'London': 'Reino Unido',
    'Paris': 'Francia',
    'Rome': 'Italia',
    'Berlin': 'Alemania'
  };

  const matchedCountry = countryMap[parts[parts.length - 1]];
  if (matchedCountry) {
    return `${matchedCountry} (${city})`;
  }

  return `${city || tz}`;
}

function parseUserAgentDetails(rawUa: string | undefined, body: any) {
  const ua = body?.userAgent || rawUa || "";
  const lower = ua.toLowerCase();
  
  let os = "Desconocido";
  let deviceType = "💻 PC / Escritorio";
  
  if (lower.includes("android")) {
    os = "Android";
    deviceType = lower.includes("mobile") ? "📱 Móvil (Android)" : "📱 Tablet (Android)";
    const match = ua.match(/Android\s+([0-9\.]+)/i);
    if (match) os = `Android ${match[1]}`;
  } else if (lower.includes("iphone")) {
    os = "iOS (iPhone)";
    deviceType = "📱 Móvil (iPhone)";
    const match = ua.match(/OS\s+([0-9_]+)/i);
    if (match) os = `iOS ${match[1].replace(/_/g, '.')}`;
  } else if (lower.includes("ipad")) {
    os = "iPadOS";
    deviceType = "📱 Tablet (iPad)";
    const match = ua.match(/OS\s+([0-9_]+)/i);
    if (match) os = `iPadOS ${match[1].replace(/_/g, '.')}`;
  } else if (lower.includes("macintosh") || lower.includes("mac os")) {
    os = "macOS";
    deviceType = "💻 Mac";
    const match = ua.match(/Mac OS X\s+([0-9_\.]+)/i);
    if (match) os = `macOS ${match[1].replace(/_/g, '.')}`;
  } else if (lower.includes("windows")) {
    os = "Windows";
    deviceType = "💻 PC (Windows)";
    if (lower.includes("nt 10.0")) os = "Windows 10/11";
    else if (lower.includes("nt 6.3")) os = "Windows 8.1";
    else if (lower.includes("nt 6.1")) os = "Windows 7";
  } else if (lower.includes("linux")) {
    os = "Linux";
    deviceType = "💻 PC (Linux)";
  }

  let browser = "Navegador Web";
  if (lower.includes("edg/")) {
    const match = ua.match(/Edg\/([0-9\.]+)/);
    browser = `Edge ${match ? match[1].split('.')[0] : ''}`;
  } else if (lower.includes("samsungbrowser")) {
    const match = ua.match(/SamsungBrowser\/([0-9\.]+)/);
    browser = `Samsung Internet ${match ? match[1].split('.')[0] : ''}`;
  } else if (lower.includes("chrome") || lower.includes("crios")) {
    const match = ua.match(/(?:Chrome|CriOS)\/([0-9\.]+)/);
    browser = `Chrome ${match ? match[1].split('.')[0] : ''}`;
  } else if (lower.includes("firefox") || lower.includes("fxios")) {
    const match = ua.match(/(?:Firefox|FxiOS)\/([0-9\.]+)/);
    browser = `Firefox ${match ? match[1].split('.')[0] : ''}`;
  } else if (lower.includes("safari") && !lower.includes("chrome") && !lower.includes("android")) {
    const match = ua.match(/Version\/([0-9\.]+)/);
    browser = `Safari ${match ? match[1].split('.')[0] : ''}`;
  }

  const screenRes = body?.screenRes || "No especificada";
  const language = body?.language || "es";
  const location = getLocationFromTimezone(body?.timezone, language);
  const deviceInfoSummary = `${deviceType} • ${os} (${browser})`;

  return {
    os,
    browser,
    deviceType,
    deviceInfo: deviceInfoSummary,
    screenRes,
    language,
    location,
    userAgent: ua
  };
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
  app.use(express.urlencoded({ extended: true }));

  // Anti-caching middleware for all /api requests
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  });

  // API Routes
  app.get(["/api/visits", "/api/visits/"], (req, res) => {
    res.json(currentStats);
  });

  app.post(["/api/visits/record", "/api/visits/record/"], (req, res) => {
    try {
      const isNewSession = req.body?.isNewSession ?? true;
      const ua = req.headers["user-agent"];
      const clientDetails = parseUserAgentDetails(ua, req.body);

      // Extract client IP with fallback priority
      let clientIp = req.body?.clientIp;
      if (!clientIp || typeof clientIp !== "string" || clientIp === "127.0.0.1" || clientIp === "::1") {
        const xForwardedFor = req.headers["x-forwarded-for"];
        if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
          clientIp = xForwardedFor.split(",")[0].trim();
        } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
          clientIp = xForwardedFor[0].split(",")[0].trim();
        } else {
          const xRealIp = req.headers["x-real-ip"] || req.headers["cf-connecting-ip"];
          if (typeof xRealIp === "string" && xRealIp.trim()) {
            clientIp = xRealIp.split(",")[0].trim();
          } else if (Array.isArray(xRealIp) && xRealIp.length > 0) {
            clientIp = xRealIp[0].trim();
          } else {
            clientIp = req.socket?.remoteAddress || req.ip || "127.0.0.1";
          }
        }
      }

      if (typeof clientIp === "string" && clientIp.startsWith("::ffff:")) {
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
        deviceInfo: clientDetails.deviceInfo,
        ip: clientIp || "127.0.0.1",
        browser: clientDetails.browser,
        os: clientDetails.os,
        screenRes: clientDetails.screenRes,
        language: clientDetails.language,
        location: clientDetails.location,
        userAgent: clientDetails.userAgent
      };

      const updatedHistory = [newEntry, ...(currentStats.history || [])].slice(0, 500);

      currentStats = {
        totalVisits: (currentStats.totalVisits || 0) + 1,
        lastVisit: Date.now(),
        sessionVisits: (currentStats.sessionVisits || 0) + (isNewSession ? 1 : 0),
        history: updatedHistory
      };

      saveStats(currentStats);
      console.log(`[VISIT LOGGED] #${currentStats.totalVisits} | IP: ${newEntry.ip} | Device: ${newEntry.deviceInfo} | Loc: ${newEntry.location}`);
      res.json(currentStats);
    } catch (err) {
      console.error("Error recording visit:", err);
      res.status(500).json({ error: "Failed to record visit", stats: currentStats });
    }
  });

  app.post(["/api/visits/reset", "/api/visits/reset/"], (req, res) => {
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
