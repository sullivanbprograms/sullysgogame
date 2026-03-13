import { useState, useEffect, useRef } from "react";

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg: "#1c1008", panel: "#120a03", wood: "#b07d3a", woodDk: "#6b4518",
  woodLt: "#d4a460", line: "#6b4518", gold: "#c9952a", text: "#e8d5a8",
  muted: "#8a6a3a",
};

// ── Config ─────────────────────────────────────────────────────────────────
const SIZES = { "9×9": 9, "13×13": 13, "19×19": 19 };
const RULES = ["Japanese", "Chinese", "Korean (AGA)"];
const KOMI = { "Japanese": 6.5, "Chinese": 7.5, "Korean (AGA)": 6.5 };
const DIFF = ["10k", "7k", "5k", "2k", "1d", "3d"];
const STARS = {
  9: [[2,2],[2,6],[6,2],[6,6],[4,4]],
  13: [[3,3],[3,9],[9,3],[9,9],[6,6]],
  19: [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]],
};

// ── Tsumego problems ───────────────────────────────────────────────────────
// 0=empty, 1=black, 2=white. sol=[r,c] where black should play.
const PROBLEMS = [
  {
    id: 1, title: "Capture the Stone", rank: "25k",
    desc: "Black to play. The white stone is almost captured — fill its last liberty.",
    hint: "White at [2,2] has one liberty remaining. Play there.",
    size: 5,
    board: [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,1,2,1,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
    ],
    sol: [1, 2],
    showSolution: function(b) {
      const n = b.map(r => [...r]);
      n[1][2] = 1;
      n[2][2] = 0; // captured
      return n;
    },
  },
  {
    id: 2, title: "Make Two Eyes", rank: "18k",
    desc: "Black is enclosed by white. Find the vital point to create two eyes and live.",
    hint: "Divide the interior into two separate spaces by playing the center.",
    size: 7,
    board: [
      [2,2,2,2,2,2,2],
      [2,1,1,1,1,1,2],
      [2,1,0,0,0,1,2],
      [2,1,0,0,0,1,2],
      [2,1,0,0,0,1,2],
      [2,1,1,1,1,1,2],
      [2,2,2,2,2,2,2],
    ],
    sol: [3, 3],
    showSolution: function(b) {
      const n = b.map(r => [...r]);
      n[3][3] = 1;
      return n;
    },
  },
  {
    id: 3, title: "Ladder Continues", rank: "15k",
    desc: "White is caught in a ladder. Play the move that keeps the chase going.",
    hint: "Put white in atari again — chase it toward the corner.",
    size: 7,
    board: [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,1,0,0,0,0],
      [0,1,2,1,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
    ],
    sol: [2, 3],
    showSolution: function(b) {
      const n = b.map(r => [...r]);
      n[2][3] = 1;
      return n;
    },
  },
  {
    id: 4, title: "Corner Life", rank: "10k",
    desc: "Black is in the corner under pressure. Find the vital point to guarantee two eyes.",
    hint: "The 1-1 point is essential for corner life.",
    size: 7,
    board: [
      [0,1,2,2,0,0,0],
      [1,0,1,2,0,0,0],
      [1,1,1,2,0,0,0],
      [2,2,2,2,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
    ],
    sol: [1, 1],
    showSolution: function(b) {
      const n = b.map(r => [...r]);
      n[1][1] = 1;
      return n;
    },
  },
];

// ── Initial rankings ───────────────────────────────────────────────────────
const INIT_PLAYERS = [
  { name: "You", elo: 1200, rank: "5k", wins: 0, losses: 0, avatar: "👤" },
  { name: "Cho Chikun", elo: 2100, rank: "9d", wins: 312, losses: 88, avatar: "🏆" },
  { name: "Rin Kaiho", elo: 2050, rank: "8d", wins: 289, losses: 101, avatar: "⚡" },
  { name: "Lee Changho", elo: 1980, rank: "7d", wins: 254, losses: 120, avatar: "🌊" },
  { name: "Takemiya", elo: 1750, rank: "4d", wins: 198, losses: 152, avatar: "🌸" },
  { name: "Yoda Norimoto", elo: 1600, rank: "2d", wins: 167, losses: 183, avatar: "🎯" },
  { name: "Mimura", elo: 1420, rank: "1k", wins: 132, losses: 208, avatar: "🍃" },
];

// ── Go logic ───────────────────────────────────────────────────────────────
function nbrs(r, c, n) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([a,b]) => a>=0 && a<n && b>=0 && b<n);
}

