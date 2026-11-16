// src/lib/catalogPhotos.ts  (tested helper: finds product photos inside a PDF page)
export type Box = { x: number; y: number; w: number; h: number };
export type TextItem = { str: string; x: number; y: number };

/** Render one PDF page and return the canvas, the image boxes and the text positions (all in canvas pixels). */
export async function readPage(lib: any, page: any, scale = 2, makeCanvas?: (w: number, h: number) => any) {
  const { OPS, Util } = lib;
  const viewport = page.getViewport({ scale });
  const w = Math.ceil(viewport.width), h = Math.ceil(viewport.height);
  const canvas = makeCanvas ? makeCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;

  // 1) where are the images? walk the drawing commands and track the transform matrix
  const ops = await page.getOperatorList();
  const imgOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintJpegXObject].filter((x: any) => x !== undefined));
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const boxes: Box[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = Util.transform(ctm, args);
    else if (imgOps.has(fn)) {
      const m = Util.transform(viewport.transform, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const b = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      // ignore tiny icons and full-page backgrounds
      if (b.w >= 60 && b.h >= 60 && b.w * b.h < 0.85 * w * h) boxes.push(b);
    }
  }
  // 2) where is the text?
  const tc = await page.getTextContent();
  const texts: TextItem[] = tc.items.filter((t: any) => t.str && t.str.trim()).map((t: any) => {
    const m = Util.transform(viewport.transform, t.transform);
    return { str: t.str, x: m[4], y: m[5] };
  });
  return { canvas, boxes, texts };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** For each product name (anchor) return the index of its photo box, or -1. Photo is below or left of the name. */
export function matchPhotos(anchors: string[], boxes: Box[], texts: TextItem[]): number[] {
  const used = new Set<number>();
  const out: number[] = anchors.map(() => -1);
  anchors.forEach((a, k) => {
    const key = norm(a).slice(0, 18);
    if (!key) return;
    const t = texts.find(t => norm(t.str).includes(key));
    if (!t) return;
    let best = -1, bd = 1e9;
    boxes.forEach((b, i) => {
      if (used.has(i)) return;
      const below = t.y >= b.y + b.h - 5 && t.x >= b.x - 20 && t.x <= b.x + b.w;        // name under the photo
      const right = t.x >= b.x + b.w - 5 && t.y >= b.y - 20 && t.y <= b.y + b.h + 20;   // name right of the photo
      if (!below && !right) return;
      const d = below ? t.y - (b.y + b.h) : (t.x - (b.x + b.w)) + Math.abs(t.y - b.y) * 0.5;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { used.add(best); out[k] = best; }
  });
  // fallback: reading order (top to bottom, then left to right) for products that found no photo
  const free = boxes.map((_, i) => i).filter(i => !used.has(i))
    .sort((i, j) => (Math.round(boxes[i].y / 80) - Math.round(boxes[j].y / 80)) || boxes[i].x - boxes[j].x);
  out.forEach((v, k) => { if (v < 0 && free.length) out[k] = free.shift() as number; });
  return out;
}

/** Browser only: crop a box from the rendered page canvas and return a JPEG Blob. */
export function cropToBlob(canvas: HTMLCanvasElement, b: Box): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = Math.round(b.w); c.height = Math.round(b.h);
  c.getContext('2d')!.drawImage(canvas, Math.round(b.x), Math.round(b.y), c.width, c.height, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(bl => (bl ? res(bl) : rej(new Error('crop failed'))), 'image/jpeg', 0.85));
}