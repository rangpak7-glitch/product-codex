-- 공개 나눔게시판에 아픔나눔을 추가합니다.
-- 기존 행과 RLS 정책은 그대로 유지하고 카테고리 체크 제약만 확장합니다.
alter table public.community_posts
  drop constraint if exists community_posts_category_check;

alter table public.community_posts
  add constraint community_posts_category_check
  check (category in ('prayer', 'gratitude', 'pain'));
