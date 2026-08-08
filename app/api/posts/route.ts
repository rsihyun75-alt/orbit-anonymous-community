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
    return Response.json({ error: "게시글을 불러오지 못했어요." }, { status: 500 });
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
      return Response.json({ error: "제목을 두 글자 이상 입력해 주세요." }, { status: 400 });
    }
    if (!input.content || input.content.length < 5) {
      return Response.json({ error: "내용을 다섯 글자 이상 입력해 주세요." }, { status: 400 });
    }
    if (!input.nickname || input.nickname.length < 2) {
      return Response.json({ error: "닉네임을 두 글자 이상 입력해 주세요." }, { status: 400 });
    }

    const post = await createPost(input);
    return Response.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts failed", error);
    return Response.json({ error: "게시글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
