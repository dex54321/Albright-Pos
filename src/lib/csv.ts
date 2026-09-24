/** Detects the delimiter (comma/semicolon/tab) from the header row, then
 *  parses respecting quoted fields (so "Nails, 4"" survives a comma inside quotes). */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] ?? "";
  const count = (c: string) => (first.match(new RegExp(c === "\t" ? "\t" : "\\" + c, "g")) || []).length;
  const delim = ([",", ";", "\t"] as const).map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(",")
    )
    .join("\r\n");
}

export function downloadText(name: string, text: string, type = "text/csv") {
  const blob = new Blob(["\uFEFF" + text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/** Normalizes messy unit spellings ("No", "NO", "Kgs", "Bags"...) to one canonical name. */
const UNIT_ALIASES: Record<string, string> = {
  no: "Piece", nos: "Piece", pc: "Piece", pcs: "Piece", pic: "Piece", pics: "Piece", piece: "Piece", pieces: "Piece",
  kg: "Kg", kgs: "Kg",
  g: "Gram", gram: "Gram", grams: "Gram",
  bag: "Bag", bags: "Bag",
  roll: "Roll", rolls: "Roll",
  box: "Box", boxes: "Box",
  ctn: "Carton", carton: "Carton", cartons: "Carton",
  set: "Set", sets: "Set",
  liter: "Litre", liters: "Litre", litre: "Litre", litres: "Litre", l: "Litre",
  meter: "Metre", meters: "Metre", metre: "Metre", metres: "Metre", m: "Metre", ft: "Metre",
  packet: "Packet", packets: "Packet", pkt: "Packet", pkts: "Packet",
  dozen: "Dozen", dzn: "Dozen",
  pair: "Pair", pairs: "Pair",
  tin: "Tin", tins: "Tin",
  coil: "Coil", coils: "Coil",
  length: "Length", lengths: "Length",
};
export function normalizeUnit(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[.\s]+$/, "");
  if (!key) return "Piece";
  if (UNIT_ALIASES[key]) return UNIT_ALIASES[key];
  // Title-case anything unrecognized so it becomes its own sensible custom unit.
  return raw.trim().replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

/** Parses a price cell; returns null (not 0) for blank/garbage like "#VALUE!" so callers can flag it. */
export function parsePrice(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^#/.test(s)) return null; // #VALUE!, #REF!, etc.
  const n = parseFloat(s.replace(/,/g, ""));
  return isFinite(n) ? n : null;
}
