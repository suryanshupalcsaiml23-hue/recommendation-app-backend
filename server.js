import http from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "./db.js";

const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || "supersecretkey";


// ---------------- MOVIE DATA ----------------
const movies = [
  { title: "Inception", genres: ["Sci-Fi", "Action"] },
  { title: "Interstellar", genres: ["Sci-Fi", "Drama"] },
  { title: "The Dark Knight", genres: ["Action", "Crime"] },
  { title: "Titanic", genres: ["Romance", "Drama"] },
  { title: "Avengers", genres: ["Action", "Fantasy"] }
];

// ---------------- JWT ----------------
function verifyToken(req) {
  const auth = req.headers["authorization"];
  if (!auth) return null;

  const token = auth.split(" ")[1];
  if (!token) return null;

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// ---------------- SERVER ----------------
const server = http.createServer((req, res) => {
  // -------- CORS --------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // -------- HOME --------
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ message: "Backend running 🚀" }));
  }

  // -------- REGISTER --------
 // ---------------- REGISTER ----------------
if (req.url === "/register" && req.method === "POST") {
  let body = "";

  req.on("data", chunk => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    // 🔴 IMPORTANT: handle empty body
    if (!body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Empty request body" }));
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }

    const { email, password } = parsed;

    if (!email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ error: "Email and password required" })
      );
    }

    try {
      const existing = await pool.query(
        "SELECT 1 FROM users WHERE email = $1",
        [email]
      );

      if (existing.rows.length > 0) {
        res.writeHead(409, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "User already exists" }));
      }

      const hashed = await bcrypt.hash(password, 10);

      await pool.query(
        "INSERT INTO users (email, password) VALUES ($1, $2)",
        [email, hashed]
      );

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Registered successfully ✅" }));

    } catch (err) {
      console.error("REGISTER ERROR:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    }
  });

  return;
}



  // -------- LOGIN --------
  if (req.url === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const { email, password } = JSON.parse(body);

        const result = await pool.query(
          "SELECT * FROM users WHERE email=$1",
          [email]
        );

        if (!result.rows.length) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid credentials" }));
        }

        const user = result.rows[0];
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid credentials" }));
        }

        const token = jwt.sign({ email }, SECRET, { expiresIn: "1h" });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Login successful 🎉", token }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
      }
    });
    return;
  }

  // -------- SAVE PREFERENCES --------
  if (req.url === "/preferences" && req.method === "POST") {
    const user = verifyToken(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }

    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const { genres } = JSON.parse(body);
        if (!Array.isArray(genres) || !genres.length) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "No genres selected" }));
        }

        await pool.query(
          "DELETE FROM preferences WHERE user_email=$1",
          [user.email]
        );

        for (const g of genres) {
          await pool.query(
            "INSERT INTO preferences(user_email,genre) VALUES($1,$2)",
            [user.email, g]
          );
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Preferences saved ✅" }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
      }
    });
    return;
  }

  // -------- RECOMMEND (FIXED) --------
  if (req.url === "/recommend" && req.method === "GET") {
    const user = verifyToken(req);
    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }

    pool.query(
      "SELECT genre FROM preferences WHERE user_email=$1",
      [user.email]
    ).then(result => {
      const userGenres = result.rows.map(r => r.genre);

      const recommendations = movies
        .map(m => {
          const match = m.genres.filter(g => userGenres.includes(g));
          return {
            title: m.title,
            genres: m.genres,
            score: match.length,
            reason: match
          };
        })
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        user: user.email,
        preferences: userGenres,
        recommendations
      }));
    }).catch(() => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server error" }));
    });

    return;
  }

  // -------- NOT FOUND --------
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

// -------- START --------
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
