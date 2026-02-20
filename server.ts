import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import db from "./src/db.ts";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
          { title: "Ask for a picture of a Dragon! 🐉", description: "Use 'show me' in chat." },
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
        const welcome = "Hi there! I'm SoloMan, your AI best friend! 🚀 I'm here to help you with your missions and show you cool pictures. What's your name?";
        db.prepare("INSERT INTO chat_history (role, content) VALUES (?, ?)").run('model', welcome);
        history = [{ role: 'model', content: welcome }];
      }
      
      res.json(history);
    } catch (err) {
      console.error("Database Error (chat):", err);
      res.status(500).json({ error: "Failed to fetch chat history" });
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

  app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing from environment");
      return res.status(500).json({ error: "AI configuration error" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = "gemini-3-flash-preview";
    
    // Save user message
    db.prepare("INSERT INTO chat_history (role, content) VALUES (?, ?)").run('user', message);

    try {
      // Get history for context - limit to last 6 messages to keep it focused
      const history = db.prepare("SELECT role, content FROM chat_history ORDER BY timestamp DESC LIMIT 6").all().reverse();
      
      const contents = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: "You are SoloMan, a super friendly, enthusiastic, and loveable AI mentor for kids aged 6-15! You live in a high-tech quantum portal. Your goal is to be their best friend, encourage their curiosity, and help them with missions. If they ask for a picture, describe it with wonder and excitement. Use lots of emojis! Keep your answers short, fun, and very positive. Never be mean or boring!",
          temperature: 0.9,
          topP: 0.95,
        }
      });

      const aiResponse = response.text?.trim();
      
      if (!aiResponse) {
        console.error("Gemini returned empty text:", response);
        throw new Error("Empty response from AI");
      }
      
      // Save AI response
      db.prepare("INSERT INTO chat_history (role, content) VALUES (?, ?)").run('model', aiResponse);

      res.json({ response: aiResponse });
    } catch (error) {
      console.error("Gemini Error:", error);
      const fallback = "Oops! My super-brain had a little hiccup. 🧠 Can you say that again? I'm ready to help!";
      res.json({ response: fallback });
    }
  });

  app.post("/api/gallery/upload", express.json({ limit: '10mb' }), (req, res) => {
    try {
      const { imageUrl } = req.body;
      console.log("Uploading image to gallery...");
      db.prepare("INSERT INTO gallery (type, url) VALUES (?, ?)").run('uploaded', imageUrl);
      res.json({ success: true });
    } catch (err) {
      console.error("Database Error (upload):", err);
      res.status(500).json({ error: "Failed to upload image" });
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
  app.post("/api/edit-image", async (req, res) => {
    const { prompt, base64Image } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI configuration error" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Extract the base64 data and mime type
      const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      const mimeType = matches[1];
      const data = matches[2];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data,
                mimeType,
              },
            },
            {
              text: `Apply this edit to the image: ${prompt}. Keep it fun and kid-friendly!`,
            },
          ],
        },
      });

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        // Save to gallery
        db.prepare("INSERT INTO gallery (type, url, prompt) VALUES (?, ?, ?)").run('generated', imageUrl, `Edit: ${prompt}`);
        res.json({ imageUrl });
      } else {
        res.status(500).json({ error: "Failed to edit image" });
      }
    } catch (error) {
      console.error("Image Editing Error:", error);
      res.status(500).json({ error: "Failed to edit image" });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    const { prompt } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI configuration error" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A vibrant, high-quality, futuristic and kid-friendly 3D illustration of: ${prompt}. The style should be modern, colorful, and full of energy, similar to a high-end animated movie. No text in the image.` }]
        }
      });

      let imageUrl = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        // Save to gallery
        db.prepare("INSERT INTO gallery (type, url, prompt) VALUES (?, ?, ?)").run('generated', imageUrl, prompt);
        res.json({ imageUrl });
      } else {
        res.status(500).json({ error: "Failed to generate image" });
      }
    } catch (error) {
      console.error("Image Generation Error:", error);
      res.status(500).json({ error: "Failed to generate image" });
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
}

startServer();
