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
  free: "?먯쑀?섎떎",
  question: "吏덈Ц?덉뼱??,
  life: "?쇱긽湲곕줉",
  tip: "?묒???,
};

const seedStore: FallbackStore = {
  posts: [
    {
      id: 1,
      title: "?붿쬁 ?섎? ?ㅼ떆 ?吏곸씠寃????묒? ?듦?",
      content:
        "嫄곗갹??紐⑺몴蹂대떎 留ㅼ씪 諛섎났?????덈뒗 ?묒? ?됰룞???섎굹 ?뺥빐 蹂대씪??留먯쓣 ?ｊ퀬, ?꾩묠留덈떎 李쎈Ц???щ뒗 ?쇰????쒖옉?덉뼱?? ?뉖튆??蹂닿퀬 臾쇱쓣 ????留덉떆??3遺꾩씠 ?앷컖蹂대떎 ?섎（??諛⑺뼢??留롮씠 諛붽퓭 二쇰꽕??",
      category: "life",
      nickname: "珥덈줉癒멸렇",
      createdAt: "2026-08-06T09:24:00+09:00",
      views: 128,
    },
    {
      id: 2,
      title: "?닿렐 ??20遺꾩쓣 ???곕뒗 諛⑸쾿???덉쓣源뚯슂?",
      content:
        "吏묒뿉 ?ㅻ㈃ 諛붾줈 ?꾩썙 踰꾨━???좎씠 留롮븘?? 吏㏐쾶?쇰룄 ?섎? ?꾪븳 ?쒓컙??留뚮뱾怨??띠뼱?? ?대룞?대굹 ?낆꽌泥섎읆 ?섏?媛 留롮씠 ?꾩슂????留먭퀬, 遺???놁씠 ?쒖옉?????덈뒗 諛⑸쾿??李얘퀬 ?덉뒿?덈떎.",
      category: "question",
      nickname: "?듬챸_17",
      createdAt: "2026-08-06T08:10:00+09:00",
      views: 94,
    },
    {
      id: 3,
      title: "鍮??ㅻ뒗 ?좎뿉 ?댁슱由щ뒗 ?뚮젅?대━?ㅽ듃",
      content:
        "?ㅻ뒛泥섎읆 鍮꾧? 議곗슜???대━???좎씠硫??좊궃??吏묒쨷???섎뤌?? ?щ윭遺꾩? ?대윴 ???대뼡 ?뚯븙??????먮굹?? 媛?ш? 留롮? ?딆? 怨≪씠硫???醫뗭쓣 寃?媛숈븘??",
      category: "free",
      nickname: "李쎄??먮━",
      createdAt: "2026-08-05T22:42:00+09:00",
      views: 76,
    },
    {
      id: 4,
      title: "?섎쭔???숇꽕 ?곗콉 肄붿뒪瑜?湲곕줉??遊ㅼ뼱??,
      content:
        "???30遺??숈븞 嫄룰린 醫뗭? 湲몄쓣 ?섎굹 諛쒓껄?덉뒿?덈떎. ?곌만?먯꽌 ??釉붾줉留??ㅼ뼱媛硫??묒? ?뺤썝怨??ㅻ옒??鍮듭쭛???댁뼱?몄꽌, ?좉퉸 ?ы뻾?섎뒗 湲곕텇???ㅼ뼱??",
      category: "tip",
      nickname: "?먮┛嫄몄쓬",
      createdAt: "2026-08-05T19:18:00+09:00",
      views: 61,
    },
  ],
  comments: [
    {
      id: 1,
      postId: 1,
      parentId: null,
      nickname: "?ㅻ뒛?섑뻼??,
      content: "????꾩묠??而ㅽ듉???щ뒗 寃껊????대낫怨??덉뼱?? ?뺣쭚 湲곕텇???щ씪吏?붾씪怨좎슂.",
      createdAt: "2026-08-06T10:02:00+09:00",
    },
    {
      id: 2,
      postId: 1,
      parentId: 1,
      nickname: "珥덈줉癒멸렇",
      content: "留욎븘?? ?묒븘??怨꾩냽?????덈떎??寃??쒖씪 醫뗭? 寃?媛숈븘??",
      createdAt: "2026-08-06T10:15:00+09:00",
    },
    {
      id: 3,
      postId: 2,
      parentId: null,
      nickname: "?щ갚?쒖뒪??,
      content: "????ㅼ썙?섍린 ?꾩뿉 ?ㅽ듃?덉묶 5遺꾩쓣 ?댁슂. ?쒖옉?섎㈃ ?앷컖蹂대떎 湲멸쾶 ?섍쾶 ?⑸땲??",
      createdAt: "2026-08-06T08:51:00+09:00",
    },
    {
      id: 4,
      postId: 3,
      parentId: null,
      nickname: "諛ㅼ궛梨?,
      content: "????쇱븘???곗＜怨≪쓣 ????ъ슂. 鍮??뚮━???욎씠硫?留덉쓬??李⑤텇?댁졇??",
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
    excerpt: post.content.length > 130 ? post.content.slice(0, 130) + "?? : post.content,
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