function getGroup(board, r, c) {
  const n = board.length;
  const color = board[r][c];
  if (!color) return { stones: [], liberties: [] };
  const seen = new Set();
  const stones = [];
  const libSet = new Set();
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const k = cr + "," + cc;
    if (seen.has(k)) continue;
    seen.add(k);
    stones.push([cr, cc]);
    for (const [nr, nc] of nbrs(cr, cc, n)) {
      if (board[nr][nc] === 0) libSet.add(nr + "," + nc);
      else if (board[nr][nc] === color && !seen.has(nr + "," + nc)) stack.push([nr, nc]);
    }
  }
  return { stones, liberties: [...libSet].map(k => k.split(",").map(Number)) };
}

function applyMove(board, r, c, color) {
  const n = board.length;
  const opp = color === 1 ? 2 : 1;
  const next = board.map(row => [...row]);
  next[r][c] = color;
  let captured = 0;
  for (const [nr, nc] of nbrs(r, c, n)) {
    if (next[nr][nc] === opp) {
      const g = getGroup(next, nr, nc);
      if (g.liberties.length === 0) {
        g.stones.forEach(([sr, sc]) => { next[sr][sc] = 0; });
        captured += g.stones.length;
      }
    }
  }
  if (getGroup(next, r, c).liberties.length === 0) return null; // suicide
  return { board: next, captured };
}

function isLegal(board, r, c, color, koPoint) {
  if (board[r][c] !== 0) return false;
  if (koPoint && koPoint[0] === r && koPoint[1] === c) return false;
  return applyMove(board, r, c, color) !== null;
}

function estimateTerritory(board) {
  const n = board.length;
  const terr = board.map(() => Array(n).fill(0));
  const vis = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] || vis.has(r+","+c)) continue;
      const stack = [[r, c]];
      const region = [];
      let touchB = false, touchW = false;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        const k = cr + "," + cc;
        if (vis.has(k)) continue;
        vis.add(k);
        region.push([cr, cc]);
        for (const [nr, nc] of nbrs(cr, cc, n)) {
          if (board[nr][nc] === 1) touchB = true;
          else if (board[nr][nc] === 2) touchW = true;
          else if (!vis.has(nr+","+nc)) stack.push([nr, nc]);
        }
      }
      const owner = touchB && !touchW ? 1 : touchW && !touchB ? 2 : 0;
      region.forEach(([tr, tc]) => { terr[tr][tc] = owner; });
    }
  }
  return terr;
}

// ── AI ─────────────────────────────────────────────────────────────────────
function aiMove(board, color, difficulty, koPoint) {
  const n = board.length;
  const opp = color === 1 ? 2 : 1;
  const moves = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!isLegal(board, r, c, color, koPoint)) continue;
      let score = Math.random() * 1.5;
      for (const [nr, nc] of nbrs(r, c, n)) {
        if (board[nr][nc] === opp) {
          const g = getGroup(board, nr, nc);
          if (g.liberties.length === 1) score += g.stones.length * 6;
          if (g.liberties.length === 2) score += 2;
        }
        if (board[nr][nc] === color) score += 0.8;
      }
      const cx = (n - 1) / 2;
      score -= (Math.abs(r - cx) + Math.abs(c - cx)) * 0.08;
      moves.push({ r, c, score });
    }
  }
  if (!moves.length) return null;
  moves.sort((a, b) => b.score - a.score);
  const topN = Math.max(1, Math.floor(moves.length * (1 - difficulty * 0.15)));
  return moves[Math.floor(Math.random() * topN)];
}

