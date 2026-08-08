"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Category, CommentItem, PostDetail, PostSummary } from "../../lib/types";

const categoryOptions: Array<{ value: Exclude<Category, "all">; label: string; symbol: string }> = [
  { value: "free", label: "?먯쑀?섎떎", symbol: "?? },
  { value: "question", label: "吏덈Ц?덉뼱??, symbol: "?" },
  { value: "life", label: "?쇱긽湲곕줉", symbol: "?? },
  { value: "tip", label: "?묒???, symbol: "?? },
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
            ?듦? ?ш린 <span aria-hidden="true">??/span>
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
          ??        </span>
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
          <span aria-label="?볤? ??>??{post.commentCount}</span>
          <span aria-label="議고쉶 ??>??{post.views}</span>
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
    <nav className="category-nav" aria-label="寃뚯떆湲 移댄뀒怨좊━">
      <button
        className={classNames("category-nav-item", activeCategory === "all" && "is-active")}
        type="button"
        onClick={() => onChange("all")}
      >
        <span className="nav-symbol">??/span>
        <span>?꾩껜 ?댁빞湲?/span>
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
  const [newNickname, setNewNickname] = useState("?듬챸_?덈꼍");
  const [newCategory, setNewCategory] = useState<Exclude<Category, "all">>("free");
  const [commentNickname, setCommentNickname] = useState("?듬챸_?덈꼍");
  const [commentBody, setCommentBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [isCommentSending, setIsCommentSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/posts", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "寃뚯떆湲??遺덈윭?ㅼ? 紐삵뻽?댁슂."));
        return (await response.json()) as PostSummary[];
      })
      .then((loadedPosts) => {
        if (!cancelled) {
          setPosts(loadedPosts);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "寃뚯떆湲??遺덈윭?ㅼ? 紐삵뻽?댁슂.");
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
        if (!response.ok) throw new Error(await readError(response, "寃뚯떆湲??李얠쓣 ???놁뼱??"));
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
          setError(reason instanceof Error ? reason.message : "寃뚯떆湲??李얠쓣 ???놁뼱??");
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
    setNewNickname("?듬챸_?덈꼍");
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
      if (!response.ok) throw new Error(await readError(response, "寃뚯떆湲????ν븯吏 紐삵뻽?댁슂."));
      const createdPost = (await response.json()) as PostSummary;
      setPosts((current) => [createdPost, ...current]);
      resetComposer();
      setShowComposer(false);
      router.push("/posts/" + createdPost.id);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "寃뚯떆湲????ν븯吏 紐삵뻽?댁슂.");
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
      if (!response.ok) throw new Error(await readError(response, "?볤?????ν븯吏 紐삵뻽?댁슂."));
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
      setError(reason instanceof Error ? reason.message : "?볤?????ν븯吏 紐삵뻽?댁슂.");
    } finally {
      setIsCommentSending(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand-lockup" type="button" onClick={goHome} aria-label="orbit ??>
          <span className="brand-orbit" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="brand-name">orbit</span>
          <span className="brand-subtitle">anonymous community</span>
        </button>
        <nav className="header-nav" aria-label="?ъ씠??硫붾돱">
          <button className={classNames(!isDetailPage && "is-current")} type="button" onClick={goHome}>
            ?섎윭蹂닿린
          </button>
          <a href="#how-it-works">?댁슜 ?덈궡</a>
        </nav>
        <button className="header-write" type="button" onClick={() => setShowComposer(true)}>
          ?댁빞湲??곌린 <span aria-hidden="true">竊?/span>
        </button>
      </header>

      {error && (
        <div className="error-strip" role="alert">
          <span aria-hidden="true">!</span>
          {error}
          <button type="button" onClick={() => setError("")} aria-label="?ㅻ쪟 ?リ린">
            횞
          </button>
        </div>
      )}

      {!isDetailPage ? (
        <>
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow">A SMALL PLACE TO BE HONEST</p>
              <h1>
                吏湲?
                <br />
                <em>?명븯寃?/em> ?댁빞湲고빐??
              </h1>
              <p className="hero-description">
                ?대쫫 ?놁씠??愿쒖갖?꾩슂.
                <br />
                ?ㅻ뒛???앷컖???볤퀬, ?꾧뎔媛??臾몄옣??癒몃Ъ??蹂댁꽭??
              </p>
            </div>
            <div className="hero-graphic" aria-hidden="true">
              <div className="graphic-star star-one">??/div>
              <div className="graphic-star star-two">??/div>
              <div className="orbit-circle circle-outer" />
              <div className="orbit-circle circle-middle" />
              <div className="orbit-circle circle-inner">
                <span>orbit</span>
              </div>
              <div className="graphic-note">no login<br />just talk</div>
            </div>
            <div className="hero-stats" aria-label="而ㅻ??덊떚 ?꾪솴">
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
              ??            </div>
            <div>
              <strong>媛???놁씠 諛붾줈 ?댁빞湲고빐??/strong>
              <p>?됰꽕?꾩? ??湲?먯꽌留??ъ슜?쇱슂. ?쒕줈???섎（瑜?媛蹂띻쾶 議댁쨷??二쇱꽭??</p>
            </div>
            <button type="button" onClick={() => setShowComposer(true)}>
              泥?湲 ?④린湲?<span aria-hidden="true">??/span>
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
              <h2>?대뼡 ?댁빞湲곕?<br />李얘퀬 ?덈굹??</h2>
              <CategoryNav activeCategory={activeCategory} posts={posts} onChange={setActiveCategory} />
              <div className="sidebar-tip">
                <span aria-hidden="true">??/span>
                <p>醫뗭? 吏덈Ц ?섎굹媛<br /><b>醫뗭? ???/b>瑜??쒖옉?댁슂.</p>
              </div>
            </aside>

            <section className="feed-section" aria-labelledby="feed-title">
              <div className="feed-heading">
                <div>
                  <p className="eyebrow">JUST LANDED</p>
                  <h2 id="feed-title">?덈줈 ?щ씪???댁빞湲?/h2>
                </div>
                <label className="search-field">
                  <span aria-hidden="true">??/span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="?댁빞湲?寃??
                    aria-label="?댁빞湲?寃??
                  />
                </label>
              </div>
              <div className="feed-meta">
                <span>{filteredPosts.length}媛쒖쓽 ?댁빞湲?/span>
                <span className="sort-label">理쒖떊??<span aria-hidden="true">??/span></span>
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
                    <span aria-hidden="true">??/span>
                    <h3>?꾩쭅 ??留욌뒗 ?댁빞湲곌? ?놁뼱??</h3>
                    <p>寃?됱뼱瑜?諛붽씀嫄곕굹, ?덈줈???댁빞湲곕? 癒쇱? ?④꺼 蹂댁꽭??</p>
                    <button type="button" onClick={() => setShowComposer(true)}>
                      ?댁빞湲??곌린
                    </button>
                  </div>
                )}
              </div>
            </section>

            <aside className="community-sidebar">
              <section className="guide-card">
                <div className="guide-card-top">
                  <span className="eyebrow">ORBIT NOTE 01</span>
                  <span aria-hidden="true">??/span>
                </div>
                <h2>?닿납?먯꽌??br /><em>泥쒖쿇??/em> 留먰빐???쇱슂.</h2>
                <p>?뺣떟蹂대떎 ?쒕줈??寃쏀뿕???섎늻??怨? ?묒? 臾몄옣???꾧뎔媛?먭쾶?????뚰듃媛 ?⑸땲??</p>
                <div className="guide-lines">
                  <span>01&nbsp; ?대쫫 ???留덉쓬???④꺼??/span>
                  <span>02&nbsp; ?ㅻ쫫???쒕몢瑜댁? ?딆븘??/span>
                </div>
              </section>
              <section className="latest-card">
                <div className="latest-heading">
                  <span className="eyebrow">MORE TO READ</span>
                  <span aria-hidden="true">??/span>
                </div>
                {posts.slice(0, 3).map((post, index) => (
                  <button className="latest-item" key={post.id} type="button" onClick={() => openPost(post.id)}>
                    <span className="latest-number">0{index + 1}</span>
                    <span className="latest-title">{post.title}</span>
                    <span className="latest-arrow" aria-hidden="true">??/span>
                  </button>
                ))}
              </section>
            </aside>
          </main>
        </>
      ) : (
        <main className="detail-page">
          <button className="back-link" type="button" onClick={goHome}>
            <span aria-hidden="true">??/span> 紐⑤뱺 ?댁빞湲곕줈 ?뚯븘媛湲?          </button>
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
                  <span><b>{detail.nickname}</b><small>?듬챸?쇰줈 ?④릿 ?댁빞湲?/small></span>
                </div>
                <div className="detail-content">{detail.content}</div>
                <div className="detail-footer">
                  <span>??{formatCount(detail.views)}紐낆씠 ?쎌뿀?댁슂</span>
                  <span>??{detail.commentCount}媛쒖쓽 ?듭옣</span>
                  <span className="detail-share">怨듭쑀?섍린 <span aria-hidden="true">??/span></span>
                </div>

                <section className="comments-section" aria-labelledby="comments-title">
                  <div className="comments-heading">
                    <div>
                      <p className="eyebrow">KEEP THE TALK GOING</p>
                      <h2 id="comments-title">?댁빞湲곗뿉 ?듭옣?섍린 <span>{detail.commentCount}</span></h2>
                    </div>
                    <span className="comment-note">媛?낆? ?꾩슂?섏? ?딆븘??</span>
                  </div>
                  <form className="comment-form" onSubmit={handleCommentSubmit}>
                    {replyTarget && (
                      <div className="replying-to">
                        <span><b>{replyTarget.nickname}</b>?섏뿉寃??듭옣 以?/span>
                        <button type="button" onClick={() => setReplyTarget(null)}>痍⑥냼</button>
                      </div>
                    )}
                    <div className="comment-input-row">
                      <span className="comment-form-avatar" aria-hidden="true">{commentNickname.slice(0, 1) || "??}</span>
                      <input
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        placeholder={replyTarget ? "?듭옣???④꺼 蹂댁꽭?? : "?곕쑜???쒕쭏?붾? ?④꺼 蹂댁꽭??}
                        aria-label="?볤? ?댁슜"
                        maxLength={600}
                      />
                      <button type="submit" disabled={isCommentSending}>
                        {isCommentSending ? "..." : "?듭옣"} <span aria-hidden="true">??/span>
                      </button>
                    </div>
                    <div className="comment-form-bottom">
                      <label>?됰꽕??<input value={commentNickname} onChange={(event) => setCommentNickname(event.target.value)} maxLength={32} /></label>
                      <span>??湲?먯꽌留?蹂댁뿬??/span>
                    </div>
                  </form>
                  <div className="comments-list">
                    {detail.comments.length > 0 ? (
                      detail.comments.map((comment) => (
                        <CommentBranch key={comment.id} comment={comment} onReply={setReplyTarget} />
                      ))
                    ) : (
                      <div className="no-comments">泥?踰덉㎏ ?듭옣???④꺼 ??붾? ?쒖옉??蹂댁꽭??</div>
                    )}
                  </div>
                </section>
              </article>

              <aside className="detail-aside">
                <section className="detail-aside-card accent">
                  <span className="aside-stamp" aria-hidden="true">??/span>
                  <p className="eyebrow">A GENTLE REMINDER</p>
                  <h2>醫뗭븘??<br /><em>?뱀떊???띾룄?濡?</em></h2>
                  <p>?ш린?쒕뒗 吏㏃? ?듭옣??異⑸텇?댁슂. ?쒕줈???섎（???묒? ???섎굹瑜?李띿뼱 二쇱꽭??</p>
                </section>
                <section className="detail-aside-card">
                  <div className="latest-heading">
                    <span className="eyebrow">YOU MAY ALSO LIKE</span>
                    <span aria-hidden="true">??/span>
                  </div>
                  {latestPosts.map((post) => (
                    <button className="related-item" type="button" key={post.id} onClick={() => openPost(post.id)}>
                      <span className={classNames("related-dot", "dot-" + post.category)} />
                      <span>{post.title}</span>
                      <span aria-hidden="true">??/span>
                    </button>
                  ))}
                </section>
              </aside>
            </div>
          ) : (
            <div className="not-found-card">
              <span aria-hidden="true">??/span>
              <h1>???댁빞湲곕뒗 ?좎떆 ?⑥뿀?댁슂.</h1>
              <p>紐⑸줉?쇰줈 ?뚯븘媛 ?ㅻⅨ ?댁빞湲곕? ?섎윭蹂쇨퉴??</p>
              <button type="button" onClick={goHome}>紐⑤뱺 ?댁빞湲?蹂닿린</button>
            </div>
          )}
        </main>
      )}

      <footer className="site-footer">
        <span>orbit / ?듬챸?쇰줈 ?댁뼱吏???묒? ???/span>
        <span>made for a softer internet <b>??/b></span>
      </footer>

      {showComposer && (
        <div className="modal-scrim" role="presentation" onMouseDown={() => setShowComposer(false)}>
          <section className="composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="composer-top">
              <div>
                <p className="eyebrow">WRITE WITHOUT A LOGIN</p>
                <h2 id="composer-title">?ㅻ뒛???댁빞湲곕?<br /><em>?볤퀬 媛?몄슂.</em></h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setShowComposer(false)} aria-label="?묒꽦 李??リ린">횞</button>
            </div>
            <form className="composer-form" onSubmit={handleCreatePost}>
              <label className="form-field">
                <span>?쒕ぉ</span>
                <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="臾댁뒯 ?앷컖???섍퀬 ?덈굹??" maxLength={120} autoFocus />
              </label>
              <label className="form-field">
                <span>?댁슜</span>
                <textarea value={newContent} onChange={(event) => setNewContent(event.target.value)} placeholder="?명븯寃? ?뱀떊??臾몄옣?쇰줈 ?곸뼱 二쇱꽭??" maxLength={2000} rows={7} />
              </label>
              <div className="form-row">
                <label className="form-field">
                  <span>?됰꽕??<small>??湲?먯꽌留?蹂댁뿬??/small></span>
                  <input value={newNickname} onChange={(event) => setNewNickname(event.target.value)} maxLength={32} />
                </label>
                <label className="form-field">
                  <span>移댄뀒怨좊━</span>
                  <select value={newCategory} onChange={(event) => setNewCategory(event.target.value as Exclude<Category, "all">)}>
                    {categoryOptions.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="composer-actions">
                <span>媛???놁씠 諛붾줈 寃뚯떆?쇱슂.</span>
                <button type="submit" disabled={isSending}>{isSending ? "?щ━??以?.." : "?댁빞湲??щ━湲?} <span aria-hidden="true">??/span></button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

