// Streaming MySQL dump parser tuned for this WP dump.
// - Captures CREATE TABLE column lists.
// - Iterates INSERT INTO ... VALUES (...),(...); rows for selected tables.
// Usage:
//   node parse-dump.mjs <dump-file> tables                # list tables + row counts
//   node parse-dump.mjs <dump-file> schema <table>        # CREATE TABLE columns
//   node parse-dump.mjs <dump-file> rows <table> [limit]  # iterate rows as JSON
//   node parse-dump.mjs <dump-file> count <table>         # exact row count

import fs from "node:fs";
import readline from "node:readline";

const file = process.argv[2];
const cmd = process.argv[3];
const arg = process.argv[4];
const arg2 = process.argv[5];

if (!file || !cmd) {
  console.error("usage: parse-dump.mjs <dump> <tables|schema|rows|count> [args]");
  process.exit(1);
}

// ---- column-name extraction from CREATE TABLE ----
async function readCreateTables() {
  const tables = {}; // name -> { columns: [name,...], createSql }
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let inCreate = false;
  let curName = null;
  let buf = [];
  for await (const line of rl) {
    if (!inCreate) {
      const m = line.match(/^CREATE TABLE `([^`]+)` \(/);
      if (m) {
        inCreate = true;
        curName = m[1];
        buf = [line];
      }
    } else {
      buf.push(line);
      if (/^\) ENGINE=/.test(line) || line.startsWith(")")) {
        const cols = [];
        for (const l of buf) {
          const cm = l.match(/^\s*`([^`]+)`\s+/);
          if (cm) cols.push(cm[1]);
        }
        tables[curName] = { columns: cols, createSql: buf.join("\n") };
        inCreate = false;
        curName = null;
        buf = [];
      }
    }
  }
  return tables;
}

// ---- SQL VALUES tuple parser ----
// Parses a single MySQL "(a,b,c),(d,e,f), ... ;" body into arrays of cell strings.
// Handles ' quoted strings with backslash escapes, NULL, numbers.
function* parseValues(body) {
  const n = body.length;
  let i = 0;
  while (i < n) {
    while (i < n && (body[i] === " " || body[i] === "," || body[i] === "\n" || body[i] === "\t" || body[i] === "\r")) i++;
    if (i >= n) break;
    if (body[i] !== "(") {
      // end of statement (";" or stray)
      if (body[i] === ";") return;
      i++;
      continue;
    }
    i++; // skip (
    const row = [];
    let cell = "";
    let inStr = false;
    while (i < n) {
      const c = body[i];
      if (inStr) {
        if (c === "\\") {
          // escape next char
          const nxt = body[i + 1];
          // common escapes
          if (nxt === "n") cell += "\n";
          else if (nxt === "r") cell += "\r";
          else if (nxt === "t") cell += "\t";
          else if (nxt === "0") cell += "\0";
          else if (nxt === "'" || nxt === '"' || nxt === "\\" || nxt === "/") cell += nxt;
          else cell += nxt;
          i += 2;
          continue;
        }
        if (c === "'") {
          // doubled '' inside string?
          if (body[i + 1] === "'") { cell += "'"; i += 2; continue; }
          inStr = false;
          i++;
          continue;
        }
        cell += c;
        i++;
        continue;
      }
      if (c === "'") { inStr = true; i++; continue; }
      if (c === ",") { row.push(cell); cell = ""; i++; continue; }
      if (c === ")") {
        row.push(cell);
        i++;
        yield row;
        // expect , or ;
        cell = "";
        break;
      }
      cell += c;
      i++;
    }
  }
}

function decodeCell(raw) {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (t === "NULL") return null;
  // numeric? leave as string for safety unless purely digit
  return raw;
}