// ── ELO ────────────────────────────────────────────────────────────────────
function expectedScore(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); }
function newElo(r, e, s) { return Math.round(r + 32 * (s - e)); }
function eloToRank(elo) {
  if (elo >= 2000) return "9d";
  if (elo >= 1800) return "6d";
  if (elo >= 1600) return "3d";
  if (elo >= 1500) return "1d";
  if (elo >= 1400) return "1k";
  if (elo >= 1300) return "3k";
  if (elo >= 1200) return "5k";
  if (elo >= 1100) return "7k";
  return "10k";
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant, fullWidth, style }) {
  const v = variant || "default";
  const bg = v === "gold" ? C.gold : v === "danger" ? "rgba(120,30,0,.4)" : "rgba(255,255,255,.06)";
  const col = v === "gold" ? C.bg : v === "danger" ? "#ffaaaa" : C.text;
  const bdr = v === "gold" ? C.gold : v === "danger" ? "#7a2000" : C.woodDk;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, color: col, borderColor: bdr,
        border: "1px solid", borderRadius: 4,
        padding: "7px 14px", fontFamily: "Georgia,serif", fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, transition: "all .15s",
        width: fullWidth ? "100%" : undefined, textAlign: "left",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Sec({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, letterSpacing: 2, color: C.muted,
        textTransform: "uppercase", borderBottom: "1px solid " + C.woodDk,
        paddingBottom: 4, marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

// ── Board component ────────────────────────────────────────────────────────
function GoBoard({ board, onCell, lastMove, territory, showTerr, disabled }) {
  const n = board.length;
  const cs = Math.min(48, Math.floor(540 / n));
  const bp = cs * (n - 1);
  const pad = cs;
  const total = bp + pad * 2;
  const stars = STARS[n] || [];

  return (
    <div style={{
      position: "relative", width: total, height: total, flexShrink: 0,
      background: "radial-gradient(ellipse at 38% 32%," + C.woodLt + "," + C.wood + " 55%," + C.woodDk + ")",
      boxShadow: "0 8px 40px rgba(0,0,0,.65)",
      borderRadius: 4, border: "3px solid " + C.woodDk,
    }}>
      <svg
        style={{ position: "absolute", top: pad, left: pad, overflow: "visible" }}
        width={bp} height={bp}
      >
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line x1={0} y1={i*cs} x2={bp} y2={i*cs} stroke={C.line} strokeWidth={0.75} />
            <line x1={i*cs} y1={0} x2={i*cs} y2={bp} stroke={C.line} strokeWidth={0.75} />
          </g>
        ))}
        <rect x={0} y={0} width={bp} height={bp} fill="none" stroke={C.line} strokeWidth={1.4} />
        {stars.map(([sr, sc]) => (
          <circle key={sr+","+sc} cx={sc*cs} cy={sr*cs} r={3.5} fill={C.line} />
        ))}
        {showTerr && territory && territory.map((row, r) =>
          row.map((v, c) => {
            if (!v || board[r][c]) return null;
            return (
              <rect
                key={"t"+r+c} x={c*cs-cs*0.18} y={r*cs-cs*0.18}
                width={cs*0.36} height={cs*0.36}
                fill={v === 1 ? "rgba(10,10,10,.6)" : "rgba(240,240,240,.6)"} rx={2}
              />
            );
          })
        )}
      </svg>

      {board.map((row, r) =>
        row.map((v, c) => {
          const isLast = lastMove && lastMove[0] === r && lastMove[1] === c;
          return (
            <div
              key={r+","+c}
              onClick={() => { if (!disabled && !v && onCell) onCell(r, c); }}
              style={{
                position: "absolute",
                left: pad + c*cs - cs*0.46,
                top: pad + r*cs - cs*0.46,
                width: cs*0.92, height: cs*0.92,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: !disabled && !v ? "crosshair" : "default",
                zIndex: v ? 2 : 1,
              }}
            >
              {v ? (
                <div style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  background: v === 1
                    ? "radial-gradient(circle at 36% 34%,#5a5a5a,#111)"
                    : "radial-gradient(circle at 36% 34%,#fff,#d0c8b8)",
                  boxShadow: v === 1
                    ? "2px 3px 7px rgba(0,0,0,.7)"
                    : "2px 3px 7px rgba(0,0,0,.35)",
                  border: v === 2 ? "1px solid #bbb" : undefined,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isLast && (
                    <div style={{
                      width: "28%", height: "28%", borderRadius: "50%",
                      background: v === 1 ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.4)",
                    }} />
                  )}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Auth screen ────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const inp = {
    width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid " + C.woodDk,
    borderRadius: 4, padding: "9px 12px", color: C.text, fontFamily: "Georgia,serif",
    fontSize: 13, boxSizing: "border-box", outline: "none", display: "block",
  };

  function submit(e) {
    e.preventDefault();
    if (!email.includes("@")) { setErr("Enter a valid email."); return; }
    if (pass.length < 6) { setErr("Password must be 6+ characters."); return; }
    onLogin({ name: name || email.split("@")[0], email, avatar: "👤" });
  }

  function googleLogin() {
    // Replace with real Firebase signInWithPopup in production — see deployment guide
    onLogin({ name: "Google Player", email: "player@gmail.com", avatar: "🌐" });
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 4 }}>⚫⚪</div>
        <div style={{ fontSize: 34, color: C.gold, letterSpacing: 6 }}>GO</div>
        <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>THE ANCIENT GAME</div>
      </div>

      <div style={{
        background: C.panel, border: "1px solid " + C.woodDk,
        borderRadius: 10, padding: 32, width: 340,
        boxShadow: "0 12px 48px rgba(0,0,0,.6)",
      }}>
        <div style={{ display: "flex", marginBottom: 24, borderBottom: "1px solid " + C.woodDk }}>
          {[["login","Sign In"],["signup","Create Account"]].map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setErr(""); }}
              style={{
                flex: 1, background: "none", border: "none",
                color: mode === m ? C.gold : C.muted,
                fontFamily: "Georgia,serif", fontSize: 12, letterSpacing: 1,
                paddingBottom: 10, cursor: "pointer",
                borderBottom: mode === m ? "2px solid " + C.gold : "2px solid transparent",
                textTransform: "uppercase",
              }}
            >{label}</button>
          ))}
        </div>

        <button
          onClick={googleLogin}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, background: "#4285F4", color: "#fff", border: "none", borderRadius: 4,
            padding: "10px 0", fontFamily: "Georgia,serif", fontSize: 13, cursor: "pointer",
            marginBottom: 16, boxShadow: "0 2px 8px rgba(66,133,244,.3)",
          }}
        >
          <svg width={18} height={18} viewBox="0 0 48 48">
            <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.2-2.7-.5-4z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: C.woodDk }} />
          <span style={{ color: C.muted, fontSize: 11 }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.woodDk }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <input placeholder="Display name" value={name} onChange={e => setName(e.target.value)} style={inp} />
          )}
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          <input placeholder="Password" type="password" value={pass} onChange={e => setPass(e.target.value)} style={inp} />
          {err && <div style={{ color: "#ffaaaa", fontSize: 12 }}>{err}</div>}
          <button
            type="submit"
            style={{
              background: C.gold, color: C.bg, border: "none", borderRadius: 4,
              padding: "10px 0", fontFamily: "Georgia,serif", fontSize: 14,
              fontWeight: "bold", cursor: "pointer", letterSpacing: 1, marginTop: 4,
            }}
          >{mode === "login" ? "Sign In" : "Create Account"}</button>
        </form>
      </div>
    </div>
  );
}

