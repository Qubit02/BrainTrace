# BrainTrace 기여 가이드

BrainTrace에 관심을 가져주셔서 감사합니다! 🙌  
이 문서는 **이슈 제기 → 브랜치 생성 → 개발/테스트 → PR → 리뷰/머지**까지의 과정을 간결하게 안내합니다.  
설치 및 실행 방법은 아래 문서를 참고하세요.

- 🇰🇷 **[INSTALL_KO.md](INSTALL_KO.md)**
- en **[INSTALL_EN.md](INSTALL_EN.md)**

---

## 기여 방법

1. **이슈 생성**: 템플릿을 활용하여 내용을 작성합니다.
2. **브랜치 파생**: `dev` 브랜치에서 기능/수정 브랜치를 생성합니다.
3. **작업**: 커밋 규칙을 준수하고, 린트 및 테스트를 통과합니다.
4. **PR 생성**: 템플릿을 작성하고 `Closes #<이슈번호>`로 연결합니다.
5. **리뷰/머지**: 피드백을 반영하고 **Squash & Merge**를 기본으로 합니다.

```text
Issue → Branch(from dev) → Commits(our convention) → PR(template) → Review/CI → Squash & Merge
```

---

## 1) 무엇을 기여할 수 있나요?

- **기능 추가**: 새로운 모듈/노드, API, UI/UX 개선
- **버그 수정 & 리팩터링**: 안정성, 성능, 가독성 향상
- **문서화**: 설치, 아키텍처, 트러블슈팅, 주석 보강
- **이슈 제보 & 제안**: 버그 리포트, 기능 제안

---

## 2) 이슈 작성 방법

- **이슈 템플릿**: [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)에서 유형을 선택합니다(버그, 기능, 질문 등).
- 포함 권장: 개요, 기대 vs 실제, 로그/스크린샷, 환경 정보

---

## 3) 커밋 규칙

- 저장소에 정의된 **커밋 규칙(Conventional Commits 등)**을 따릅니다.  
  예) `feat: add /ingest backend endpoint`, `fix: handle empty graph at frontend`
- 이슈 자동 종료: 커밋 또는 PR 본문에 **`Closes #<이슈번호>`**

---

## 4) PR 가이드

- **PR 템플릿**: [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 기준으로 작성합니다.
- 포함 권장: 변경 요약, 영향 범위, 테스트 방법, 리스크/롤백, 스크린샷(해당 시)
- 리뷰어: 프로젝트 메인테이너(또는 관련 파트 담당자) 지정
- CI가 성공하고 리뷰 승인이 완료되면 **Merge**

---

## 5) 문서화

- 기능/플로우 변경 시 관련 문서도 함께 업데이트합니다.
  - 설치/실행 변화 → `INSTALL_KO/EN.md` 반영 요청
  - API/구조 변경 → 관련 문서, 샘플, 주석 갱신

---

## 참고 링크

- 설치/실행: [INSTALL_KO.md](INSTALL_KO.md), [INSTALL_EN.md](INSTALL_EN.md)
- 이슈 템플릿: [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/)
- PR 템플릿: [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)
- 라이선스: [LICENSE](LICENSE)