// ---- streaming reader of INSERT statements for one table ----
async function* iterRowsForTable(tableName, columns) {
  const stream = fs.createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 });
  let pending = "";
  const startTok = `INSERT INTO \`${tableName}\` `;
  let collecting = false;
  let body = "";

  function* drainCompleteStmts(blob) {
    // blob may contain multiple INSERT...; statements; we extract one by one.
    let p = 0;
    while (true) {
      if (!collecting) {
        const idx = blob.indexOf(startTok, p);
        if (idx === -1) {
          // discard everything up to a safe boundary (last newline) to free memory
          const lastNl = blob.lastIndexOf("\n");
          if (lastNl > p) {
            blob = blob.slice(lastNl + 1);
            p = 0;
          } else {
            blob = blob.slice(p);
            p = 0;
          }
          pending = blob;
          return;
        }
        p = idx;
        // find " VALUES " after the column list
        const vIdx = blob.indexOf(" VALUES (", p);
        if (vIdx === -1) { pending = blob.slice(p); return; }
        collecting = true;
        body = "";
        p = vIdx + " VALUES ".length;
      }
      // collecting: scan to terminating ";\n" not inside string
      let inStr = false;
      let j = p;
      while (j < blob.length) {
        const c = blob[j];
        if (inStr) {
          if (c === "\\") { j += 2; continue; }
          if (c === "'") { inStr = false; j++; continue; }
          j++;
          continue;
        }
        if (c === "'") { inStr = true; j++; continue; }
        if (c === ";") { j++; break; }
        j++;
      }
      if (j >= blob.length) {
        // incomplete; carry the rest
        body += blob.slice(p);
        pending = "";
        // store partial statement state via outer var — we'll resume after appending more.
        partialBody = body;
        return;
      }
      // we have a complete statement body in blob[p..j-1]
      body += blob.slice(p, j - 1); // exclude ;
      // yield rows
      for (const row of parseValues(body)) {
        yieldQueue.push(row);
      }
      collecting = false;
      body = "";
      partialBody = "";
      p = j;
    }
  }

  let yieldQueue = [];
  let partialBody = "";

  for await (const chunk of stream) {
    let blob = pending + chunk;
    pending = "";
    if (collecting && partialBody) {
      // we are mid-statement; tack chunk onto body and search for ;
      let p = 0;
      let inStr = false;
      let j = 0;
      // Count escapes properly only within the new chunk; we assume previous body left us not inside a string at chunk boundary, which may be wrong.
      // To be safe, prepend partialBody to chunk and re-scan from start.
      const combined = partialBody + chunk;
      partialBody = "";
      body = "";
      // re-scan combined for terminator
      j = 0; inStr = false;
      while (j < combined.length) {
        const c = combined[j];
        if (inStr) {
          if (c === "\\") { j += 2; continue; }
          if (c === "'") { inStr = false; j++; continue; }
          j++;
          continue;
        }
        if (c === "'") { inStr = true; j++; continue; }
        if (c === ";") { j++; break; }
        j++;
      }
      if (j >= combined.length) {
        // still incomplete
        partialBody = combined;
        continue;
      }
      body = combined.slice(0, j - 1);
      for (const row of parseValues(body)) yieldQueue.push(row);
      collecting = false;
      body = "";
      blob = combined.slice(j); // remainder of chunk after ;
    }
    // process complete statements in blob
    // (helper above is closure-using; reimplement inline)
    let p = 0;
    while (true) {
      if (!collecting) {
        const idx = blob.indexOf(startTok, p);
        if (idx === -1) {
          const lastNl = blob.lastIndexOf("\n");
          pending = blob.slice(Math.max(p, lastNl + 1));
          break;
        }
        p = idx;
        const vIdx = blob.indexOf(" VALUES (", p);
        if (vIdx === -1) { pending = blob.slice(p); break; }
        collecting = true;
        p = vIdx + " VALUES ".length;
      }
      // scan for terminator
      let inStr = false;
      let j = p;
      while (j < blob.length) {
        const c = blob[j];
        if (inStr) {
          if (c === "\\") { j += 2; continue; }
          if (c === "'") { inStr = false; j++; continue; }
          j++;
          continue;
        }
        if (c === "'") { inStr = true; j++; continue; }
        if (c === ";") { j++; break; }
        j++;
      }
      if (j >= blob.length) {
        partialBody = blob.slice(p);
        pending = "";
        break;
      }
      const stmtBody = blob.slice(p, j - 1);
      for (const row of parseValues(stmtBody)) yieldQueue.push(row);
      collecting = false;
      p = j;
    }
    while (yieldQueue.length) yield yieldQueue.shift();
  }
  // flush any final partial (shouldn't happen for complete dump)
  while (yieldQueue.length) yield yieldQueue.shift();
}

