# Saver Frontend

Saver 포털 서비스의 Vue 3 프런트엔드입니다. 화면 및 개발 규칙은 `AGENTS.md`, backend API 계약은 `openapi.json`을 기준으로 합니다.

## 로컬 실행

Node.js와 npm이 필요합니다.

```bash
npm install
cp .env.example .env
npm run dev
```

기본 backend 주소는 `.env.example`의 `VITE_API_BASE_URL`에서 확인할 수 있습니다. 환경에 맞게 `.env`에서 변경합니다.

## 카카오 OAuth callback

카카오 개발자 콘솔에는 프런트엔드 주소가 아니라 backend의 로그인 callback인 `/redirect`와
탈퇴 재인증 callback인 `/auth/withdraw/redirect`를 Redirect URI로 등록합니다. 프런트엔드는
각 authorize endpoint로 브라우저를 이동시키고, backend가 callback 처리와 세션 쿠키 발급 또는
계정 탈퇴를 마친 뒤 프런트엔드 루트로 다시 보내는 구조입니다.

credential CORS를 사용하는 환경에서 backend는 프런트엔드 Origin을 정확히 허용해야 합니다.
또한 `POST /blog/`의 생성 결과는 `Location` 응답 헤더로 전달되므로 브라우저에서 읽을 수 있게
`Access-Control-Expose-Headers: Location`을 설정해야 합니다.

## 검증

```bash
npm run typecheck
npm run test
npm run build
```

## 디렉터리

```text
src/api/          HTTP client와 endpoint 모듈
src/assets/       전역 스타일과 정적 자산
src/components/   공통 UI 컴포넌트
src/router/       애플리케이션 라우트
src/types/        공통 도메인 타입
src/views/        라우트 단위 페이지
tests/            핵심 흐름과 공통 로직 테스트
```
