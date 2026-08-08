import { getPost } from "../../../../lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) {
    return Response.json({ error: "寃뚯떆湲??李얠쓣 ???놁뼱??" }, { status: 404 });
  }

  try {
    const post = await getPost(postId);
    if (!post) {
      return Response.json({ error: "寃뚯떆湲??李얠쓣 ???놁뼱??" }, { status: 404 });
    }
    return Response.json(post, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/posts/[id] failed", error);
    return Response.json({ error: "寃뚯떆湲??遺덈윭?ㅼ? 紐삵뻽?댁슂." }, { status: 500 });
  }
}

