import express from "express";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Database ──────────────────────────────────────────────────────────────────

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const photoSchema = new mongoose.Schema({
  s3Key: { type: String, required: true },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  createdAt: { type: Date, default: Date.now },
});

photoSchema.index({ location: "2dsphere" });
photoSchema.index({ createdAt: 1 }, { expireAfterSeconds: 43200 }); // 12-hour TTL

const Photo = mongoose.model("Photo", photoSchema);

// ── Config ────────────────────────────────────────────────────────────────────

const BUCKET = process.env.S3_BUCKET || "nikola-shop-uploads-554433";
const MAX_FILE_SIZE_MB = 10;
const MAX_ACTIVE_PHOTOS = 500; // global cap across all users

// ── Helpers ───────────────────────────────────────────────────────────────────

// Verify the file is actually an image by checking its magic bytes
function isRealImage(buffer) {
  if (buffer.length < 12) return false;
  const jpg  = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const png  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const gif  = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
  const webp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46
            && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  return jpg || png || gif || webp;
}

function isValidCoords(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();

// Security headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Leaflet tiles load

// 10 uploads per IP per 15 minutes
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many uploads. Try again in 15 minutes." },
});

// 50 uploads per IP per day
const dailyUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 50,
  message: { error: "Daily upload limit reached. Try again tomorrow." },
});

// 60 GET requests per IP per minute (prevents presigned URL flooding)
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "Too many requests." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.toLowerCase().startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });

// ── SSE (real-time push to clients) ───────────────────────────────────────────

const sseClients = new Set();

function broadcastNewPhoto() {
  for (const client of sseClients) {
    client.write("event: new-photo\ndata: {}\n\n");
  }
}

// ── Static files ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, "client/dist")));

// ── API routes ────────────────────────────────────────────────────────────────

app.post(
  "/api/photos",
  uploadLimiter,
  dailyUploadLimiter,
  upload.single("image"),
  async (req, res) => {
    try {
      const lat = parseFloat(req.body.lat);
      const lng = parseFloat(req.body.lng);

      if (isNaN(lat) || isNaN(lng) || !isValidCoords(lat, lng)) {
        return res.status(400).json({ error: "Valid coordinates required." });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Image required." });
      }

      // Reject files that are not real images (magic bytes check)
      if (!isRealImage(req.file.buffer)) {
        return res.status(400).json({ error: "File is not a valid image." });
      }

      // Reject if map is at capacity
      const activeCount = await Photo.countDocuments();
      if (activeCount >= MAX_ACTIVE_PHOTOS) {
        return res.status(503).json({ error: "Map is currently full. Try again later." });
      }

      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `photos/${Date.now()}-${safeName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      const photo = await Photo.create({
        s3Key: key,
        location: { type: "Point", coordinates: [lng, lat] },
      });

      broadcastNewPhoto();
      res.json({ success: true, id: photo._id });
    } catch (err) {
      console.error(err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: `File too large. Max ${MAX_FILE_SIZE_MB}MB.` });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 25_000);
  sseClients.add(res);
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.get("/api/photos", readLimiter, async (_req, res) => {
  try {
    const photos = await Photo.find().lean();

    const result = await Promise.all(
      photos.map(async (p) => ({
        id: p._id,
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
        url: await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET, Key: p.s3Key }),
          { expiresIn: 3600 }
        ),
        createdAt: p.createdAt,
        expiresAt: new Date(p.createdAt.getTime() + 12 * 60 * 60 * 1000),
      }))
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback — must be last (Express v5 requires named wildcard)
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

// Global error handler — always returns JSON, never HTML
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `File too large. Max ${MAX_FILE_SIZE_MB}MB.` });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
