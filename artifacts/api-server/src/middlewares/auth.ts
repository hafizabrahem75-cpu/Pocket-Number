import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyToken } from "../lib/jwt";

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
  userRole?: "user" | "admin";
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Look up role/suspension fresh on every request rather than trusting the
  // JWT — a suspended or role-changed account must be blocked immediately,
  // not only after the token expires.
  const [user] = await db
    .select({ role: usersTable.role, isSuspended: usersTable.isSuspended })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId));

  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "تم تعليق هذا الحساب" });
    return;
  }

  req.userId = payload.userId;
  req.userEmail = payload.email;
  req.userRole = user.role;
  next();
}

/**
 * Must run after `requireAuth`. Restricts access to users with the "admin"
 * role — used for the entire /admin namespace.
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
