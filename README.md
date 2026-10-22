# Raju's ScoreBox

악보 이미지/PDF를 **코드(Key) · 빠르기(Speed) · 카테고리(Tag)** 로 정리하고, **찬양 콘티**를 만들어 B4/A3/A4로 인쇄하거나 JPG로 저장하는 로컬 웹 앱입니다.
설치가 필요 없고 서버도 없습니다. **Chrome(또는 Edge)에서 `scorebox.html` 을 열면 됩니다.**

## 설치
설치 프로그램이나 서버는 필요 없습니다. 파일만 내려받아 `scorebox.html` 을 열면 됩니다. **Windows + Chrome(또는 Edge)** 기준입니다.

### 방법 1. ZIP으로 받기 (가장 간단)
1. https://github.com/byraju-hub/scorebox 에서 초록색 **Code** 버튼 → **Download ZIP** 을 누릅니다.
2. 받은 ZIP 의 압축을 풉니다 (예: `C:\Users\내이름\Projects\ScoreBox`). 압축을 푼 폴더는 지우거나 옮기지 마세요.
3. 폴더 안의 `scorebox.html` 을 **Chrome 또는 Edge** 로 엽니다 (더블클릭 또는 브라우저로 끌어놓기).
4. 아래 **시작하기**대로 악보 폴더를 선택합니다.
- 업데이트: 새 버전이 나오면 ZIP 을 다시 받아 같은 폴더에 덮어씁니다. 분류 정보는 악보 폴더의 `scorebox_data.json` 에 있으므로 지워지지 않습니다.

### 방법 2. Git으로 받기 (업데이트가 쉬움)
1. [Git for Windows](https://git-scm.com/download/win) 를 설치합니다.
2. 원하는 위치에서 PowerShell 을 열고 아래 명령으로 받습니다.
   ```
   git clone https://github.com/byraju-hub/scorebox.git
   ```
3. 받은 `ScoreBox` 폴더의 `scorebox.html` 을 Chrome 또는 Edge 로 엽니다.
4. 업데이트는 폴더의 `update.bat` 을 더블클릭하면 됩니다 (아래 **업데이트** 참고).

### 확인할 점
- **Chrome / Edge 만 지원**합니다 (폴더 접근 기능이 필요합니다). Firefox, Safari 는 안 됩니다.
- 악보 이미지와 분류 데이터는 **각자 PC 의 악보 폴더에만** 저장되고, GitHub 나 인터넷으로 올라가지 않습니다.
- 악보 파일은 수정하지 않고 읽기만 합니다 (콘티 JPG 는 악보 폴더 안 `콘티출력` 폴더에 저장).
- 폴더 접근 허용 창이 뜨면 **"이 사이트를 방문할 때마다 허용"** 을 고르면 다음부터 폴더가 자동으로 열립니다.

## 시작하기
1. Chrome에서 `scorebox.html` 을 열고 **악보 폴더 선택**을 누릅니다 (예: `Pictures`). 하위 폴더까지 읽고, 원본 파일은 수정하지 않습니다.
2. 접근 허용 창이 뜨면 허용합니다. 다음에 열 때는 **폴더 열기** 버튼을 한 번 눌러 접근을 허용하세요.
3. 분류 정보와 콘티는 선택한 폴더의 `scorebox_data.json` 에 자동 저장됩니다. 가끔 다른 곳에 복사해 백업해 두세요.
- Chrome 이 막는 폴더(Documents, Downloads 자체 등)는 그 안의 하위 폴더를 선택하세요.

## 업데이트
`update.bat` 더블클릭 (**방법 2 로 받은 폴더에서만** 동작하며 Git 설치가 필요합니다. ZIP 으로 받았다면 ZIP 을 다시 받아 덮어쓰세요). 앱이 열려 있으면 Chrome 에서 Ctrl+F5 를 누르세요. `scorebox_data.json` 은 건드리지 않습니다.

## 사용 방법
악보함 · 백업 · 찬양 추천 · 콘티 인쇄/JPG 등 기능별 설명은 **[사용 설명서 (GUIDE.md)](GUIDE.md)** 에 있습니다.

## 파일 구성 (개발용)
| 파일 | 내용 |
|---|---|
| `scorebox.html` | 화면 구성(HTML). 이 파일을 Chrome 으로 엽니다 |
| `css/scorebox.css` | 스타일 |
| `js/1-library.js` | 악보함: 데이터 저장 · 스캔 · 카드 화면 · 편집 · 시작 화면 |
| `js/2-conti.js` | 콘티: 목록 · 편집 · 곡 추가 · 인쇄 레이아웃 · 자르기 · JPG |
| `js/3-basket.js` | 콘티 바구니 |
| `js/4-recommend.js` | 찬양 추천 (Claude) |
| `js/5-backup.js` | 백업 · 복원 |
| `js/6-tags-dup.js` | 카테고리 설정 · 중복 곡 정리 |
| `js/7-stats-hymn.js` | 콘티 통계 · 찬송가/CCM 분류 |
| `js/8-spacing.js` | 제목 띄어쓰기 정리 |
| `fonts/` | 콘티 인쇄용 고운 도담체 |
| `tests/` | 자동 테스트 |
| `GUIDE.md` | 기능별 사용 설명서 |
| `.github/workflows/test.yml` | GitHub 에서 자동 테스트 실행 |

스크립트는 번호 순서대로 불러오며(앞 파일의 함수를 뒤 파일이 씀), 빌드 과정 없이 파일 그대로 동작합니다.

### 자동 테스트
실제 Chromium 으로 앱을 열어 스캔 · 파일 삭제(이동) · 이름 바뀐 파일 연결 · 최근 사용 표시 · 콘티 JPG · 휴지통 · 바구니 · 백업/복원 · 손상된 데이터 · 찬양 추천(가짜 응답)을 확인합니다. PC 의 악보 폴더는 건드리지 않습니다. GitHub 에서도 main 에 올리거나 PR 을 만들 때마다 자동으로 실행됩니다(저장소의 **Actions** 탭).
```
cd tests
npm install
npx playwright install chromium
npm test
```
