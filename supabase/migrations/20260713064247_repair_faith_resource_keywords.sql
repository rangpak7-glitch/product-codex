-- 이전 등록 과정에서 한 글자로 잘린 공개 키워드를 의미가 분명한 형태로 복구합니다.
update public.faith_resources
set tags = array_replace(array_replace(tags, '평', '평안'), '상', '상처')
where '평' = any(tags)
   or '상' = any(tags);
