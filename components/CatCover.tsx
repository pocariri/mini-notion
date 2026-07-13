'use client'

import { useState } from 'react'
import { Cat } from 'lucide-react'

const COVER_ENDPOINT = 'https://cataas.com/cat/cute'

// cataas 응답에는 캐시 헤더가 없어 같은 URL이 브라우저 캐시로 재사용될 수 있다.
// 마운트마다 고유한 `_` 쿼리로 "매 진입 시 새 랜덤"을 보장한다.
// (cataas는 쿼리를 스키마 검증한다 — `r` 등 예약 파라미터에 문자열을 넣으면 400)
function randomCoverSrc(): string {
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${COVER_ENDPOINT}?width=760&_=${nonce}`
}

type CoverLoadState = 'loading' | 'loaded' | 'error'

export default function CatCover() {
  const [src] = useState(randomCoverSrc)
  const [state, setState] = useState<CoverLoadState>('loading')

  return (
    <div className="cover">
      {state === 'loading' && (
        <div
          className="cover-skeleton"
          data-testid="cover-skeleton"
          aria-hidden="true"
        />
      )}
      {state === 'error' ? (
        <div
          className="cover-fallback"
          data-testid="cover-fallback"
          aria-hidden="true"
        >
          <Cat size={22} />
        </div>
      ) : (
        /* 이미지는 로딩 중에도 DOM에 있어야 load 이벤트를 받는다 — hidden으로만 가린다 */
        <img
          className="cover-img"
          data-testid="cover-image"
          alt=""
          src={src}
          hidden={state === 'loading'}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
    </div>
  )
}
