import CommunityApp from "../../components/community-app";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const postId = Number(id);
  return <CommunityApp initialPostId={Number.isInteger(postId) ? postId : -1} />;
}

