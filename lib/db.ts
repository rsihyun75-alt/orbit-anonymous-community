import postgres from "postgres";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Category,
  CommentItem,
  CreateCommentInput,
  CreatePostInput,
  PostDetail,
  PostSummary,
} from "./types";

type StoredPost = {
  id: number;
  title: string;
  content: string;
  category: Exclude<Category, "all">;
  nickname: string;
  createdAt: string;
  views: number;
};

type StoredComment = {
  id: number;
  postId: number;
  parentId: number | null;
  nickname: string;
  content: string;
  createdAt: string;
};

type FallbackStore = {
  posts: StoredPost[];
  comments: StoredComment[];
};

type PostRow = {
  id: number | string;
  title: string;
  content: string;
  category: string;
  nickname: string;
  created_at: string | Date;
  views: number | string;
  comment_count?: number | string;
};

type CommentRow = {
  id: number | string;
  post_id: number | string;
  parent_id: number | string | null;
  nickname: string;
  content: string;
  created_at: string | Date;
};

const categoryLabels: Record<Exclude<Category, "all">, string> = {
  free: "자유수다",
  question: "질문있어요",
  life: "일상기록",
  tip: "작은팁",
};

const seedStore: FallbackStore = {
  posts: [
    {
      id: 1,
      title: "요즘 나를 다시 움직이게 한 작은 습관",
      content:
        "거창한 목표보다 매일 반복할 수 있는 작은 행동을 하나 정해 보라는 말을 듣고, 아침마다 창문을 여는 일부터 시작했어요. 햇빛을 보고 물을 한 잔 마시는 3분이 생각보다 하루의 방향을 많이 바꿔 주네요.",
      category: "life",
      nickname: "초록머그",
      createdAt: "2026-08-06T09:24:00+09:00",
      views: 128,
    },
    {
      id: 2,
      title: "퇴근 후 20분을 잘 쓰는 방법이 있을까요?",
      content:
        "집에 오면 바로 누워 버리는 날이 많아서, 짧게라도 나를 위한 시간을 만들고 싶어요. 운동이나 독서처럼 의지가 많이 필요한 일 말고, 부담 없이 시작할 수 있는 방법을 찾고 있습니다.",
      category: "question",
      nickname: "익명_17",
      createdAt: "2026-08-06T08:10:00+09:00",
      views: 94,
    },
    {
      id: 3,
      title: "비 오는 날에 어울리는 플레이리스트",
      content:
        "오늘처럼 비가 조용히 내리는 날이면 유난히 집중이 잘돼요. 여러분은 이런 날 어떤 음악을 틀어 두나요? 가사가 많지 않은 곡이면 더 좋을 것 같아요.",
      category: "free",
      nickname: "창가자리",
      createdAt: "2026-08-05T22:42:00+09:00",
      views: 76,
    },
    {
      id: 4,
      title: "나만의 동네 산책 코스를 기록해 봤어요",
      content:
        "저녁 30분 동안 걷기 좋은 길을 하나 발견했습니다. 큰길에서 한 블록만 들어가면 작은 정원과 오래된 빵집이 이어져서, 잠깐 여행하는 기분이 들어요.",
      category: "tip",
      nickname: "느린걸음",
      createdAt: "2026-08-05T19:18:00+09:00",
      views: 61,
    },
  ],
  comments: [
    {
      id: 1,
      postId: 1,
      parentId: null,
      nickname: "오늘의햇살",
      content: "저도 아침에 커튼을 여는 것부터 해보고 있어요. 정말 기분이 달라지더라고요.",
      createdAt: "2026-08-06T10:02:00+09:00",
    },
    {
      id: 2,
      postId: 1,
      parentId: 1,
      nickname: "초록머그",
      content: "맞아요. 작아서 계속할 수 있다는 게 제일 좋은 것 같아요.",
      createdAt: "2026-08-06T10:15:00+09:00",
    },
    {
      id: 3,
      postId: 2,
      parentId: null,
      nickname: "여백한스푼",
      content: "저는 샤워하기 전에 스트레칭 5분을 해요. 시작하면 생각보다 길게 하게 됩니다.",
      createdAt: "2026-08-06T08:51:00+09:00",
    },
    {
      id: 4,
      postId: 3,
      parentId: null,
      nickname: "밤산책",
      content: "저는 피아노 연주곡을 틀어 둬요. 비 소리랑 섞이면 마음이 차분해져요.",
      createdAt: "2026-08-05T23:08:00+09:00",
    },
  ],
};

const fallbackFile = path.join(process.cwd(), "data", "community.json");

