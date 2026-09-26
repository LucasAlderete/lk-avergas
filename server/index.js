import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { MongoClient, ObjectId } from "mongodb";

import { isAdminEmail } from "../src/auth/admin.js";
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
    isAdmin: isAdminEmail(doc.email),
  };
}

function dayKeyAR(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function publicMatch(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    status: doc.status,
    day: doc.day,
    players: doc.players || [],
    mode: doc.mode || 5,
    createdAt: doc.createdAt,
    closedAt: doc.closedAt || null,
  };
}

function matchObjectId(id) {
  const value = String(id || "");
  if (!/^[a-fA-F0-9]{24}$/.test(value)) return null;
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

function cleanPlayerList(raw) {
  const names = [];
  const seen = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = String(item || "").trim();
    if (!PLAYER_NAMES.has(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
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

function cleanVotes(raw, allowedNames) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const votes = {};
  for (const [name, deltas] of Object.entries(raw)) {
    if (!PLAYER_NAMES.has(name) || !deltas || typeof deltas !== "object") continue;
    if (allowedNames && !allowedNames.has(name)) {
      const error = new Error("Solo se puntúa a los que jugaron este partido");
      error.status = 400;
      throw error;
    }
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
  const count = await col.countDocuments({ name: { $type: "string", $ne: "" } });
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

async function ensurePlayerNameIndex(col) {
  await col.deleteMany({
    $or: [{ name: null }, { name: { $exists: false } }, { name: "" }],
  });
  try {
    await col.dropIndex("name_1");
  } catch (err) {
    if (err.code !== 27 && err.codeName !== "IndexNotFound") throw err;
  }
  await col.createIndex({ name: 1 }, { unique: true });
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
  const matches = db.collection("matches");

  await users.createIndex({ googleId: 1 }, { unique: true });
  try {
    const ballotIndexes = await ballots.indexes();
    for (const index of ballotIndexes) {
      const key = index.key || {};
      if (index.unique && key.googleId === 1 && key.matchId == null) {
        await ballots.dropIndex(index.name);
      }
    }
  } catch (err) {
    if (err.code !== 26) throw err;
  }
  await ballots.createIndex({ matchId: 1, googleId: 1 }, { unique: true });
  await ensurePlayerNameIndex(playerCol);
  await matches.createIndex({ status: 1, createdAt: -1 });
  await seedPlayers(playerCol);

  async function expireOpenMatches() {
    const today = dayKeyAR();
    await matches.updateMany(
      { status: "open", day: { $ne: today } },
      { $set: { status: "closed", closedAt: new Date(), closedReason: "day-end" } },
    );
  }

  async function currentOpenMatch() {
    await expireOpenMatches();
    return matches.findOne({ status: "open" }, { sort: { createdAt: -1 } });
  }

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

  function requireAdmin(req, res, next) {
    if (!req.user?.googleId) {
      res.status(401).json({ error: "Entrá con Google" });
      return;
    }
    if (!isAdminEmail(req.user.email)) {
      res.status(403).json({ error: "Sólo el admin puede abrir o cerrar partidos" });
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
    const open = await currentOpenMatch();
    const matchId = open ? String(open._id) : null;
    const rows = await ballots.find({}).project({ _id: 0, googleId: 1, votes: 1, matchId: 1 }).toArray();
    const mine = matchId && req.user
      ? rows.find((row) => row.matchId === matchId && row.googleId === req.user.googleId)
      : null;
    const matchVoterIds = matchId
      ? new Set(rows.filter((row) => row.matchId === matchId).map((row) => row.googleId))
      : new Set();
    const allVoterIds = new Set(rows.map((row) => row.googleId).filter(Boolean));
    res.json({
      user: req.user ? publicUser(req.user) : null,
      match: publicMatch(open),
      myVotes: mine?.votes || {},
      ballots: rows.map((row) => row.votes || {}),
      voters: allVoterIds.size,
      matchVoters: matchVoterIds.size,
    });
  }));

  app.put("/api/votes", requireUser, ah(async (req, res) => {
    const open = await currentOpenMatch();
    if (!open) {
      res.status(409).json({ error: "No hay partido abierto" });
      return;
    }
    const votes = cleanVotes(req.body?.votes, new Set(open.players));
    const matchId = String(open._id);
    await ballots.updateOne(
      { matchId, googleId: req.user.googleId },
      {
        $set: {
          matchId,
          googleId: req.user.googleId,
          name: req.user.name,
          email: req.user.email,
          votes,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    res.json({ ok: true, votes, match: publicMatch(open) });
  }));

  app.delete("/api/votes", requireUser, ah(async (req, res) => {
    const open = await currentOpenMatch();
    if (!open) {
      res.status(409).json({ error: "No hay partido abierto" });
      return;
    }
    await ballots.deleteOne({ matchId: String(open._id), googleId: req.user.googleId });
    res.json({ ok: true, votes: {} });
  }));

  app.post("/api/matches", requireAdmin, ah(async (req, res) => {
    const existing = await currentOpenMatch();
    if (existing) {
      res.status(409).json({ error: "Ya hay un partido abierto. Cerralo antes de abrir otro." });
      return;
    }
    const roster = cleanPlayerList(req.body?.players);
    if (roster.length < 2) {
      res.status(400).json({ error: "Poné al menos 2 jugadores del plantel en la cancha" });
      return;
    }
    const mode = Number(req.body?.mode);
    const doc = {
      status: "open",
      day: dayKeyAR(),
      players: roster,
      mode: [5, 6, 7].includes(mode) ? mode : 5,
      createdAt: new Date(),
      createdBy: {
        googleId: req.user.googleId,
        email: req.user.email,
        name: req.user.name,
      },
    };
    const result = await matches.insertOne(doc);
    res.status(201).json({ match: publicMatch({ ...doc, _id: result.insertedId }) });
  }));

  app.post("/api/matches/close", requireAdmin, ah(async (req, res) => {
    const open = await currentOpenMatch();
    if (!open) {
      res.status(404).json({ error: "No hay partido abierto" });
      return;
    }
    await matches.updateOne(
      { _id: open._id, status: "open" },
      { $set: { status: "closed", closedAt: new Date(), closedReason: "admin" } },
    );
    res.json({ match: publicMatch({ ...open, status: "closed", closedAt: new Date() }) });
  }));

  app.get("/api/admin/matches", requireAdmin, ah(async (_req, res) => {
    await expireOpenMatches();
    const docs = await matches.find({}).sort({ createdAt: -1 }).toArray();
    const ids = docs.map((doc) => String(doc._id));
    const counts = ids.length
      ? await ballots.aggregate([
        { $match: { matchId: { $in: ids } } },
        { $group: { _id: "$matchId", voters: { $sum: 1 } } },
      ]).toArray()
      : [];
    const byId = Object.fromEntries(counts.map((row) => [row._id, row.voters]));
    res.json({
      matches: docs.map((doc) => ({
        ...publicMatch(doc),
        voters: byId[String(doc._id)] || 0,
      })),
    });
  }));

  app.get("/api/admin/matches/:id", requireAdmin, ah(async (req, res) => {
    const _id = matchObjectId(req.params.id);
    if (!_id) {
      res.status(400).json({ error: "Partido inválido" });
      return;
    }
    await expireOpenMatches();
    const doc = await matches.findOne({ _id });
    if (!doc) {
      res.status(404).json({ error: "No está ese partido" });
      return;
    }
    const rows = await ballots.find({ matchId: String(doc._id) })
      .project({ _id: 0, name: 1, email: 1, votes: 1, updatedAt: 1 })
      .sort({ name: 1 })
      .toArray();
    res.json({
      match: publicMatch(doc),
      ballots: rows
        .map((row) => ({
          name: row.name || "Alguien",
          email: row.email || "",
          votes: row.votes || {},
          updatedAt: row.updatedAt || null,
        }))
        .filter((row) => Object.keys(row.votes).length > 0),
    });
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
