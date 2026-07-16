export type Theme = 'light' | 'dark'

export const THEME_KEY = 'mini-notion:theme'

// 저장값 검증 — 유효 리터럴 외(손상·부재)는 전부 "선택 없음"(null)으로 해석한다.
export function parseStoredTheme(raw: string | null): Theme | null {
  return raw === 'light' || raw === 'dark' ? raw : null
}

// 유효 테마 도출 규칙(단일 진실): 저장된 선택이 있으면 그 값, 없으면 OS 설정.
export function resolveTheme(saved: Theme | null, systemDark: boolean): Theme {
  return saved ?? (systemDark ? 'dark' : 'light')
}

// 첫 페인트 전 부팅 적용. 레이아웃 인라인 스크립트(THEME_INIT_SCRIPT)와 동일 로직.
// 읽기 전용 — localStorage에 쓰지 않으며, 어떤 실패에도 예외를 전파하지 않는다(FR-017).
export function applyInitialTheme(): void {
  try {
    let saved: Theme | null = null
    try {
      saved = parseStoredTheme(localStorage.getItem(THEME_KEY))
    } catch {
      // 저장소 접근 불가 — 선택 없음으로 취급
    }
    let systemDark = false
    try {
      systemDark =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      // 판별 불가 — 라이트
    }
    document.documentElement.setAttribute('data-theme', resolveTheme(saved, systemDark))
  } catch {
    // 어떤 경우에도 부팅을 막지 않는다 — SSR 기본값(light) 유지
  }
}

// 위 로직의 직렬화 IIFE. app/layout.tsx의 <head> 인라인 <script>에 삽입되어
// React 하이드레이션 전에 실행된다(Next.js preventing-flash-before-hydration 패턴).
export const THEME_INIT_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)})}catch(e){}if(t!=='light'&&t!=='dark'){var d=false;try{d=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-color-scheme: dark)').matches}catch(e){}t=d?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`