declare global {
  var __orbitSql: ReturnType<typeof postgres> | undefined;
  var __orbitSchemaPromise: Promise<void> | undefined;
  var __orbitFallbackPromise: Promise<FallbackStore> | undefined;
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function cloneSeedStore(): FallbackStore {
  return {
    posts: seedStore.posts.map((post) => ({ ...post })),
    comments: seedStore.comments.map((comment) => ({ ...comment })),
  };
}

async function loadFallback(): Promise<FallbackStore> {
  if (!globalThis.__orbitFallbackPromise) {
    globalThis.__orbitFallbackPromise = (async () => {
      try {
        const raw = await readFile(fallbackFile, "utf8");
        return JSON.parse(raw) as FallbackStore;
      } catch {
        const initial = cloneSeedStore();
        try {
          await mkdir(path.dirname(fallbackFile), { recursive: true });
          await writeFile(fallbackFile, JSON.stringify(initial, null, 2), "utf8");
        } catch {
          // Vercel's serverless filesystem is read-only. Keep the seeded
          // store in memory until a DATABASE_URL is configured.
        }
        return initial;
      }
    })();
  }

  return globalThis.__orbitFallbackPromise;
}

async function persistFallback(store: FallbackStore) {
  try {
    await mkdir(path.dirname(fallbackFile), { recursive: true });
    await writeFile(fallbackFile, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Mutations still work for the lifetime of a warm serverless instance.
  }
}

function sqlClient() {
  if (!globalThis.__orbitSql) {
    globalThis.__orbitSql = postgres(process.env.DATABASE_URL as string, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return globalThis.__orbitSql;
}

async function getSql() {
  const sql = sqlClient();
  if (!globalThis.__orbitSchemaPromise) {
    globalThis.__orbitSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS community_posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(120) NOT NULL,
          content TEXT NOT NULL,
          category VARCHAR(20) NOT NULL DEFAULT 'free',
          nickname VARCHAR(32) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          views INTEGER NOT NULL DEFAULT 0
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS community_comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
          parent_id INTEGER REFERENCES community_comments(id) ON DELETE CASCADE,
          content VARCHAR(600) NOT NULL,
          nickname VARCHAR(32) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON community_posts(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS community_comments_post_id_idx ON community_comments(post_id)`;
      const countRows = (await sql`SELECT COUNT(*)::int AS count FROM community_posts`) as unknown as Array<{ count: number }>;
      if (Number(countRows[0]?.count ?? 0) === 0) {
        for (const post of seedStore.posts) {
          await sql`
            INSERT INTO community_posts (id, title, content, category, nickname, created_at, views)
            VALUES (${post.id}, ${post.title}, ${post.content}, ${post.category}, ${post.nickname}, ${post.createdAt}, ${post.views})
          `;
        }
        for (const comment of seedStore.comments) {
          await sql`
            INSERT INTO community_comments (id, post_id, parent_id, content, nickname, created_at)
            VALUES (${comment.id}, ${comment.postId}, ${comment.parentId}, ${comment.content}, ${comment.nickname}, ${comment.createdAt})
          `;
        }
        await sql`SELECT setval(pg_get_serial_sequence('community_posts', 'id'), COALESCE((SELECT MAX(id) FROM community_posts), 1))`;
        await sql`SELECT setval(pg_get_serial_sequence('community_comments', 'id'), COALESCE((SELECT MAX(id) FROM community_comments), 1))`;
      }
    })();
  }

  await globalThis.__orbitSchemaPromise;
  return sql;
}

function toIso(value: string | Date) {
  return new Date(value).toISOString();
}

function normalizeCategory(value: string): Exclude<Category, "all"> {
  return value === "question" || value === "life" || value === "tip" ? value : "free";
}

function summaryFromPost(post: StoredPost, commentCount: number): PostSummary {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.content.length > 130 ? post.content.slice(0, 130) + "…" : post.content,
    category: post.category,
    categoryLabel: categoryLabels[post.category],
    nickname: post.nickname,
    createdAt: post.createdAt,
    views: post.views,
    commentCount,
  };
}

function postFromRow(row: PostRow): StoredPost {
  return {
    id: Number(row.id),
    title: row.title,
    content: row.content,
    category: normalizeCategory(row.category),
    nickname: row.nickname,
    createdAt: toIso(row.created_at),
    views: Number(row.views),
  };
}

function commentFromRow(row: CommentRow): StoredComment {
  return {
    id: Number(row.id),
    postId: Number(row.post_id),
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    nickname: row.nickname,
    content: row.content,
    createdAt: toIso(row.created_at),
  };
}

function buildCommentTree(comments: StoredComment[]): CommentItem[] {
  const nodes = new Map<number, CommentItem>();
  const roots: CommentItem[] = [];

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;
    if (comment.parentId !== null && nodes.has(comment.parentId)) {
      nodes.get(comment.parentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getPostSummaries(): Promise<PostSummary[]> {
  if (!hasDatabase()) {
    const store = await loadFallback();
    const commentCounts = new Map<number, number>();
    for (const comment of store.comments) {
      commentCounts.set(comment.postId, (commentCounts.get(comment.postId) ?? 0) + 1);
    }
    return [...store.posts]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((post) => summaryFromPost(post, commentCounts.get(post.id) ?? 0));
  }

  const sql = await getSql();
  const rows = (await sql`
    SELECT p.id, p.title, p.content, p.category, p.nickname, p.created_at, p.views,
      COUNT(c.id)::int AS comment_count
    FROM community_posts p
    LEFT JOIN community_comments c ON c.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `) as unknown as PostRow[];

  return rows.map((row) => summaryFromPost(postFromRow(row), Number(row.comment_count ?? 0)));
}

export async function getPost(postId: number, incrementView = true): Promise<PostDetail | null> {
  if (!hasDatabase()) {
    const store = await loadFallback();
    const post = store.posts.find((item) => item.id === postId);
    if (!post) return null;
    if (incrementView) {
      post.views += 1;
      await persistFallback(store);
    }
    const comments = store.comments.filter((comment) => comment.postId === postId);
    return {
      ...summaryFromPost(post, comments.length),
      content: post.content,
      comments: buildCommentTree(comments),
    };
  }

  const sql = await getSql();
  if (incrementView) {
    await sql`UPDATE community_posts SET views = views + 1 WHERE id = ${postId}`;
  }
  const postRows = (await sql`
    SELECT id, title, content, category, nickname, created_at, views
    FROM community_posts
    WHERE id = ${postId}
  `) as unknown as PostRow[];
  const post = postRows[0];
  if (!post) return null;
  const commentRows = (await sql`
    SELECT id, post_id, parent_id, nickname, content, created_at
    FROM community_comments
    WHERE post_id = ${postId}
    ORDER BY created_at ASC
  `) as unknown as CommentRow[];
  const storedPost = postFromRow(post);
  const storedComments = commentRows.map(commentFromRow);
  return {
    ...summaryFromPost(storedPost, storedComments.length),
    content: storedPost.content,
    comments: buildCommentTree(storedComments),
  };
}

export async function createPost(input: CreatePostInput): Promise<PostSummary> {
  if (!hasDatabase()) {
    const store = await loadFallback();
    const post: StoredPost = {
      id: Math.max(0, ...store.posts.map((item) => item.id)) + 1,
      title: input.title,
      content: input.content,
      category: input.category,
      nickname: input.nickname,
      createdAt: new Date().toISOString(),
      views: 0,
    };
    store.posts.push(post);
    await persistFallback(store);
    return summaryFromPost(post, 0);
  }

  const sql = await getSql();
  const rows = (await sql`
    INSERT INTO community_posts (title, content, category, nickname)
    VALUES (${input.title}, ${input.content}, ${input.category}, ${input.nickname})
    RETURNING id, title, content, category, nickname, created_at, views
  `) as unknown as PostRow[];
  return summaryFromPost(postFromRow(rows[0]), 0);
}

export async function commentBelongsToPost(postId: number, commentId: number) {
  if (!hasDatabase()) {
    const store = await loadFallback();
    return store.comments.some((comment) => comment.id === commentId && comment.postId === postId);
  }

  const sql = await getSql();
  const rows = (await sql`
    SELECT id FROM community_comments WHERE id = ${commentId} AND post_id = ${postId}
  `) as unknown as Array<{ id: number }>;
  return rows.length > 0;
}

export async function createComment(input: CreateCommentInput): Promise<CommentItem> {
  const createdAt = new Date().toISOString();
  if (!hasDatabase()) {
    const store = await loadFallback();
    const comment: StoredComment = {
      id: Math.max(0, ...store.comments.map((item) => item.id)) + 1,
      postId: input.postId,
      parentId: input.parentId,
      nickname: input.nickname,
      content: input.content,
      createdAt,
    };
    store.comments.push(comment);
    await persistFallback(store);
    return { ...comment, replies: [] };
  }

  const sql = await getSql();
  const rows = (await sql`
    INSERT INTO community_comments (post_id, parent_id, nickname, content, created_at)
    VALUES (${input.postId}, ${input.parentId}, ${input.nickname}, ${input.content}, ${createdAt})
    RETURNING id, post_id, parent_id, nickname, content, created_at
  `) as unknown as CommentRow[];
  return { ...commentFromRow(rows[0]), replies: [] };
}

export function getCategoryLabel(category: Exclude<Category, "all">) {
  return categoryLabels[category];
}
