// backend/routes/studyMaterials.js
const express = require("express");
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded files statically
router.use("/uploads", express.static(uploadsDir));

/* ---------------- Multer config ---------------- */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
]);

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_, file, cb) => cb(null, allowedTypes.has(file.mimetype)),
});

/* ---------------- LIST with pagination (public) ---------------- */
router.get("/", async (req, res) => {
  const { search, module, type, year, sort, page = 1, limit = 10 } = req.query;

  let where = "WHERE 1=1";
  const vals = [];
  let i = 1;

  if (search) {
    where += ` AND (LOWER(sm.title) LIKE $${i} OR LOWER(sm.description) LIKE $${i} OR LOWER(sm.module) LIKE $${i})`;
    vals.push(`%${String(search).toLowerCase()}%`);
    i++;
  }
  if (module) { where += ` AND sm.module = $${i}`; vals.push(module); i++; }
  if (type)   { where += ` AND sm.type = $${i}`;   vals.push(type);   i++; }
  if (year)   { where += ` AND sm.year = $${i}`;   vals.push(year);   i++; }

  const orderBy = sort === "popular" ? "sm.downloads DESC" : "sm.uploaded_at DESC";

  const countSql = `
    SELECT COUNT(*)::int AS c
    FROM study_materials sm
    ${where}
  `;

  const offset = (Number(page) - 1) * Number(limit);
  const listSql = `
    SELECT
      sm.*,
      s.first_name || ' ' || s.last_name AS uploader_name,
      s.stu_email AS uploader_email
    FROM study_materials sm
    LEFT JOIN student s ON sm.uploader_id = s.stu_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${i} OFFSET $${i + 1}
  `;

  try {
    const countRes = await pool.query(countSql, vals);
    const totalCount = countRes.rows[0].c;

    const listVals = vals.slice();
    listVals.push(Number(limit), Number(offset));
    const listRes = await pool.query(listSql, listVals);

    res.json({
      success: true,
      materials: listRes.rows,
      page: Number(page),
      totalPages: Math.max(1, Math.ceil(totalCount / Number(limit))),
      totalCount,
    });
  } catch (err) {
    console.error("Error fetching study materials:", err);
    res.status(500).json({ success: false, message: "Error fetching study materials" });
  }
});

/* ---------------- Can I download? (auth) ---------------- */
router.get("/me/status", authMiddleware, async (req, res) => {
  try {
    const stuId = req.user?.id || req.user?.stu_id || req.user?.studentNumber;
    if (!stuId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const rs = await pool.query(
      "SELECT COUNT(*)::int AS c FROM study_uploads WHERE stu_id = $1",
      [stuId]
    );
    res.json({ success: true, can_download: rs.rows[0].c > 0, uploaded_count: rs.rows[0].c });
  } catch (e) {
    console.error("Status check error:", e);
    res.status(500).json({ success: false, message: "Status check failed" });
  }
});

/* ---------------- Upload (auth) ---------------- */
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  const { title, module, year, type, description, link } = req.body;
  const stuId = req.user?.id || req.user?.stu_id || null;

  if (!stuId) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (!title || !module || !year || !type) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const hasFile = !!req.file;
  const hasLink = !!(link && link.trim() !== "");
  if (hasFile && hasLink) return res.status(400).json({ success: false, message: "Provide a file OR a link, not both." });
  if (!hasFile && !hasLink) return res.status(400).json({ success: false, message: "Please provide a file or a link." });

  const fileUrl = hasFile ? `/uploads/${req.file.filename}` : link.trim();

  try {
    const ins = await pool.query(
      `INSERT INTO study_materials
        (title, module, year, type, description, file_url, downloads, uploaded_at, uploader_id)
       VALUES ($1,$2,$3,$4,$5,$6,0,NOW(),$7)
       RETURNING *`,
      [title, module, year, type, description || "", fileUrl, stuId]
    );

    // Mark this student as having uploaded at least once
    await pool.query(
      `INSERT INTO study_uploads (stu_id, uploaded_at)
       VALUES ($1, NOW())
       ON CONFLICT (stu_id) DO NOTHING`,
      [stuId]
    );

    // Optional notification
    try {
      await pool.query(
        `INSERT INTO notifications (type, ref_id, message)
         VALUES ($1,$2,$3)`,
        ["material", ins.rows[0].id, `📘 New study material uploaded: ${ins.rows[0].title}`]
      );
      if (req.io) {
        req.io.emit("new_notification", {
          type: "material",
          ref_id: ins.rows[0].id,
          message: `📘 New study material uploaded: ${ins.rows[0].title}`,
          created_at: new Date().toISOString(),
          read: false,
        });
      }
    } catch (e) {
      console.warn("Notification insert failed:", e.message);
    }

    res.json({ success: true, material: ins.rows[0] });
  } catch (err) {
    console.error("Error uploading study material:", err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: "Error uploading study material" });
  }
});

/* ---------------- Download (auth; accepts ?token=) ---------------- */
router.get("/download/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const stuId = req.user?.id || req.user?.stu_id || null;

  try {
    if (!stuId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Student ID missing from token." });
    }

    // Must have uploaded at least once
    const up = await pool.query("SELECT COUNT(*)::int AS c FROM study_uploads WHERE stu_id=$1", [stuId]);
    if (up.rows[0].c === 0) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Upload at least one study material to unlock downloads.",
      });
    }

    const r = await pool.query("SELECT * FROM study_materials WHERE id=$1", [id]);
    if (!r.rows.length) return res.status(404).json({ success: false, message: "File not found" });

    const material = r.rows[0];
    if (!material.file_url) return res.status(400).json({ success: false, message: "No file uploaded" });

    // Increment downloads
    await pool.query("UPDATE study_materials SET downloads = downloads + 1 WHERE id=$1", [id]);

    // External link: redirect
    if (/^https?:\/\//i.test(material.file_url)) {
      return res.redirect(material.file_url);
    }

    // Local file
    const filePath = path.join(__dirname, "..", material.file_url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found on server" });
    }

    res.download(filePath, path.basename(filePath));
  } catch (err) {
    console.error("Error downloading material:", err);
    res.status(500).json({ success: false, message: "Error downloading material" });
  }
});

module.exports = router;