// ---- commands ----
const tablesMeta = await readCreateTables();

if (cmd === "tables") {
  // count rows for every table by streaming once and summing per-table
  const counts = {};
  const stream = fs.createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 });
  let pending = "";
  // We want quick counts: each VALUES tuple = ( ... ) at the top level of an INSERT statement.
  // Strategy: for each INSERT statement, scan the body and count tuples by detecting "),(" plus first "(" + final ")".
  // Easier: collect statements per table and count via parseValues.
  // For efficiency: only iterate.
  // Simpler approach: regex/chunk find INSERT INTO `T` and parseValues.
  // Loop tables.
  for (const t of Object.keys(tablesMeta)) counts[t] = 0;
  // Single streaming pass: detect every INSERT statement, identify table, parse rows.
  const tableNames = Object.keys(tablesMeta);
  // We'll parse statement by statement.
  let buf = "";
  let collecting = false;
  let curT = null;

  for await (const chunk of stream) {
    buf += chunk;
    while (true) {
      if (!collecting) {
        const idx = buf.indexOf("INSERT INTO `");
        if (idx === -1) {
          // keep tail
          buf = buf.slice(Math.max(0, buf.length - 32));
          break;
        }
        const endName = buf.indexOf("`", idx + 13);
        if (endName === -1) break;
        const name = buf.slice(idx + 13, endName);
        const vIdx = buf.indexOf(" VALUES (", endName);
        if (vIdx === -1) break;
        curT = name;
        collecting = true;
        buf = buf.slice(vIdx + " VALUES ".length);
      }
      // scan for terminator
      let inStr = false;
      let j = 0;
      while (j < buf.length) {
        const c = buf[j];
        if (inStr) {
          if (c === "\\") { j += 2; continue; }
          if (c === "'") { inStr = false; j++; continue; }
          j++; continue;
        }
        if (c === "'") { inStr = true; j++; continue; }
        if (c === ";") { j++; break; }
        j++;
      }
      if (j >= buf.length) break; // need more data
      const body = buf.slice(0, j - 1);
      let n = 0;
      for (const _ of parseValues(body)) n++;
      counts[curT] = (counts[curT] || 0) + n;
      buf = buf.slice(j);
      collecting = false;
      curT = null;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [t, n] of sorted) console.log(`${n}\t${t}`);
  process.exit(0);
}

if (cmd === "schema") {
  const t = arg;
  const meta = tablesMeta[t];
  if (!meta) { console.error("no such table"); process.exit(2); }
  console.log(meta.createSql);
  process.exit(0);
}

if (cmd === "rows") {
  const t = arg;
  const limit = arg2 ? parseInt(arg2, 10) : Infinity;
  const meta = tablesMeta[t];
  if (!meta) { console.error("no such table"); process.exit(2); }
  let i = 0;
  for await (const row of iterRowsForTable(t, meta.columns)) {
    const obj = {};
    for (let k = 0; k < meta.columns.length; k++) obj[meta.columns[k]] = decodeCell(row[k]);
    process.stdout.write(JSON.stringify(obj) + "\n");
    i++;
    if (i >= limit) break;
  }
  process.exit(0);
}

if (cmd === "count") {
  const t = arg;
  const meta = tablesMeta[t];
  if (!meta) { console.error("no such table"); process.exit(2); }
  let n = 0;
  for await (const _ of iterRowsForTable(t, meta.columns)) n++;
  console.log(n);
  process.exit(0);
}

console.error("unknown command:", cmd);
process.exit(1);
