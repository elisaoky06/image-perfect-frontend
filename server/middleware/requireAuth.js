import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export function requireAuth(roles) {
  const allowed = Array.isArray(roles) ? roles : roles ? [roles] : null;

  return async function requireAuthMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user) {
        return res.status(401).json({ error: "Invalid session" });
      }
      if (allowed && !allowed.includes(user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      req.user = user;
      req.tokenPayload = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}
