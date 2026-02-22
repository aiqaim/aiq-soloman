import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./src/db.ts";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for models
const CHAT_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers - Relaxed for AI Studio iframe compatibility
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "https://picsum.photos", "https://placehold.co", "https://*.googleusercontent.com"],
        "connect-src": ["'self'", "https://*.run.app", "ws://*.run.app", "https://generativelanguage.googleapis.com", "https://*.googleapis.com"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "frame-ancestors": ["'self'", "https://*.google.com", "https://*.run.app"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
  }));

  // Rate limiting to prevent abuse
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: "SoloMan is a bit tired! Please wait a few minutes before asking again. 😴" }
  });

  app.use("/api/", limiter);
  app.use(express.json({ limit: '10mb' }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Load licenses
  let validKeys = new Set<string>();
  try {
    const licensesPath = path.join(__dirname, 'src', 'licenses.json');
    console.log(`Loading licenses from: ${licensesPath}`);
    if (fs.existsSync(licensesPath)) {
      const licenseData = JSON.parse(fs.readFileSync(licensesPath, 'utf8'));
      validKeys = new Set(licenseData.keys);
      console.log(`Loaded ${validKeys.size} valid license keys`);
    } else {
      console.error(`Licenses file not found at ${licensesPath}`);
    }
  } catch (err) {
    console.error("Failed to load licenses:", err);
  }

  // The gatekeeper middleware
  app.use(['/api/chat', '/api/chat/*'], (req, res, next) => {
    const userKeyHeader = req.headers['x-license-key'];
    const userKey = Array.isArray(userKeyHeader) ? userKeyHeader[0] : userKeyHeader;

    if (!userKey || !validKeys.has(userKey)) {
      return res.status(403).json({ 
        error: "SoloMan is sleeping! Please provide a valid license key to wake him up." 
      });
    }
    next(); // Key is valid, proceed to Gemini 3 Flash
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      ai_configured: !!process.env.GEMINI_API_KEY,
      db_connected: !!db
    });
  });

  // Task Routes
  app.get("/api/tasks", (req, res) => {
    try {
      console.log("Fetching tasks...");
      let tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
      
      if (tasks.length === 0) {
        const initialMissions = [
          { title: "Say hi to SoloMan in Chat! 👋", description: "Start your first conversation." },
          { title: "Ask for an avatar of a Dragon! 🐉", description: "Use 'show me' in chat." },
          { title: "Complete your first mission! 🏆", description: "Click the circle to finish." }
        ];
        for (const m of initialMissions) {
          db.prepare("INSERT INTO tasks (title, description) VALUES (?, ?)").run(m.title, m.description);
        }
        tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
      }
      
      console.log(`Found ${tasks.length} tasks`);
      res.json(tasks);
    } catch (err) {
      console.error("Database Error (tasks):", err);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", (req, res) => {
    try {
      const { title, description } = req.body;
      console.log("Adding task:", title);
      const info = db.prepare("INSERT INTO tasks (title, description) VALUES (?, ?)").run(title, description);
      res.json({ id: info.lastInsertRowid, title, description, status: 'pending' });
    } catch (err) {
      console.error("Database Error (add task):", err);
      res.status(500).json({ error: "Failed to add task" });
    }
  });

  app.patch("/api/tasks/:id", (req, res) => {
    try {
      const { status } = req.body;
      console.log(`Updating task ${req.params.id} to ${status}`);
      db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (update task):", err);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", (req, res) => {
    try {
      console.log(`Deleting task ${req.params.id}`);
      db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (delete task):", err);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Chat Routes
  app.get("/api/chat", (req, res) => {
    try {
      console.log("Fetching chat history...");
      let history = db.prepare("SELECT role, content FROM chat_history ORDER BY timestamp ASC").all();
      
      if (history.length === 0) {
        const welcome = "Hi there! I'm SoloMan, your AI best friend! 🚀 I'm here to help you with your missions and show you cool avatars. What's your name?";
        db.prepare("INSERT INTO chat_history (role, content) VALUES (?, ?)").run('model', welcome);
        history = [{ role: 'model', content: welcome }];
      }
      
      res.json(history);
    } catch (err) {
      console.error("Database Error (chat):", err);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  app.post("/api/chat/save", (req, res) => {
    try {
      const { role, content } = req.body;
      if (!role || !content) return res.status(400).json({ error: "Missing role or content" });
      db.prepare("INSERT INTO chat_history (role, content) VALUES (?, ?)").run(role, content);
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (save chat):", err);
      res.status(500).json({ error: "Failed to save chat message" });
    }
  });

  app.delete("/api/chat", (req, res) => {
    try {
      console.log("Clearing chat history...");
      db.prepare("DELETE FROM chat_history").run();
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (clear chat):", err);
      res.status(500).json({ error: "Failed to clear chat history" });
    }
  });

  // Gallery Routes
  app.post("/api/gallery/upload", (req, res) => {
    try {
      const { imageUrl, prompt, type } = req.body;
      if (!imageUrl) return res.status(400).json({ error: "Missing imageUrl" });
      console.log("Saving image to gallery...");
      db.prepare("INSERT INTO gallery (type, url, prompt) VALUES (?, ?, ?)").run(type || 'uploaded', imageUrl, prompt || null);
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (upload):", err);
      res.status(500).json({ error: "Failed to save image" });
    }
  });

  app.get("/api/gallery", (req, res) => {
    try {
      console.log("Fetching gallery...");
      const images = db.prepare("SELECT * FROM gallery ORDER BY timestamp DESC").all();
      res.json(images);
    } catch (err) {
      console.error("Database Error (gallery):", err);
      res.status(500).json({ error: "Failed to fetch gallery" });
    }
  });

  app.delete("/api/gallery/:id", (req, res) => {
    try {
      console.log(`Deleting gallery image ${req.params.id}`);
      db.prepare("DELETE FROM gallery WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (delete gallery):", err);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Server Error:", err);
    res.status(err.status || 500).json({ 
      error: "SoloMan's brain had a hiccup! 🧠",
      details: err.message || "Unknown error"
    });
  });
}

startServer();
