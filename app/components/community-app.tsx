"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Category, CommentItem, PostDetail, PostSummary } from "../../lib/types";

const categoryOptions: Array<{ value: Exclude<Category, "all">; label: string; symbol: string }> = [
  { value: "free", label: "자유수다", symbol: "◎" },
  { value: "question", label: "질문있어요", symbol: "?" },
  { value: "life", label: "일상기록", symbol: "◌" },
  { value: "tip", label: "작은팁", symbol: "✦" },
];

const categoryMap = Object.fromEntries(categoryOptions.map((item) => [item.value, item])) as Record<
  Exclude<Category, "all">,
  { value: Exclude<Category, "all">; label: string; symbol: string }
>;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function insertComment(comments: CommentItem[], comment: CommentItem, parentId: number | null): CommentItem[] {
  if (parentId === null) return [...comments, comment];
  return comments.map((item) => {
    if (item.id === parentId) {
      return { ...item, replies: [...item.replies, comment] };
    }
    return { ...item, replies: insertComment(item.replies, comment, parentId) };
  });
}

function CommentBranch({
  comment,
  onReply,
}: {
  comment: CommentItem;
  onReply: (comment: CommentItem) => void;
}) {
  return (
    <div className="comment-branch">
      <div className="comment-card">
        <div className="comment-avatar" aria-hidden="true">
          {comment.nickname.slice(0, 1)}
        </div>
        <div className="comment-main">
          <div className="comment-meta">
            <strong>{comment.nickname}</strong>
            <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
          </div>
          <p>{comment.content}</p>
          <button className="reply-button" type="button" onClick={() => onReply(comment)}>
            답글 달기 <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      {comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentBranch key={reply.id} comment={reply} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onOpen }: { post: PostSummary; onOpen: (id: number) => void }) {
  const category = categoryMap[post.category];
  return (
    <button className="post-card" type="button" onClick={() => onOpen(post.id)}>
      <div className="post-card-top">
        <span className={classNames("category-pill", "category-" + post.category)}>
          <span aria-hidden="true">{category.symbol}</span>
          {category.label}
        </span>
        <span className="post-card-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
      <h3>{post.title}</h3>
      <p className="post-excerpt">{post.excerpt}</p>
      <div className="post-card-bottom">
        <span className="post-author">
          <span className="mini-avatar" aria-hidden="true">
            {post.nickname.slice(0, 1)}
          </span>
          {post.nickname}
        </span>
        <span className="post-card-stats">
          <span aria-label="댓글 수">♡ {post.commentCount}</span>
          <span aria-label="조회 수">◉ {post.views}</span>
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        </span>
      </div>
    </button>
  );
}

function CategoryNav({
  activeCategory,
  posts,
  onChange,
}: {
  activeCategory: Category;
  posts: PostSummary[];
  onChange: (category: Category) => void;
}) {
  const countFor = (category: Category) =>
    category === "all" ? posts.length : posts.filter((post) => post.category === category).length;

  return (
    <nav className="category-nav" aria-label="게시글 카테고리">
      <button
        className={classNames("category-nav-item", activeCategory === "all" && "is-active")}
        type="button"
        onClick={() => onChange("all")}
      >
        <span className="nav-symbol">⌂</span>
        <span>전체 이야기</span>
        <b>{countFor("all")}</b>
      </button>
      {categoryOptions.map((category) => (
        <button
          className={classNames("category-nav-item", activeCategory === category.value && "is-active")}
          type="button"
          onClick={() => onChange(category.value)}
          key={category.value}
        >
          <span className="nav-symbol">{category.symbol}</span>
          <span>{category.label}</span>
          <b>{countFor(category.value)}</b>
        </button>
      ))}
    </nav>
  );
}

export default function CommunityApp({ initialPostId }: { initialPostId?: number }) {
  const router = useRouter();
  const isDetailPage = typeof initialPostId === "number";
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(isDetailPage);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newNickname, setNewNickname] = useState("익명_새벽");
  const [newCategory, setNewCategory] = useState<Exclude<Category, "all">>("free");
  const [commentNickname, setCommentNickname] = useState("익명_새벽");
  const [commentBody, setCommentBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [isCommentSending, setIsCommentSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/posts", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "게시글을 불러오지 못했어요."));
        return (await response.json()) as PostSummary[];
      })
      .then((loadedPosts) => {
        if (!cancelled) {
          setPosts(loadedPosts);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "게시글을 불러오지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof initialPostId !== "number") {
      return;
    }

    let cancelled = false;
    fetch("/api/posts/" + initialPostId, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "게시글을 찾을 수 없어요."));
        return (await response.json()) as PostDetail;
      })
      .then((loadedDetail) => {
        if (!cancelled) {
          setDetail(loadedDetail);
          setError("");
          setPosts((current) =>
            current.map((post) =>
              post.id === loadedDetail.id
                ? { ...post, views: loadedDetail.views, commentCount: loadedDetail.commentCount }
                : post,
            ),
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(reason instanceof Error ? reason.message : "게시글을 찾을 수 없어요.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialPostId]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesCategory = activeCategory === "all" || post.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        post.title.toLowerCase().includes(normalizedQuery) ||
        post.excerpt.toLowerCase().includes(normalizedQuery) ||
        post.nickname.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, posts, query]);

  const totalComments = posts.reduce((sum, post) => sum + post.commentCount, 0);
  const latestPosts = posts.filter((post) => post.id !== detail?.id).slice(0, 3);

  function goHome() {
    router.push("/");
  }

  function openPost(id: number) {
    router.push("/posts/" + id);
  }

  function resetComposer() {
    setNewTitle("");
    setNewContent("");
    setNewNickname("익명_새벽");
    setNewCategory("free");
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setError("");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          nickname: newNickname,
          category: newCategory,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "게시글을 저장하지 못했어요."));
      const createdPost = (await response.json()) as PostSummary;
      setPosts((current) => [createdPost, ...current]);
      resetComposer();
      setShowComposer(false);
      router.push("/posts/" + createdPost.id);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "게시글을 저장하지 못했어요.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || isCommentSending) return;
    setIsCommentSending(true);
    setError("");
    const parentId = replyTarget?.id ?? null;

    try {
      const response = await fetch("/api/posts/" + detail.id + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: commentNickname,
          content: commentBody,
          parentId,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, "댓글을 저장하지 못했어요."));
      const createdComment = (await response.json()) as CommentItem;
      setDetail((current) =>
        current
          ? {
              ...current,
              commentCount: current.commentCount + 1,
              comments: insertComment(current.comments, createdComment, parentId),
            }
          : current,
      );
      setPosts((current) =>
        current.map((post) =>
          post.id === detail.id ? { ...post, commentCount: post.commentCount + 1 } : post,
        ),
      );
      setCommentBody("");
      setReplyTarget(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "댓글을 저장하지 못했어요.");
    } finally {
      setIsCommentSending(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand-lockup" type="button" onClick={goHome} aria-label="orbit 홈">
          <span className="brand-orbit" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="brand-name">orbit</span>
          <span className="brand-subtitle">anonymous community</span>
        </button>
        <nav className="header-nav" aria-label="사이트 메뉴">
          <button className={classNames(!isDetailPage && "is-current")} type="button" onClick={goHome}>
            둘러보기
          </button>
          <a href="#how-it-works">이용 안내</a>
        </nav>
        <button className="header-write" type="button" onClick={() => setShowComposer(true)}>
          이야기 쓰기 <span aria-hidden="true">＋</span>
        </button>
      </header>

      {error && (
        <div className="error-strip" role="alert">
          <span aria-hidden="true">!</span>
          {error}
          <button type="button" onClick={() => setError("")} aria-label="오류 닫기">
            ×
          </button>
        </div>
      )}

      {!isDetailPage ? (
        <>
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow">A SMALL PLACE TO BE HONEST</p>
              <h1>
                지금,
                <br />
                <em>편하게</em> 이야기해요.
              </h1>
              <p className="hero-description">
                이름 없이도 괜찮아요.
                <br />
                오늘의 생각을 놓고, 누군가의 문장에 머물러 보세요.
              </p>
            </div>
            <div className="hero-graphic" aria-hidden="true">
              <div className="graphic-star star-one">✦</div>
              <div className="graphic-star star-two">✧</div>
              <div className="orbit-circle circle-outer" />
              <div className="orbit-circle circle-middle" />
              <div className="orbit-circle circle-inner">
                <span>orbit</span>
              </div>
              <div className="graphic-note">no login<br />just talk</div>
            </div>
            <div className="hero-stats" aria-label="커뮤니티 현황">
              <div>
                <strong>{formatCount(posts.length)}</strong>
                <span>stories today</span>
              </div>
              <div>
                <strong>{formatCount(totalComments)}</strong>
                <span>kind replies</span>
              </div>
            </div>
          </section>

          <section className="notice-band" id="how-it-works">
            <div className="notice-mark" aria-hidden="true">
              ◌
            </div>
            <div>
              <strong>가입 없이 바로 이야기해요</strong>
              <p>닉네임은 이 글에서만 사용돼요. 서로의 하루를 가볍게 존중해 주세요.</p>
            </div>
            <button type="button" onClick={() => setShowComposer(true)}>
              첫 글 남기기 <span aria-hidden="true">→</span>
            </button>
          </section>

          <main className="content-grid">
            <aside className="category-sidebar">
              <div className="sidebar-heading">
                <span className="eyebrow">EXPLORE</span>
                <span className="sidebar-live">
                  <i /> LIVE
                </span>
              </div>
              <h2>어떤 이야기를<br />찾고 있나요?</h2>
              <CategoryNav activeCategory={activeCategory} posts={posts} onChange={setActiveCategory} />
              <div className="sidebar-tip">
                <span aria-hidden="true">✳</span>
                <p>좋은 질문 하나가<br /><b>좋은 대화</b>를 시작해요.</p>
              </div>
            </aside>

            <section className="feed-section" aria-labelledby="feed-title">
              <div className="feed-heading">
                <div>
                  <p className="eyebrow">JUST LANDED</p>
                  <h2 id="feed-title">새로 올라온 이야기</h2>
                </div>
                <label className="search-field">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="이야기 검색"
                    aria-label="이야기 검색"
                  />
                </label>
              </div>
              <div className="feed-meta">
                <span>{filteredPosts.length}개의 이야기</span>
                <span className="sort-label">최신순 <span aria-hidden="true">⌄</span></span>
              </div>
              <div className="post-list" aria-live="polite">
                {isLoading ? (
                  <>
                    <div className="post-skeleton" />
                    <div className="post-skeleton" />
                    <div className="post-skeleton" />
                  </>
                ) : filteredPosts.length > 0 ? (
                  filteredPosts.map((post) => <PostCard key={post.id} post={post} onOpen={openPost} />)
                ) : (
                  <div className="empty-feed">
                    <span aria-hidden="true">◌</span>
                    <h3>아직 딱 맞는 이야기가 없어요.</h3>
                    <p>검색어를 바꾸거나, 새로운 이야기를 먼저 남겨 보세요.</p>
                    <button type="button" onClick={() => setShowComposer(true)}>
                      이야기 쓰기
                    </button>
                  </div>
                )}
              </div>
            </section>

            <aside className="community-sidebar">
              <section className="guide-card">
                <div className="guide-card-top">
                  <span className="eyebrow">ORBIT NOTE 01</span>
                  <span aria-hidden="true">✦</span>
                </div>
                <h2>이곳에서는<br /><em>천천히</em> 말해도 돼요.</h2>
                <p>정답보다 서로의 경험을 나누는 곳. 작은 문장도 누군가에게는 큰 힌트가 됩니다.</p>
                <div className="guide-lines">
                  <span>01&nbsp; 이름 대신 마음을 남겨요</span>
                  <span>02&nbsp; 다름을 서두르지 않아요</span>
                </div>
              </section>
              <section className="latest-card">
                <div className="latest-heading">
                  <span className="eyebrow">MORE TO READ</span>
                  <span aria-hidden="true">↗</span>
                </div>
                {posts.slice(0, 3).map((post, index) => (
                  <button className="latest-item" key={post.id} type="button" onClick={() => openPost(post.id)}>
                    <span className="latest-number">0{index + 1}</span>
                    <span className="latest-title">{post.title}</span>
                    <span className="latest-arrow" aria-hidden="true">↗</span>
                  </button>
                ))}
              </section>
            </aside>
          </main>
        </>
      ) : (
        <main className="detail-page">
          <button className="back-link" type="button" onClick={goHome}>
            <span aria-hidden="true">←</span> 모든 이야기로 돌아가기
          </button>
          {isDetailLoading ? (
            <div className="detail-loading">
              <div className="post-skeleton large" />
              <div className="post-skeleton comments-skeleton" />
            </div>
          ) : detail ? (
            <div className="detail-layout">
              <article className="detail-card">
                <div className="detail-card-top">
                  <span className={classNames("category-pill", "category-" + detail.category)}>
                    <span aria-hidden="true">{categoryMap[detail.category].symbol}</span>
                    {detail.categoryLabel}
                  </span>
                  <span className="detail-date">{formatDate(detail.createdAt)}</span>
                </div>
                <h1>{detail.title}</h1>
                <div className="detail-author">
                  <span className="author-avatar" aria-hidden="true">{detail.nickname.slice(0, 1)}</span>
                  <span><b>{detail.nickname}</b><small>익명으로 남긴 이야기</small></span>
                </div>
                <div className="detail-content">{detail.content}</div>
                <div className="detail-footer">
                  <span>◉ {formatCount(detail.views)}명이 읽었어요</span>
                  <span>♡ {detail.commentCount}개의 답장</span>
                  <span className="detail-share">공유하기 <span aria-hidden="true">↗</span></span>
                </div>

                <section className="comments-section" aria-labelledby="comments-title">
                  <div className="comments-heading">
                    <div>
                      <p className="eyebrow">KEEP THE TALK GOING</p>
                      <h2 id="comments-title">이야기에 답장하기 <span>{detail.commentCount}</span></h2>
                    </div>
                    <span className="comment-note">가입은 필요하지 않아요.</span>
                  </div>
                  <form className="comment-form" onSubmit={handleCommentSubmit}>
                    {replyTarget && (
                      <div className="replying-to">
                        <span><b>{replyTarget.nickname}</b>님에게 답장 중</span>
                        <button type="button" onClick={() => setReplyTarget(null)}>취소</button>
                      </div>
                    )}
                    <div className="comment-input-row">
                      <span className="comment-form-avatar" aria-hidden="true">{commentNickname.slice(0, 1) || "익"}</span>
                      <input
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        placeholder={replyTarget ? "답장을 남겨 보세요" : "따뜻한 한마디를 남겨 보세요"}
                        aria-label="댓글 내용"
                        maxLength={600}
                      />
                      <button type="submit" disabled={isCommentSending}>
                        {isCommentSending ? "..." : "답장"} <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    <div className="comment-form-bottom">
                      <label>닉네임 <input value={commentNickname} onChange={(event) => setCommentNickname(event.target.value)} maxLength={32} /></label>
                      <span>이 글에서만 보여요</span>
                    </div>
                  </form>
                  <div className="comments-list">
                    {detail.comments.length > 0 ? (
                      detail.comments.map((comment) => (
                        <CommentBranch key={comment.id} comment={comment} onReply={setReplyTarget} />
                      ))
                    ) : (
                      <div className="no-comments">첫 번째 답장을 남겨 대화를 시작해 보세요.</div>
                    )}
                  </div>
                </section>
              </article>

              <aside className="detail-aside">
                <section className="detail-aside-card accent">
                  <span className="aside-stamp" aria-hidden="true">◎</span>
                  <p className="eyebrow">A GENTLE REMINDER</p>
                  <h2>좋아요.<br /><em>당신의 속도대로.</em></h2>
                  <p>여기서는 짧은 답장도 충분해요. 서로의 하루에 작은 점 하나를 찍어 주세요.</p>
                </section>
                <section className="detail-aside-card">
                  <div className="latest-heading">
                    <span className="eyebrow">YOU MAY ALSO LIKE</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                  {latestPosts.map((post) => (
                    <button className="related-item" type="button" key={post.id} onClick={() => openPost(post.id)}>
                      <span className={classNames("related-dot", "dot-" + post.category)} />
                      <span>{post.title}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  ))}
                </section>
              </aside>
            </div>
          ) : (
            <div className="not-found-card">
              <span aria-hidden="true">◌</span>
              <h1>이 이야기는 잠시 숨었어요.</h1>
              <p>목록으로 돌아가 다른 이야기를 둘러볼까요?</p>
              <button type="button" onClick={goHome}>모든 이야기 보기</button>
            </div>
          )}
        </main>
      )}

      <footer className="site-footer">
        <span>orbit / 익명으로 이어지는 작은 대화</span>
        <span>made for a softer internet <b>✦</b></span>
      </footer>

      {showComposer && (
        <div className="modal-scrim" role="presentation" onMouseDown={() => setShowComposer(false)}>
          <section className="composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="composer-top">
              <div>
                <p className="eyebrow">WRITE WITHOUT A LOGIN</p>
                <h2 id="composer-title">오늘의 이야기를<br /><em>놓고 가세요.</em></h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setShowComposer(false)} aria-label="작성 창 닫기">×</button>
            </div>
            <form className="composer-form" onSubmit={handleCreatePost}>
              <label className="form-field">
                <span>제목</span>
                <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="무슨 생각을 하고 있나요?" maxLength={120} autoFocus />
              </label>
              <label className="form-field">
                <span>내용</span>
                <textarea value={newContent} onChange={(event) => setNewContent(event.target.value)} placeholder="편하게, 당신의 문장으로 적어 주세요." maxLength={2000} rows={7} />
              </label>
              <div className="form-row">
                <label className="form-field">
                  <span>닉네임 <small>이 글에서만 보여요</small></span>
                  <input value={newNickname} onChange={(event) => setNewNickname(event.target.value)} maxLength={32} />
                </label>
                <label className="form-field">
                  <span>카테고리</span>
                  <select value={newCategory} onChange={(event) => setNewCategory(event.target.value as Exclude<Category, "all">)}>
                    {categoryOptions.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="composer-actions">
                <span>가입 없이 바로 게시돼요.</span>
                <button type="submit" disabled={isSending}>{isSending ? "올리는 중..." : "이야기 올리기"} <span aria-hidden="true">↗</span></button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
