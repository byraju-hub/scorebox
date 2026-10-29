# Raju's ScoreBox

[![자동 테스트](https://github.com/byraju-hub/scorebox/actions/workflows/test.yml/badge.svg)](https://github.com/byraju-hub/scorebox/actions/workflows/test.yml)

**예배인도자를 위한 악보 정리 · 콘티 작성 도구**입니다.
PC에 모아 둔 악보 이미지를 코드 · 빠르기 · 카테고리로 정리하고, 찬양 콘티를 만들어 바로 인쇄하거나 JPG로 저장할 수 있습니다.

- 설치 프로그램도, 회원 가입도, 서버도 필요 없습니다. **Chrome 에서 `scorebox.html` 을 열면 끝**입니다.
- 악보와 데이터는 **내 PC 안에만** 저장됩니다. 인터넷으로 올라가지 않습니다.

## 주요 기능

| | |
|---|---|
| 🎼 **악보함** | 악보 폴더를 읽어 카드로 보여 줍니다. 파일 이름에서 코드를 알아서 읽고, 하위 폴더는 카테고리가 됩니다. 검색 · 필터 · 일괄 지정 · 중복 곡 정리 |
| 📋 **콘티** | 날짜 · 예배별 콘티 작성, 곡 순서와 악보(코드) 선택, 카톡용 텍스트 복사, 사용 통계, 휴지통 |
| 🧺 **콘티 바구니** | 악보함에서 쓸 곡을 미리 담아 두었다가 한 번에 콘티로 만들기 |
| 🖨 **인쇄 · JPG** | A3 · B4 · A4, 한 면에 1~3칸 배치, 악보 자르기 · 크기 조절, 양면 인쇄, 단톡방 공유용 JPG 저장 |
| 🕊 **찬양 추천** (선택) | 성경 본문을 고르면 AI가 어울리는 찬양을 추천 (본인 API 키 필요) |
| 🗂 **백업 · 복원** | 하루 한 번 자동 백업, 30개 보관, 클릭 한 번으로 복원 |

자세한 사용법은 **[📖 사용 설명서 (GUIDE.md)](GUIDE.md)** 를 보세요.

## 필요한 것

- **PC + Chrome 또는 Microsoft Edge** (최신 버전)
  - 폴더를 직접 읽고 쓰는 기능 때문에 Firefox · Safari · 휴대폰에서는 동작하지 않습니다.
  - Windows 기준으로 설명합니다. Mac 의 Chrome 에서도 사용할 수 있습니다(`update.bat` 만 Windows 전용).
- **악보 이미지 파일**이 모여 있는 폴더 (jpg · png · gif · webp · bmp, PDF 는 보기만 가능)

## 설치

### 방법 1. ZIP 으로 받기 — 가장 간단
1. **[최신 릴리즈 페이지](https://github.com/byraju-hub/scorebox/releases/latest)** 에서 아래쪽 **Assets** 의 **`ScoreBox-버전.zip`** 을 내려받습니다. (`Source code` 가 아니라 `ScoreBox-…zip` 입니다)
2. 받은 ZIP 의 압축을 원하는 곳에 풉니다. (예: `C:\` 에 풀면 `C:\ScoreBox` 폴더가 생깁니다)
3. 폴더 안의 **`scorebox.html`** 을 Chrome 으로 엽니다. (파일을 Chrome 창에 끌어다 놓아도 됩니다)

> 💡 자주 쓰려면 Chrome 에서 연 뒤 **북마크(Ctrl+D)** 해 두세요.

### 방법 2. Git 으로 받기 — 업데이트가 쉬움
1. [Git for Windows](https://git-scm.com/download/win) 를 설치합니다.
2. 원하는 위치에서 PowerShell 을 열고 다음을 입력합니다.
   ```
   git clone https://github.com/byraju-hub/scorebox.git
   ```
3. 만들어진 `scorebox` 폴더의 `scorebox.html` 을 Chrome 으로 엽니다.

## 처음 시작하기

1. `scorebox.html` 을 열고 **📁 악보 폴더 선택**을 누릅니다.
2. 악보가 들어 있는 폴더를 고릅니다. 하위 폴더까지 모두 읽습니다.
   ```
   악보 폴더 (예: 내 PC\사진\악보)
   ├─ 찬송가\           ← 하위 폴더 이름은 카테고리가 됩니다
   │   └─ G_나의 갈 길 다 가도록.png
   ├─ 경배\
   │   └─ A 주님의 마음을 가진 자.jpg
   └─ 은혜 (E).png      ← 파일 이름의 코드(G, A, E, Am …)를 자동으로 읽습니다
   ```
3. Chrome 이 폴더 접근을 물으면 **"이 사이트를 방문할 때마다 허용"** 을 고릅니다. 다음부터는 열자마자 바로 시작합니다.
4. 처음에는 자동으로 읽은 코드에 **⚠ 확인 필요** 표시가 붙습니다. 카드를 눌러 확인 · 수정하면 됩니다.

> Chrome 이 보호하는 폴더(문서 · 다운로드 · 바탕화면 폴더 **자체**)는 고를 수 없습니다. 그 안에 `악보` 같은 하위 폴더를 만들어 고르세요.

## 업데이트

- **ZIP 으로 받았다면**: [최신 릴리즈](https://github.com/byraju-hub/scorebox/releases/latest)의 새 ZIP 을 받아 압축을 풀고, 기존 폴더에 **덮어쓰기** 합니다.
- **Git 으로 받았다면**: 폴더의 **`update.bat`** 을 더블클릭합니다.

업데이트 후 ScoreBox 가 열려 있었다면 Chrome 에서 **Ctrl+F5** 를 누르세요.
분류 정보 · 콘티는 악보 폴더에 따로 저장되어 있어서 업데이트해도 지워지지 않습니다.

## 내 데이터는 어디에 저장되나요?

ScoreBox 는 **원본 악보 파일을 고치지 않습니다.** 내가 고른 악보 폴더 안에 다음만 만듭니다.

| 이름 | 내용 |
|---|---|
| `scorebox_data.json` | 코드 · 빠르기 · 카테고리 · 메모 · 콘티 · 바구니 등 **모든 정리 정보** |
| `콘티출력\` | 💾 JPG로 저장한 콘티 이미지 |
| `_삭제된악보\` | ScoreBox 에서 "파일 삭제"한 악보 (실제로 지우지 않고 여기로 옮김) |

- 다른 PC 로 옮기려면 **악보 폴더를 통째로** 복사하면 됩니다.
- 실수에 대비해 [백업 기능](GUIDE.md#7-백업--복원)을 켜 두는 것을 권합니다.
- 인터넷으로 나가는 것은 **찬양 추천 · AI 띄어쓰기**를 직접 눌렀을 때뿐이며, 이때도 **곡 제목과 성경 구절만** 보냅니다(악보 이미지는 보내지 않음). [자세히](GUIDE.md#6-찬양-추천-ai)

## 자주 묻는 질문

<details>
<summary><b>열 때마다 폴더를 다시 골라야 해요</b></summary>

폴더 접근 허용 창에서 **"이 사이트를 방문할 때마다 허용"** 을 고르세요. "이번만 허용"을 고르면 열 때마다 **📂 "폴더 이름" 폴더 열기** 버튼을 한 번 눌러야 합니다.
</details>

<details>
<summary><b>악보 폴더에 새 악보를 넣었는데 안 보여요</b></summary>

왼쪽 아래 **📁 폴더 다시 스캔**을 누르거나 ScoreBox 를 다시 여세요.
</details>

<details>
<summary><b>업데이트했는데 화면이 그대로예요</b></summary>

Chrome 에서 **Ctrl+F5** 를 눌러 새로 고치세요.
</details>

<details>
<summary><b>화면 위쪽에 빨간 경고가 떠요 ("다른 탭에서도 열려 있습니다")</b></summary>

ScoreBox 가 두 탭(창)에서 동시에 열려 있다는 뜻입니다. 두 곳에서 고치면 나중에 저장한 쪽이 다른 쪽의 변경을 덮어쓰므로, 하나만 남기고 닫으세요.
</details>

<details>
<summary><b>"scorebox_data.json 파일이 손상되었습니다"라고 나와요</b></summary>

백업 폴더를 지정해 두었다면 시작 화면의 **🗂 백업에서 복원** 버튼으로 가장 최근 백업으로 되돌릴 수 있습니다.
</details>

<details>
<summary><b>PDF 악보도 콘티에 넣을 수 있나요?</b></summary>

악보함에서 보기만 할 수 있고, 인쇄 · JPG 배치에는 이미지(jpg · png 등)만 쓸 수 있습니다. PDF 는 이미지로 변환해 넣어 주세요.
</details>

<details>
<summary><b>여러 사람이 같이 쓸 수 있나요?</b></summary>

ScoreBox 는 한 PC 에서 혼자 쓰는 프로그램입니다. 같은 악보 폴더를 OneDrive 등으로 공유하면 쓸 수는 있지만, **동시에** 고치면 한쪽의 변경이 사라질 수 있습니다. 콘티는 **📥 콘티 가져오기**로 다른 사람의 `scorebox_data.json` 에서 가져올 수 있습니다.
</details>

## 글꼴

콘티 인쇄에 쓰는 **고운 도담** 글꼴은 [SIL Open Font License 1.1](fonts/OFL.txt) 을 따릅니다.

---

## 개발자용 정보

빌드 과정이 없습니다. `scorebox.html` 이 아래 스크립트를 번호 순서대로 불러오며, 앞 파일의 함수를 뒤 파일이 사용합니다.

| 파일 | 내용 |
|---|---|
| `scorebox.html` | 화면 구성 |
| `css/scorebox.css` | 스타일 |
| `js/1-library.js` | 악보함: 데이터 저장 · 스캔 · 카드 · 편집 · 시작 화면 |
| `js/2-conti.js` | 콘티: 목록 · 편집 · 곡 추가 · 인쇄 레이아웃 · 자르기 · JPG |
| `js/3-basket.js` | 콘티 바구니 |
| `js/4-recommend.js` | 찬양 추천 (Claude API) |
| `js/5-backup.js` | 백업 · 복원 |
| `js/6-tags-dup.js` | 카테고리 설정 · 중복 곡 정리 |
| `js/7-stats-hymn.js` | 콘티 통계 · 찬송가/CCM 분류 · 찬송가 장 수 |
| `js/8-spacing.js` | 제목 띄어쓰기 정리 |
| `fonts/` | 고운 도담 글꼴 (OFL) |
| `tests/` | 자동 테스트 (Playwright) |
| `update.bat` | Git 으로 받은 폴더 업데이트 (Windows) |

### 자동 테스트
실제 Chromium 으로 앱을 열어 스캔 · 콘티 · 인쇄 배치 · JPG · 바구니 · 휴지통 · 백업/복원 · 찬양 추천(가짜 응답) 등을 확인합니다. 브라우저 임시 저장소를 쓰므로 PC 의 악보 폴더는 건드리지 않습니다. `main` 에 올리거나 PR 을 만들면 GitHub Actions 에서도 자동으로 실행됩니다.
```
cd tests
npm install
npx playwright install chromium
npm test
```
