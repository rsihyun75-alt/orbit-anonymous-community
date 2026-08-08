import { commentBelongsToPost, createComment, getPost } from "../../../../../lib/db";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) {
    return Response.json({ error: "寃뚯떆湲??李얠쓣 ???놁뼱??" }, { status: 404 });
  }

  try {
    const post = await getPost(postId, false);
    if (!post) {
      return Response.json({ error: "寃뚯떆湲??李얠쓣 ???놁뼱??" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nickname = cleanText(body.nickname, 32);
    const content = cleanText(body.content, 600);
    const parentId =
      body.parentId === null || body.parentId === undefined || body.parentId === ""
        ? null
        : Number(body.parentId);

    if (!nickname || nickname.length < 2) {
      return Response.json({ error: "?됰꽕?꾩쓣 ??湲???댁긽 ?낅젰??二쇱꽭??" }, { status: 400 });
    }
    if (!content || content.length < 2) {
      return Response.json({ error: "?볤? ?댁슜????湲???댁긽 ?낅젰??二쇱꽭??" }, { status: 400 });
    }
    if (parentId !== null && (!Number.isInteger(parentId) || !(await commentBelongsToPost(postId, parentId)))) {
      return Response.json({ error: "??볤??????먮뙎湲??李얠쓣 ???놁뼱??" }, { status: 400 });
    }

    const comment = await createComment({ postId, parentId, nickname, content });
    return Response.json(comment, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts/[id]/comments failed", error);
    return Response.json({ error: "?볤?????ν븯吏 紐삵뻽?댁슂. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??" }, { status: 500 });
  }
}

