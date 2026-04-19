/**
 * Zero-dependency ZIP creator (uncompressed / STORE method).
 *
 * Writes a valid .zip archive from a { filename: contents } map in one pass.
 * We only need STORE mode because the files we ship are tiny text files;
 * deflate would save a few KB at the cost of pulling in JSZip / pako.
 *
 * Spec: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 */

const te = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let c = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE: number[] = (() => {
  const t: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function u16(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
}

function u32(v: number): Uint8Array {
  return new Uint8Array([
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ]);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Build a ZIP archive as a Blob. Pure JS, no third-party deps.
 */
export function buildZip(files: Record<string, string>): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  // DOS timestamp: pick "now" (local, but the spec allows anything).
  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((Math.floor(now.getSeconds() / 2)) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const [name, contents] of Object.entries(files)) {
    const nameBytes = te.encode(name);
    const data = te.encode(typeof contents === "string" ? contents : "");
    const crc = crc32(data);

    // Local file header
    const localHeader = concat([
      u32(0x04034b50), // signature
      u16(20),         // version needed
      u16(0),          // flags
      u16(0),          // compression = STORE
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length), // compressed size
      u32(data.length), // uncompressed size
      u16(nameBytes.length),
      u16(0),          // extra length
      nameBytes,
      data,
    ]);
    localParts.push(localHeader);

    // Central directory entry
    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),         // version made by
      u16(20),         // version needed
      u16(0),          // flags
      u16(0),          // compression
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),          // extra length
      u16(0),          // comment length
      u16(0),          // disk number start
      u16(0),          // internal attrs
      u32(0),          // external attrs
      u32(offset),     // local header offset
      nameBytes,
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.length;
  }

  const local = concat(localParts);
  const central = concat(centralParts);

  // End-of-central-directory
  const eocd = concat([
    u32(0x06054b50),
    u16(0),                             // disk number
    u16(0),                             // disk where central dir starts
    u16(centralParts.length),           // entries on this disk
    u16(centralParts.length),           // total entries
    u32(central.length),                // size of central dir
    u32(local.length),                  // offset of central dir
    u16(0),                             // comment length
  ]);

  const buffer = concat([local, central, eocd]);
  return new Blob([buffer], { type: "application/zip" });
}

export function downloadZip(filename: string, files: Record<string, string>): void {
  const blob = buildZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
