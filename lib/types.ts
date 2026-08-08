export const categories = ["all", "free", "question", "life", "tip"] as const;

export type Category = (typeof categories)[number];

export type CommentItem = {
  id: number;
  postId: number;
  parentId: number | null;
  nickname: string;
  content: string;
  createdAt: string;
  replies: CommentItem[];
};

export type PostSummary = {
  id: number;
  title: string;
  excerpt: string;
  category: Exclude<Category, "all">;
  categoryLabel: string;
  nickname: string;
  createdAt: string;
  views: number;
  commentCount: number;
};

export type PostDetail = PostSummary & {
  content: string;
  comments: CommentItem[];
};

export type CreatePostInput = {
  title: string;
  content: string;
  nickname: string;
  category: Exclude<Category, "all">;
};

export type CreateCommentInput = {
  postId: number;
  parentId: number | null;
  content: string;
  nickname: string;
};

