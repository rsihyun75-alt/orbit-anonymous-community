import { getPost } from "../../../../lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) {
    return Response.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
  }

  try {
    const post = await getPost(postId);
    if (!post) {
      return Response.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
    }
    return Response.json(post, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/posts/[id] failed", error);
    return Response.json({ error: "게시글을 불러오지 못했어요." }, { status: 500 });
  }
}
