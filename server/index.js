import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { MongoClient } from "mongodb";

import { players, RATING_STATS } from "../src/data.js";
import {
  POINTS_PER_PLAYER,
  TOTAL_POINTS,
  costOfPlayer,
  spent,
} from "../src/voting/voteRules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });
dotenv.config({ path: path.join(ROOT, "deploy.env") });

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/avergas";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const secretKey = new TextEncoder().encode(SESSION_SECRET);
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const STAT_KEYS = new Set(RATING_STATS.map((stat) => stat.key));
const PLAYER_NAMES = new Set(players.map((player) => player.name));

function cookieOpts(req, maxAge) {
  const proto = req.headers["x-forwarded-proto"];
  const secure = req.secure || proto === "https";
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge,
  };
}

function publicUser(doc) {
  if (!doc) return null;
  return {
    id: doc.googleId,
    name: doc.name,
    email: doc.email,
    picture: doc.picture || "",
  };
}

async function signSession(user) {
  return new SignJWT({
    sub: user.googleId,
    name: user.name,
    email: user.email,
    picture: user.picture || "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secretKey);
}

async function readSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return {
      googleId: String(payload.sub || ""),
      name: String(payload.name || ""),
      email: String(payload.email || ""),
      picture: String(payload.picture || ""),
    };
  } catch {
    return null;
  }
}

function cleanVotes(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const votes = {};
  for (const [name, deltas] of Object.entries(raw)) {
    if (!PLAYER_NAMES.has(name) || !deltas || typeof deltas !== "object") continue;
    const next = {};
    for (const [key, value] of Object.entries(deltas)) {
      if (!STAT_KEYS.has(key)) continue;
      const amount = Number(value);
      if (!Number.isInteger(amount) || amount === 0) continue;
      next[key] = amount;
    }
    if (costOfPlayer(next) > POINTS_PER_PLAYER) {
      const error = new Error(`Máximo ${POINTS_PER_PLAYER} puntos por jugador`);
      error.status = 400;
      throw error;
    }
    if (Object.keys(next).length) votes[name] = next;
  }
  if (spent(votes) > TOTAL_POINTS) {
    const error = new Error("No te quedan puntos");
    error.status = 400;
    throw error;
  }
  return votes;
}

function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function seedPlayers(col) {
  const count = await col.countDocuments();
  if (count > 0) return;
  await col.insertMany(players.map((player) => ({
    name: player.name,
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defense: player.defense,
    physical: player.physical,
    phrase: player.phrase,
    lore: player.lore || null,
    lineupOnly: Boolean(player.lineupOnly),
  })));
}

async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  let dbName = process.env.MONGODB_DB || "";
  if (!dbName) {
    try {
      dbName = new URL(MONGODB_URI).pathname.replace(/^\//, "").split("/")[0];
    } catch {
      dbName = "";
    }
  }
  const db = client.db(dbName || "avergas");
  const users = db.collection("users");
  const ballots = db.collection("ballots");
  const playerCol = db.collection("players");

  await users.createIndex({ googleId: 1 }, { unique: true });
  await ballots.createIndex({ googleId: 1 }, { unique: true });
  await playerCol.createIndex({ name: 1 }, { unique: true });
  await seedPlayers(playerCol);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use(ah(async (req, _res, next) => {
    req.user = await readSession(req.cookies.avergas_session);
    next();
  }));

  function requireUser(req, res, next) {
    if (!req.user?.googleId) {
      res.status(401).json({ error: "Entrá con Google para puntuar" });
      return;
    }
    next();
  }

  app.get("/api/health", ah(async (_req, res) => {
    await db.command({ ping: 1 });
    res.json({ ok: true, google: Boolean(GOOGLE_CLIENT_ID) });
  }));

  app.get("/api/config", (_req, res) => {
    res.json({ googleClientId: GOOGLE_CLIENT_ID });
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
  });

  app.post("/api/auth/google", ah(async (req, res) => {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      res.status(503).json({ error: "Falta configurar GOOGLE_CLIENT_ID" });
      return;
    }
    const credential = String(req.body?.credential || "");
    if (!credential) {
      res.status(400).json({ error: "No llegó el login de Google" });
      return;
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      res.status(401).json({ error: "Google no validó la sesión" });
      return;
    }
    const user = {
      googleId: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email || "Jugador",
      picture: payload.picture || "",
      updatedAt: new Date(),
    };
    await users.updateOne(
      { googleId: user.googleId },
      { $set: user, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    const token = await signSession(user);
    res.cookie("avergas_session", token, cookieOpts(req, 1000 * 60 * 60 * 24 * 30));
    res.json({ user: publicUser(user) });
  }));

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("avergas_session", cookieOpts(req, 0));
    res.json({ ok: true });
  });

  app.get("/api/votes", ah(async (req, res) => {
    const rows = await ballots.find({}).project({ _id: 0, googleId: 1, votes: 1 }).toArray();
    const mine = req.user
      ? rows.find((row) => row.googleId === req.user.googleId)
      : null;
    res.json({
      user: req.user ? publicUser(req.user) : null,
      myVotes: mine?.votes || {},
      ballots: rows.map((row) => row.votes || {}),
      voters: rows.length,
    });
  }));

  app.put("/api/votes", requireUser, ah(async (req, res) => {
    const votes = cleanVotes(req.body?.votes);
    await ballots.updateOne(
      { googleId: req.user.googleId },
      {
        $set: {
          googleId: req.user.googleId,
          name: req.user.name,
          email: req.user.email,
          votes,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    res.json({ ok: true, votes });
  }));

  app.delete("/api/votes", requireUser, ah(async (req, res) => {
    await ballots.deleteOne({ googleId: req.user.googleId });
    res.json({ ok: true, votes: {} });
  }));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Algo salió mal" });
  });

  app.listen(PORT, HOST, () => {
    console.log(`Averga's API en http://${HOST}:${PORT}`);
    if (!GOOGLE_CLIENT_ID) console.warn("Falta GOOGLE_CLIENT_ID en deploy.env");
  });
}

start().catch((err) => {
  console.error("No se pudo iniciar:", err);
  process.exit(1);
});
