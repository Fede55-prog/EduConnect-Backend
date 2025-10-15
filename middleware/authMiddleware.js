// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  try {
    let token = null;

    // 1) Standard: Authorization: Bearer <token>
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2) Cookie fallback
    if (!token && req.cookies && req.cookies.peerconnect_auth) {
      token = req.cookies.peerconnect_auth;
    }

    // 3) Query param fallback (for <a> download links)
    if (!token && req.query && typeof req.query.token === "string" && req.query.token.trim() !== "") {
      token = req.query.token.trim();
    }

    // If no token → handle page vs API differently
    if (!token) {
      if (req.originalUrl.includes("/dashboard")) {
        return res.redirect("http://localhost:3000/log-in.html");
      }
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info (contains id, studentNumber, email, etc.)
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);

    if (req.originalUrl.includes("/dashboard")) {
      return res.redirect("http://localhost:3000/log-in.html");
    }
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
