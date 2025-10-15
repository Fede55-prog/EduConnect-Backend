// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");

const { ensureDatabase } = require("./db_bootstrap");
const { initDb } = require("./db_init");
const authMiddleware = require("./middleware/authMiddleware");

// Routes…
const authRoutes = require("./routes/auth");
const studyMaterialRoutes = require("./routes/studyMaterials");
const discussionsRoutes = require("./routes/discussions");
const usersRoutes = require("./routes/users");
const { router: messagesRoutes, setSocket } = require("./routes/messages");
const notificationsRoutes = require("./routes/notifications");
const subscriptionsRoutes = require("./routes/subscriptions");
const modulesRoutes = require("./routes/modules");
const departmentsRoutes = require("./routes/departments");

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

/* --------- CORS: allow localhost:3000 & 5500 by default --------- */
const defaultOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5500", "http://127.0.0.1:5500"];
const envOrigin = process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigin]));

app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(UPLOAD_DIR));

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/dashboard.html", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "dashboard.html"));
});

app.get(["/study-materials.html", "/notifications.html", "/profile.html"], authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", req.path));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST", "PUT", "DELETE"] },
});
app.use((req, res, next) => { req.io = io; next(); });

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/study-materials", studyMaterialRoutes);
app.use("/api/discussions", discussionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/modules", modulesRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/saved", require("./routes/saved"));

app.get("/", (_, res) => res.send("PeerConnect Backend with Socket.IO is running"));
setSocket(io);

io.on("connection", (socket) => {
  console.log(" New client connected:", socket.id);
  socket.on("join_conversation", (conversationId) => socket.join(`conversation_${conversationId}`));
  socket.on("disconnect", () => {});
});

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await ensureDatabase();
    await initDb();
    server.listen(PORT, () => {
      console.log(` Server + Socket.IO on ${PORT}`);
      console.log(` Allowed origins:`, allowedOrigins.join(", "));
    });
  } catch (err) {
    console.error(" Startup error:", err);
    process.exit(1);
  }
})();










