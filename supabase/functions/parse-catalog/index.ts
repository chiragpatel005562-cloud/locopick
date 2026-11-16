const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedItem {
  name: string | null;
  anchor_text: string | null;
  description: string | null;
  category: string | null;
  material_or_quality: string | null;
  color: string | null;
  price: number | null;
  mrp: number | null;
  sizes: { size: string; quantity: number }[] | null;
  quantity: number | null;
  position: number | null;
  page: number;
  photo_box: [number, number, number, number] | null;
}

const MODEL = "qwen/qwen3.8-27b";

const VALID_CATEGORIES = ["fashion", "decor", "electronics", "home", "beauty", "gifts", "other"];

const SYSTEM_PROMPT = `You read a wholesaler product catalog page. You receive both the text layer extracted from the page and a page image. The text layer is the source of truth for names, prices, sizes and quantities. The image is only for layout context.

Extract every product shown. One object per product — never merge products. Use null where a value is not printed. Do not guess or invent values.

Return exactly {"items":[...]} — JSON only, no prose, no code fences. Each item has these keys and no others:
- name: string|null
- anchor_text: string|null (the product name exactly as printed in the text layer, used to locate the photo)
- description: string|null (one short sentence from printed text only)
- category: "fashion"|"decor"|"electronics"|"home"|"beauty"|"gifts"|"other"|null
- material_or_quality: string|null (only if printed, e.g. 'pure cotton', GSM or grade)
- color: string|null
- price: number|null (selling price in INR)
- mrp: number|null (INR)
- sizes: [{"size": string, "quantity": number}]|null (only if printed, for fashion items)
- quantity: number|null (total pieces if printed)
- position: number (reading-order index on the page: top to bottom, then left to right, starting at 0)
- page: number (the page index provided to you)
- photo_box: [ymin, xmin, ymax, xmax]|null (bounding box of the product photo, normalized 0-1000; null if no photo)`;

function stripCodeFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    const firstNewline = t.indexOf("\n");
    if (firstNewline !== -1) t = t.slice(firstNewline + 1);
    else t = t.slice(3);
  }
  if (t.endsWith("```")) t = t.slice(0, -3);
  return t.trim();
}

function cleanNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[₹Rs.,\s]/gi, "").replace(/rs/gi, "");
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

function cleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function cleanCategory(v: unknown): string | null {
  const s = cleanString(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  return VALID_CATEGORIES.includes(lower) ? lower : "other";
}

function cleanSizes(v: unknown): { size: string; quantity: number }[] | null {
  if (!Array.isArray(v)) return null;
  const result: { size: string; quantity: number }[] = [];
  for (const s of v) {
    const size = String((s as Record<string, unknown>).size ?? "").trim().toUpperCase();
    const qty = cleanNumber((s as Record<string, unknown>).quantity) ?? 0;
    if (size) result.push({ size, quantity: qty });
  }
  return result.length > 0 ? result : null;
}

function cleanBox(v: unknown): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const nums = v.map(Number);
  if (nums.some((n) => isNaN(n))) return null;
  return nums as [number, number, number, number];
}

function validateItem(raw: Record<string, unknown>, pageIndex: number): ParsedItem | null {
  const name = cleanString(raw.name);
  const price = cleanNumber(raw.price);
  const mrp = cleanNumber(raw.mrp);
  const description = cleanString(raw.description);
  // Drop empty items: must have at least a name or a price
  if (!name && price == null && mrp == null && !description) return null;
  return {
    name,
    anchor_text: cleanString(raw.anchor_text),
    description,
    category: cleanCategory(raw.category),
    material_or_quality: cleanString(raw.material_or_quality),
    color: cleanString(raw.color),
    price,
    mrp,
    sizes: cleanSizes(raw.sizes),
    quantity: cleanNumber(raw.quantity),
    position: typeof raw.position === "number" ? raw.position : null,
    page: typeof raw.page === "number" ? raw.page : pageIndex,
    photo_box: cleanBox(raw.photo_box),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing secret: GROQ_API_KEY. Add it to the Edge Function configuration." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const images: string[] = body.images ?? [];
    const pageIndex: number = body.page ?? 0;
    const textLayer: string | undefined = body.text;

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ error: "No images provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sizesKb = images.map((img) => Math.round((img.length * 3) / 4 / 1024));
    console.log(`parse-catalog: model=${MODEL} pages=${images.length} sizesKb=${JSON.stringify(sizesKb)} hasText=${!!textLayer}`);

    const textPart = textLayer
      ? `TEXT LAYER (source of truth for names, prices, sizes, quantities):\n"""\n${textLayer.slice(0, 8000)}\n"""\n\nIMAGE: page image for layout context only.\n\nExtract every product from the text layer above. Use the image only to understand layout. Return exactly {"items":[...]} with position in reading order (top to bottom, then left to right, starting at 0) and page = ${pageIndex}.`
      : SYSTEM_PROMPT;

    const userContent: unknown[] = [{ type: "text", text: textPart }];
    for (const img of images) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.log(`parse-catalog: Groq returned ${groqResponse.status}`);
      console.log(`parse-catalog: Groq response body: ${errText}`);
      let errMsg = `Groq returned ${groqResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        const msg = errJson?.error?.message ?? errJson?.message;
        if (msg) errMsg = `Groq returned ${groqResponse.status}: ${msg}`;
      } catch {
        if (errText) errMsg = `Groq returned ${groqResponse.status}: ${errText.slice(0, 120)}`;
      }
      return new Response(
        JSON.stringify({ error: errMsg.slice(0, 200), upstreamStatus: groqResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const groqData = await groqResponse.json();
    const textContent = groqData?.choices?.[0]?.message?.content;
    let items: ParsedItem[] = [];
    if (textContent) {
      try {
        const cleaned = stripCodeFences(textContent);
        const parsed = JSON.parse(cleaned);
        const rawItems: Record<string, unknown>[] = parsed.items ?? parsed.products ?? [];
        items = rawItems
          .map((raw) => validateItem(raw, pageIndex))
          .filter((item): item is ParsedItem => item !== null);
        // Sort by position then page
        items.sort((a, b) => {
          if (a.position != null && b.position != null) return a.position - b.position;
          return 0;
        });
      } catch (e) {
        console.log(`parse-catalog: JSON parse failed: ${e instanceof Error ? e.message : e}`);
        items = [];
      }
    }

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to parse catalog", detail: error instanceof Error ? error.message.slice(0, 200) : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
