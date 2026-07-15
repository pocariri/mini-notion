import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 필요합니다 (.env.local 참고: .env.example).',
  )
}

// 브라우저 전용 싱글턴. PKCE 흐름: 로그인 복귀 시 URL의 인증 코드를
// supabase-js가 자동 교환(detectSessionInUrl)해 세션을 복원한다.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
