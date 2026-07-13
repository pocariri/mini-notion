# External API Contract: cataas 랜덤 고양이 이미지

**Provider**: https://cataas.com (Cat as a Service — 무료 오픈 API, 인증 없음)
**Consumer**: `components/CatCover.tsx`의 `<img src>` (브라우저 GET)
**실측 검증**: 2026-07-13 (research.md D2 실측 기록 참조)

## Request

```
GET https://cataas.com/cat/cute?width=760&_={nonce}
```

| 파라미터 | 필수 | 값 | 목적 |
|---|---|---|---|
| (path) `cute` | ✓ | 태그 | 사용자 지정 엔드포인트 — "cute" 태그의 랜덤 고양이 |
| `width` | ✗ | `760` | 서버 측 리사이즈(에디터 본문 최대 폭과 일치, 전송량 절감) |
| `_` | ✓(사실상) | 마운트당 고유 nonce | 캐시 우회 — 응답에 캐시 헤더가 없어 브라우저 휴리스틱 캐시 방지, FR-009 보장 |

> **주의**: cataas는 쿼리를 스키마 검증한다. `r` 같은 예약 파라미터에 숫자가 아닌 값을 넣으면 `400 {"error":"Invalid \"query\" input data", ...}`를 반환한다(2026-07-13 실측). 캐시버스터는 검증을 통과하는 `_` 파라미터를 사용한다.

- 인증·API 키·요청 바디 없음. 브라우저 `<img>`의 단순 GET이므로 CORS preflight 없음.

## Response

### 성공

| 항목 | 값 |
|---|---|
| Status | `200` |
| Content-Type | `image/jpeg` (이미지 바이너리) |
| 크기 | `width=760` 기준 실측 ~50–110KB |
| 캐시 헤더 | **없음** (`Cache-Control`/`ETag`/`Expires` 부재 — 실측) |
| CORS | `access-control-allow-origin: *` |
| 랜덤성 | 동일 URL이라도 매 요청 다른 고양이 가능. 단, 브라우저 캐시가 재사용할 수 있으므로 nonce 필수 |

### 실패 모드 → 소비자 처리

| 실패 | 소비자(브라우저 `<img>`) 관찰 | CatCover 처리 |
|---|---|---|
| 네트워크 불가(오프라인/DNS) | `error` 이벤트 | `error` 상태 → 폴백 (FR-005) |
| 5xx / 4xx 응답 | `error` 이벤트 | `error` 상태 → 폴백 |
| 매우 느린 응답 | 이벤트 지연(대기) | `loading` 유지 → 스켈레톤 지속, 편집 비차단 (FR-006) |
| `HEAD` 요청 | `404` (실측 — 라우트가 GET만 지원) | 해당 없음(`<img>`는 GET 사용) |

## 계약상 유의점

- **가용성 비보장**: 무료 공개 서비스로 SLA 없음. 실패는 정상 시나리오로 취급하며(US3), 앱 핵심 기능에 영향을 주지 않아야 한다(SC-004).
- **타임아웃 미구현**: 브라우저 기본 네트워크 타임아웃에 위임한다. 인위적 타임아웃 타이머는 두지 않는다(YAGNI) — 실패 시 `error` 이벤트가 도착하고, 그때까지는 스켈레톤이 유효한 상태다.
- **엔드포인트 변경 리스크**: 태그 라우트(`/cat/cute`)가 사라질 경우 `error` 폴백으로 자연 강등된다. 별도 감시는 두지 않는다.
