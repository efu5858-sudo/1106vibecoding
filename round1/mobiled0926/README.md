# 상세페이지 레퍼런스 수집기

상품 상세페이지에서 긴 전체 화면을 PNG로 저장하거나 큰 참고 이미지를 골라 다운로드하는 Chrome Manifest V3 확장프로그램입니다. 결과물은 Chrome 다운로드 폴더의 `detail-page-references` 안에 정리됩니다.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.

## 사용

상품 페이지를 연 뒤 확장프로그램 아이콘을 누릅니다.

- **캡처하기**: 현재 페이지 전체를 PNG로 저장합니다. Chrome의 디버거 권한을 잠시 사용하므로 안내 표시가 나타날 수 있습니다.
- **참고 이미지**: 가로와 세로가 각각 240px 이상인 이미지를 모읍니다. 필요한 이미지에만 체크한 뒤 저장하세요.

## 제한 사항

- Chrome 내부 페이지, 웹 스토어, PDF 뷰어 등은 Chrome 정책상 캡처할 수 없습니다.
- 사이트가 로그인, 봇 차단, 이미지 접근 제한을 적용한 경우 일부 원본 이미지 다운로드가 실패할 수 있습니다.
