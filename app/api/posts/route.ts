import { createPost, getPostSummaries } from "../../../lib/db";
import type { Category, CreatePostInput } from "../../../lib/types";

const allowedCategories: Array<Exclude<Category, "all">> = ["free", "question", "life", "tip"];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanContent(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isCategory(value: unknown): value is Exclude<Category, "all"> {
  return typeof value === "string" && allowedCategories.includes(value as Exclude<Category, "all">);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = cleanText(url.searchParams.get("q"), 80).toLowerCase();
    const category = url.searchParams.get("category");
    const posts = await getPostSummaries();
    const filtered = posts.filter((post) => {
      const matchesCategory = !isCategory(category) || post.category === category;
      const matchesQuery =
        !query ||
        post.title.toLowerCase().includes(query) ||
        post.excerpt.toLowerCase().includes(query) ||
        post.nickname.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
    return Response.json(filtered, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/posts failed", error);
    return Response.json({ error: "寃뚯떆湲??遺덈윭?ㅼ? 紐삵뻽?댁슂." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input: CreatePostInput = {
      title: cleanText(body.title, 120),
      content: cleanContent(body.content, 2000),
      nickname: cleanText(body.nickname, 32),
      category: isCategory(body.category) ? body.category : "free",
    };

    if (!input.title || input.title.length < 2) {
      return Response.json({ error: "?쒕ぉ????湲???댁긽 ?낅젰??二쇱꽭??" }, { status: 400 });
    }
    if (!input.content || input.content.length < 5) {
      return Response.json({ error: "?댁슜???ㅼ꽢 湲???댁긽 ?낅젰??二쇱꽭??" }, { status: 400 });
    }
    if (!input.nickname || input.nickname.length < 2) {
      return Response.json({ error: "?됰꽕?꾩쓣 ??湲???댁긽 ?낅젰??二쇱꽭??" }, { status: 400 });
    }

    const post = await createPost(input);
    return Response.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts failed", error);
    return Response.json({ error: "寃뚯떆湲????ν븯吏 紐삵뻽?댁슂. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??" }, { status: 500 });
  }
}

