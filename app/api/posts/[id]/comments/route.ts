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
    return Response.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
  }

  try {
    const post = await getPost(postId, false);
    if (!post) {
      return Response.json({ error: "게시글을 찾을 수 없어요." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nickname = cleanText(body.nickname, 32);
    const content = cleanText(body.content, 600);
    const parentId =
      body.parentId === null || body.parentId === undefined || body.parentId === ""
        ? null
        : Number(body.parentId);

    if (!nickname || nickname.length < 2) {
      return Response.json({ error: "닉네임을 두 글자 이상 입력해 주세요." }, { status: 400 });
    }
    if (!content || content.length < 2) {
      return Response.json({ error: "댓글 내용을 두 글자 이상 입력해 주세요." }, { status: 400 });
    }
    if (parentId !== null && (!Number.isInteger(parentId) || !(await commentBelongsToPost(postId, parentId)))) {
      return Response.json({ error: "대댓글을 달 원댓글을 찾을 수 없어요." }, { status: 400 });
    }

    const comment = await createComment({ postId, parentId, nickname, content });
    return Response.json(comment, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts/[id]/comments failed", error);
    return Response.json({ error: "댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
