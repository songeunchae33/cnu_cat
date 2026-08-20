-- Supabase SQL Editor에서 이 파일 전체를 붙여넣고 실행하세요.
-- 고양이 저장 데이터(배고픔/애정/이름/스킨)를 사용자별로 저장하는 테이블.
-- 실시간으로 서로의 고양이를 보여주는 기능은 이 테이블이 아니라
-- Presence(임시 방송) 채널로 처리하므로, 이 테이블은 "내 것만 읽고 쓰기"로 충분히 잠급니다.

create table if not exists public.cats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cat_name text not null default '냥이',
  skin text not null default 'white',
  hunger int not null default 5,
  affection int not null default 5,
  last_date text not null default to_char(now(), 'YYYY-MM-DD'),
  footstep_sound text, -- 사용자가 녹음한 발걸음 효과음 (data: URL, base64) - 없으면 기본 합성음 사용
  updated_at timestamptz not null default now()
);

-- 이미 위 CREATE TABLE을 실행한 적이 있다면(테이블이 이미 있어서 컬럼이 안 생겼다면) 아래 줄만 따로 실행하세요.
alter table public.cats add column if not exists footstep_sound text;

alter table public.cats enable row level security;

drop policy if exists "select own cat" on public.cats;
create policy "select own cat"
  on public.cats for select
  using (auth.uid() = user_id);

drop policy if exists "insert own cat" on public.cats;
create policy "insert own cat"
  on public.cats for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own cat" on public.cats;
create policy "update own cat"
  on public.cats for update
  using (auth.uid() = user_id);

-- (선택) 회원가입 시 이메일 확인 메일을 요구하지 않으려면
-- Supabase 대시보드 > Authentication > Providers > Email > "Confirm email" 을 꺼주세요.
-- 친구와 빠르게 테스트할 때 편리합니다.
