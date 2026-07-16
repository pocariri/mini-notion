-- Contract: public.page 행 수준 보안 정책
-- Feature: specs/003-supabase-page-storage
-- 근거: FR-002, FR-004, FR-005, FR-007 / research.md R2·R3
--
-- 이 파일은 계약(contract)이다. 실행은 구현 단계에서 한다.
--
-- 중요 사실 (실제 DB 확인 결과):
--   * public.page 는 RLS 활성 + 정책 0개 → 현재 모든 접근 거부. 앱이 동작하지 않는다.
--   * anon / authenticated 두 역할 모두 SELECT/INSERT/UPDATE/DELETE GRANT 보유.
--     => RLS 정책이 유일한 방어선이다. TO 절을 틀리면 비로그인 사용자에게 전부 열린다.
--   * 칼럼 구성은 변경하지 않는다 (사용자 제약, FR-009). 정책 추가는 구조 변경이 아니다.
--
-- 설계 규칙:
--   * TO authenticated 를 명시한다. auth.role() 조건은 쓰지 않는다(deprecated,
--     익명 로그인 활성 시 조용히 통과).
--   * anon 대상 정책은 만들지 않는다. 정책이 없으면 RLS가 거부한다.
--   * (select auth.uid()) 로 감싼다. 행마다 재평가하지 않고 InitPlan으로 한 번만
--     평가되어 목록 조회가 빨라진다. 기존 public.profile 정책과 같은 형태다.
--   * UPDATE 는 USING 과 WITH CHECK 를 모두 둔다. WITH CHECK 가 없으면 사용자가
--     자기 행의 user_id 를 타인 것으로 바꿔 넘길 수 있다.
--   * DELETE/UPDATE 는 대상 행을 먼저 SELECT 해야 한다. SELECT 정책이 없으면
--     오류 없이 0행이 영향받아 조용히 실패한다.

-- 본인 페이지만 조회 (FR-004)
create policy "Users can view own page"
  on public.page
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 로그인한 사용자가 본인 소유로만 생성 (FR-002, FR-003)
create policy "Users can insert own page"
  on public.page
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- 본인 페이지만 수정. USING = 어떤 행을 수정할 수 있는가,
-- WITH CHECK = 수정 결과가 여전히 본인 소유인가 (FR-006)
create policy "Users can update own page"
  on public.page
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 본인 페이지만 삭제 (FR-005)
create policy "Users can delete own page"
  on public.page
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- ============================================================
-- 검증 계약 — 목(mock)으로는 절대 확인할 수 없는 항목이다.
-- 반드시 실제 DB에 대해 확인한다. 상세 절차는 quickstart.md 참조.
-- ============================================================
--
-- V1. 정책 4개가 존재하고 모두 authenticated 대상인가
--     select policyname, cmd, roles, qual, with_check
--       from pg_policies where schemaname='public' and tablename='page';
--     기대: 4행, roles = {authenticated}, anon 대상 정책 0개
--
-- V2. 비로그인(anon) 접근이 거부되는가  → SC-004, 스토리 2 시나리오 3
--     기대: 익명 키로 select/insert 시 0행 또는 거부. 절대 데이터가 나오면 안 된다.
--
-- V3. 타 사용자의 행이 보이지 않는가  → SC-003, 스토리 2
--     기대: A 사용자 세션으로 select 시 B의 행이 결과에 없다.
--
-- V4. 타 사용자의 행을 삭제할 수 없는가  → SC-005, 스토리 4 시나리오 3
--     기대: 0행 영향. B의 행이 그대로 남는다.
--
-- V5. user_id 를 타인으로 바꿔 넘길 수 없는가  → WITH CHECK 검증
--     기대: update 거부.
--
-- V6. advisor 의 rls_enabled_no_policy 경고가 해소되는가
--     기대: public.page 관련 경고 사라짐.