// ── Tsumego screen ─────────────────────────────────────────────────────────
function TsumegoScreen() {
  const [sel, setSel] = useState(null);
  const [board, setBoard] = useState(null);
  const [status, setStatus] = useState("idle");
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);

  function loadProblem(p) {
    setSel(p);
    setBoard(p.board.map(r => [...r]));
    setStatus("idle");
    setShowHint(false);
    setAttempts(0);
  }

  function handleClick(r, c) {
    if (!sel || status === "solved") return;
    if (r === sel.sol[0] && c === sel.sol[1]) {
      setBoard(sel.showSolution(board));
      setStatus("solved");
    } else {
      setAttempts(a => a + 1);
      setStatus("wrong");
      setTimeout(() => setStatus("idle"), 900);
    }
  }

  if (!sel) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ fontSize: 22, color: C.gold, letterSpacing: 3, marginBottom: 4 }}>TSUMEGO</div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>Life, death & tesuji practice</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {PROBLEMS.map(p => (
            <div
              key={p.id}
              onClick={() => loadProblem(p)}
              style={{
                background: C.panel, border: "1px solid " + C.woodDk,
                borderRadius: 8, padding: 22, width: 190, cursor: "pointer", transition: "all .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.woodDk; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ fontSize: 15, marginBottom: 6 }}>{p.title}</div>
              <div style={{ color: C.gold, fontSize: 12, marginBottom: 8 }}>Rank: {p.rank}</div>
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex" }}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 32, flexDirection: "column", gap: 16,
      }}>
        <GoBoard board={board} onCell={handleClick} disabled={status === "solved"} />
        {status === "wrong" && (
          <div style={{ color: "#ffaaaa", fontSize: 13 }}>✗ Not the right move — try again</div>
        )}
        {status === "solved" && (
          <div style={{ color: "#90ee90", fontSize: 14, fontWeight: "bold" }}>✓ Correct! Problem solved.</div>
        )}
      </div>
      <div style={{
        width: 240, background: C.panel, borderLeft: "2px solid " + C.woodDk,
        padding: 24, display: "flex", flexDirection: "column", gap: 12,
      }}>
        <Sec title="Problem">
          <div style={{ fontSize: 16, color: C.text, marginBottom: 6 }}>{sel.title}</div>
          <div style={{ fontSize: 12, color: C.gold, marginBottom: 10 }}>Rank: {sel.rank}</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{sel.desc}</div>
        </Sec>
        <Sec title="Stats">
          <div style={{ fontSize: 12, color: C.muted }}>Attempts: {attempts}</div>
        </Sec>
        {status !== "solved" && (
          <Btn onClick={() => setShowHint(true)} fullWidth>💡 Show Hint</Btn>
        )}
        {showHint && (
          <div style={{
            fontSize: 12, color: C.muted, fontStyle: "italic", lineHeight: 1.6,
            background: "rgba(255,255,255,.03)", borderRadius: 4, padding: 10,
            border: "1px solid " + C.woodDk,
          }}>{sel.hint}</div>
        )}
        {status === "solved" && (
          <Btn variant="gold" onClick={() => setSel(null)} fullWidth>Next Problem →</Btn>
        )}
        <Btn onClick={() => setSel(null)} fullWidth>← All Problems</Btn>
      </div>
    </div>
  );
}

// ── Game screen ────────────────────────────────────────────────────────────
const JOSEKI_TIPS = [
  "3-4 point: approach from the wider side for better extension.",
  "4-4 point: flexible — respond based on whole-board position.",
  "After a corner joseki, extend on the wider side.",
  "Shoulder hits efficiently reduce opponent's moyo.",
  "Pincers fight for center influence — consider the whole board.",
];

function GameScreen({ user, onUpdateRankings }) {
  const [sizeKey, setSizeKey] = useState("19×19");
  const [rules, setRules] = useState("Japanese");
  const [diff, setDiff] = useState(2);
  const [started, setStarted] = useState(false);

  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState(1);
  const [caps, setCaps] = useState({ 1: 0, 2: 0 });
  const [history, setHistory] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [koPoint, setKoPoint] = useState(null);
  const [passes, setPasses] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [territory, setTerritory] = useState(null);
  const [showTerr, setShowTerr] = useState(false);
  const [moveLog, setMoveLog] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [josekiTip, setJosekiTip] = useState("");
  const aiRef = useRef(null);

  const n = SIZES[sizeKey];
  const COL = "ABCDEFGHJKLMNOPQRST";

  function mvLabel(r, c) { return COL[c] + (n - r); }

  function findKoPoint(oldBoard, r, c) {
    for (const [nr, nc] of nbrs(r, c, n)) {
      if (oldBoard[nr][nc] === 2) return [nr, nc];
    }
    return null;
  }

  function startGame() {
    setBoard(Array.from({ length: n }, () => Array(n).fill(0)));
    setTurn(1); setCaps({ 1: 0, 2: 0 }); setHistory([]);
    setLastMove(null); setKoPoint(null); setPasses(0);
    setGameOver(false); setFinalScore(null);
    setTerritory(null); setShowTerr(false);
    setMoveLog([]); setMistakes([]);
    setStarted(true);
  }

  function handleCell(r, c) {
    if (!board || !started || gameOver || turn !== 1) return;
    if (!isLegal(board, r, c, 1, koPoint)) return;
    const res = applyMove(board, r, c, 1);
    if (!res) return;

    const newMistakes = [...mistakes];
    if (getGroup(res.board, r, c).liberties.length === 1) {
      newMistakes.push("⚠ " + mvLabel(r, c) + ": your group is in atari!");
    }

    const newKo = res.captured === 1 ? findKoPoint(board, r, c) : null;
    setBoard(res.board);
    setCaps(p => ({ ...p, 1: p[1] + res.captured }));
    setHistory(h => [...h, { board: board.map(r => [...r]), caps: { ...caps }, ko: koPoint }]);
    setLastMove([r, c]);
    setKoPoint(newKo);
    setPasses(0);
    setMoveLog(l => [...l, "⚫ " + mvLabel(r, c)]);
    setMistakes(newMistakes);
    if (Math.random() < 0.2) {
      setJosekiTip(JOSEKI_TIPS[Math.floor(Math.random() * JOSEKI_TIPS.length)]);
      setTimeout(() => setJosekiTip(""), 5000);
    }
    setTurn(2);
  }

  useEffect(() => {
    if (!board || !started || gameOver || turn !== 2) return;
    if (aiRef.current) clearTimeout(aiRef.current);
    aiRef.current = setTimeout(() => {
      const mv = aiMove(board, 2, diff, koPoint);
      if (!mv) { handlePass(true); return; }
      const res = applyMove(board, mv.r, mv.c, 2);
      if (!res) { handlePass(true); return; }
      const newKo = res.captured === 1 ? findKoPoint(board, mv.r, mv.c) : null;
      setBoard(res.board);
      setCaps(p => ({ ...p, 2: p[2] + res.captured }));
      setHistory(h => [...h, { board: board.map(r => [...r]), caps: { ...caps }, ko: koPoint }]);
      setLastMove([mv.r, mv.c]);
      setKoPoint(newKo);
      setPasses(0);
      setMoveLog(l => [...l, "⚪ " + mvLabel(mv.r, mv.c)]);
      setTurn(1);
    }, 650 + Math.random() * 400);
    return () => clearTimeout(aiRef.current);
  }, [turn, started, gameOver, board]);

  function handlePass(isAI) {
    const np = passes + 1;
    if (np >= 2) { endGame(false); return; }
    setPasses(np);
    setMoveLog(l => [...l, isAI ? "⚪ Pass" : "⚫ Pass"]);
    setTurn(t => t === 1 ? 2 : 1);
  }

  function endGame(resigned) {
    setGameOver(true);
    if (resigned) {
      setFinalScore({ resigned: true, winner: "White (AI)" });
      onUpdateRankings(false, diff);
      return;
    }
    const terr = estimateTerritory(board);
    setTerritory(terr); setShowTerr(true);
    let bS = caps[1], wS = caps[2] + KOMI[rules];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (board[r][c] === 1 || terr[r][c] === 1) bS++;
        if (board[r][c] === 2 || terr[r][c] === 2) wS++;
      }
    }
    const won = bS > wS;
    setFinalScore({ black: bS.toFixed(1), white: wS.toFixed(1), winner: won ? "Black (You)" : "White (AI)" });
    onUpdateRankings(won, diff);
  }

  function undo() {
    if (!history.length || turn !== 1) return;
    const prev = history.length >= 2 ? history[history.length - 2] : history[0];
    setBoard(prev.board.map(r => [...r]));
    setCaps({ ...prev.caps });
    setKoPoint(prev.ko);
    setHistory(h => h.slice(0, -2));
    setLastMove(null);
    setTurn(1);
  }

  if (!started) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          background: C.panel, border: "1px solid " + C.woodDk,
          borderRadius: 10, padding: 36, width: 340,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          <div style={{ fontSize: 20, color: C.gold, letterSpacing: 2 }}>New Game</div>

          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Board Size</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Object.keys(SIZES).map(sz => (
                <button key={sz} onClick={() => setSizeKey(sz)} style={{
                  flex: 1, padding: "7px 0", borderRadius: 4, cursor: "pointer",
                  fontFamily: "Georgia,serif", fontSize: 12,
                  background: sizeKey === sz ? C.gold : "transparent",
                  color: sizeKey === sz ? C.bg : C.text,
                  border: "1px solid " + (sizeKey === sz ? C.gold : C.woodDk),
                }}>{sz}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Scoring Rules</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {RULES.map(r => (
                <button key={r} onClick={() => setRules(r)} style={{
                  flex: 1, minWidth: 80, padding: "6px 4px", borderRadius: 4, cursor: "pointer",
                  fontFamily: "Georgia,serif", fontSize: 11,
                  background: rules === r ? C.gold : "transparent",
                  color: rules === r ? C.bg : C.text,
                  border: "1px solid " + (rules === r ? C.gold : C.woodDk),
                }}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
              AI Difficulty: {DIFF[diff]}
            </div>
            <input
              type="range" min={0} max={5} value={diff}
              onChange={e => setDiff(+e.target.value)}
              style={{ width: "100%", accentColor: C.gold }}
            />
          </div>

          <Btn variant="gold" onClick={startGame} fullWidth style={{ padding: "12px 0", fontSize: 15, letterSpacing: 2, textAlign: "center" }}>
            BEGIN GAME
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {board && (
          <GoBoard
            board={board} onCell={handleCell} lastMove={lastMove}
            territory={territory} showTerr={showTerr}
            disabled={gameOver || turn !== 1}
          />
        )}
      </div>

      <div style={{
        width: 240, background: C.panel, borderLeft: "2px solid " + C.woodDk,
        padding: 20, display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        <Sec title="Status">
          {gameOver && finalScore ? (
            <div style={{ textAlign: "center" }}>
              {finalScore.resigned ? (
                <div style={{ color: "#ffaaaa" }}>You resigned.</div>
              ) : (
                <>
                  <div style={{ color: C.gold, fontSize: 13, marginBottom: 6 }}>Game Over</div>
                  <div>⚫ {finalScore.black} &nbsp; ⚪ {finalScore.white}</div>
                  <div style={{ marginTop: 6, color: finalScore.winner.includes("You") ? "#90ee90" : "#ffaaaa" }}>
                    {finalScore.winner} wins
                  </div>
                </>
              )}
              <div style={{ marginTop: 12 }}>
                <Btn onClick={() => setStarted(false)} fullWidth>New Game</Btn>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: turn === 1 ? "#111" : "#eee",
                  border: "1px solid #888",
                }} />
                {turn === 1 ? "Your turn (Black)" : "AI thinking…"}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>Rules: {rules} · {DIFF[diff]}</div>
            </>
          )}
        </Sec>

        <Sec title="Captures">
          <div style={{ fontSize: 12 }}>⚫ Black: {caps[1]}</div>
          <div style={{ fontSize: 12 }}>⚪ White: {caps[2]}</div>
        </Sec>

        {!gameOver && (
          <Sec title="Actions">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Btn onClick={() => handlePass(false)} disabled={turn !== 1} fullWidth>Pass</Btn>
              <Btn onClick={undo} disabled={turn !== 1 || history.length < 2} fullWidth>Undo</Btn>
              <Btn onClick={() => { setTerritory(estimateTerritory(board)); setShowTerr(s => !s); }} fullWidth>
                {showTerr ? "Hide" : "Show"} Territory
              </Btn>
              <Btn variant="danger" onClick={() => endGame(true)} fullWidth>Resign</Btn>
            </div>
          </Sec>
        )}

        {josekiTip && (
          <Sec title="Joseki Tip">
            <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", lineHeight: 1.6 }}>{josekiTip}</div>
          </Sec>
        )}

        {mistakes.length > 0 && (
          <Sec title="Analysis">
            {mistakes.slice(-3).map((m, i) => (
              <div key={i} style={{ fontSize: 11, color: "#ffaaaa", marginBottom: 4 }}>{m}</div>
            ))}
          </Sec>
        )}

        <Sec title="Move Log">
          <div style={{ maxHeight: 140, overflowY: "auto", fontSize: 11, color: C.muted, lineHeight: 1.9 }}>
            {moveLog.slice(-20).map((m, i) => <div key={i}>{m}</div>)}
          </div>
        </Sec>
      </div>
    </div>
  );
}

// ── Rankings screen ────────────────────────────────────────────────────────
function RankingsScreen({ players, userName }) {
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  return (
    <div style={{ padding: 40 }}>
      <div style={{ fontSize: 22, color: C.gold, letterSpacing: 3, marginBottom: 4 }}>RANKINGS</div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>ELO-based player ladder</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 640 }}>
        {sorted.map((p, i) => {
          const me = p.name === userName;
          return (
            <div key={p.name} style={{
              background: me ? "rgba(201,149,42,.12)" : C.panel,
              border: "1px solid " + (me ? C.gold : C.woodDk),
              borderRadius: 6, padding: "11px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ width: 26, color: C.muted, fontSize: 12 }}>#{i + 1}</div>
              <div style={{ fontSize: 18 }}>{p.avatar}</div>
              <div style={{ flex: 1, fontWeight: me ? "bold" : "normal", fontSize: 14 }}>{p.name}</div>
              <div style={{ color: C.gold, width: 36, textAlign: "center", fontSize: 13 }}>{p.rank}</div>
              <div style={{ width: 60, textAlign: "right", fontSize: 13 }}>{p.elo} ELO</div>
              <div style={{ width: 80, textAlign: "right", fontSize: 11, color: C.muted }}>{p.wins}W/{p.losses}L</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Root app ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("game");
  const [players, setPlayers] = useState(INIT_PLAYERS);

  function handleLogin(u) {
    setUser(u);
    setPlayers(ps => ps.map(p => p.name === "You" ? { ...p, name: u.name, avatar: u.avatar } : p));
  }

  function updateRankings(won, diff) {
    setPlayers(ps => {
      const me = ps.find(p => p.name === user.name);
      if (!me) return ps;
      const aiElo = 900 + diff * 180;
      const exp = expectedScore(me.elo, aiElo);
      const updated = newElo(me.elo, exp, won ? 1 : 0);
      return ps.map(p => p.name === me.name
        ? { ...p, elo: updated, rank: eloToRank(updated), wins: p.wins + (won ? 1 : 0), losses: p.losses + (won ? 0 : 1) }
        : p
      );
    });
  }

  function NavBtn({ label, id }) {
    return (
      <button onClick={() => setPage(id)} style={{
        background: page === id ? C.gold : "transparent",
        color: page === id ? C.bg : C.text,
        border: "1px solid " + (page === id ? C.gold : C.woodDk),
        borderRadius: 4, padding: "6px 16px", cursor: "pointer",
        fontFamily: "Georgia,serif", fontSize: 13, letterSpacing: 1, transition: "all .2s",
      }}>{label}</button>
    );
  }

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "Georgia,'Times New Roman',serif",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        background: C.panel, borderBottom: "2px solid " + C.woodDk,
        padding: "10px 24px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontSize: 22, color: C.gold, letterSpacing: 3, marginRight: 8 }}>囲碁</div>
        <NavBtn label="Play" id="game" />
        <NavBtn label="Tsumego" id="tsumego" />
        <NavBtn label="Rankings" id="rankings" />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 12 }}>
          <span>{user.avatar}</span>
          <span>{user.name}</span>
          <span style={{ color: C.gold, marginLeft: 4 }}>
            {(players.find(p => p.name === user.name) || {}).elo || 1200} ELO
          </span>
          <button onClick={() => setUser(null)} style={{
            background: "none", border: "1px solid " + C.woodDk, color: C.muted,
            borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, marginLeft: 8,
          }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {page === "game" && <GameScreen user={user} onUpdateRankings={updateRankings} />}
        {page === "tsumego" && <TsumegoScreen />}
        {page === "rankings" && <RankingsScreen players={players} userName={user.name} />}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.woodDk}; border-radius: 3px; }
        input { color-scheme: dark; }
      `}</style>
    </div>
  );
}
