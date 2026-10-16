// ScoreBox 자동 테스트 — 실제 Chrome(Chromium)으로 scorebox.html 을 열어 주요 기능을 확인합니다.
// 악보 폴더 대신 브라우저의 임시 저장소(OPFS)를 쓰므로 PC의 악보 파일은 건드리지 않습니다.
// 실행: cd tests && npm install && npx playwright install chromium && npm test
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'output');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/scorebox.html`;

const browser = await chromium.launch();
const results = [];
const ok = (cond, what) => { if (!cond) throw new Error(what); };
const today = (add = 0) => { const t = new Date(Date.now() + add * 86400000); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

// 새 페이지 + 빈 악보 폴더(OPFS) + 테스트용 그림 파일
// 참고: 테스트용 임시 저장소(OPFS)는 한글 파일·폴더 이름을 만들 수 없어서 영문 이름을 쓰고,
//       '콘티출력' · '_삭제된악보' 폴더도 테스트에서는 영문 이름으로 바꿔 씁니다 (실제 PC 폴더에서는 한글 그대로).
async function setup(files = {}, { scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL_);
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    window.__mk = async (rel, { w = 400, h = 300, text = rel, type = 'image/png', raw } = {}) => {
      const parts = rel.split('/'); let d = root;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      let blob = raw;
      if (!blob) { const c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#000'; x.font = '24px sans-serif'; x.fillText(text, 20, 40); for (let i = 0; i < 5; i++) x.fillRect(20, 80 + i * 30, w - 40, 2); blob = await c.convertToBlob({ type }); }
      const wr = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable(); await wr.write(blob); await wr.close();
    };
    DIRS.out = 'out'; DIRS.trash = '_trash';
    for (const [rel, o] of Object.entries(files)) await window.__mk(rel, o);
    await window.ScoreBox.open(root);
  }, files);
  return { ctx, page, errors };
}
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push([true, name, Date.now() - t0]); console.log(`  ✓ ${name}`); }
  catch (e) { results.push([false, name, e.message]); console.log(`  ✗ ${name}\n      ${e.message}`); }
}

console.log('ScoreBox 테스트');

await test('스캔: 파일명에서 코드 추정, 하위 폴더는 카테고리, 데이터 파일 저장', async () => {
  const { ctx, page, errors } = await setup({ 'G-gamsa.png': {}, 'Am jumin.png': { w: 401 }, 'praise/D-eunhye.png': { w: 402 } });
  const r = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory(); let saved = false;
    try { await root.getFileHandle('scorebox_data.json'); saved = true; } catch (e) {}
    const sc = fsx.db.scores;
    return { n: Object.keys(sc).length, g: sc['G-gamsa.png'].key, am: sc['Am jumin.png'].key, tag: sc['praise/D-eunhye.png'].tags, saved, cards: document.querySelectorAll('.card').length };
  });
  ok(r.n === 3 && r.cards === 3, `곡 수 ${r.n}, 카드 ${r.cards}`);
  ok(r.g === 'G' && r.am === 'Am', `코드 추정 ${r.g}/${r.am}`);
  ok(r.tag.includes('praise'), `카테고리 ${r.tag}`);
  ok(r.saved, 'scorebox_data.json 이 저장되지 않음');
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('파일 삭제: 실제로 지우지 않고 _삭제된악보 폴더로 옮기고, 스캔에서 빠짐', async () => {
  const { ctx, page, errors } = await setup({ 'G-a.png': {}, 'sub/A-b.png': { w: 410 } });
  const r = await page.evaluate(async () => {
    await removeFile('sub/A-b.png'); delete fsx.db.scores['sub/A-b.png']; await saveDb();
    const root = await navigator.storage.getDirectory();
    const moved = await (await (await root.getDirectoryHandle('_trash')).getDirectoryHandle('sub')).getFileHandle('A-b.png').then(() => true, () => false);
    const still = await (await root.getDirectoryHandle('sub')).getFileHandle('A-b.png').then(() => true, () => false);
    const s = await scanFs(); return { moved, still, total: s.total, keys: Object.keys(fsx.db.scores) };
  });
  ok(r.moved && !r.still, `옮겨짐=${r.moved}, 원래 자리에 남음=${r.still}`);
  ok(r.total === 1 && !r.keys.some(k => k.startsWith('_trash')), `다시 스캔 결과 ${r.total} ${r.keys}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('이름 바뀐 파일: 분류·메모·콘티·바구니 연결을 새 파일로 이어 감', async () => {
  const { ctx, page, errors } = await setup({ 'G-old.png': { w: 433, h: 211 }, 'C-other.png': {} });
  const r = await page.evaluate(async () => {
    const sc = fsx.db.scores; sc['G-old.png'].note = '메모'; sc['G-old.png'].tempo = 'slow';
    fsx.db.contis = [{ id: 'c1', date: '2026-01-04', type: '주일', service: '주일 찬양', songs: [{ title: 'old', canon: 'old', key: 'G', files: ['G-old.png'], file: 'G-old.png', print: true }] }];
    fsx.db.basket = ['G-old.png']; await saveDb();
    const root = await navigator.storage.getDirectory();
    const blob = await (await root.getFileHandle('G-old.png')).getFile();
    const d = await root.getDirectoryHandle('newdir', { create: true });
    const w = await (await d.getFileHandle('G-new.png', { create: true })).createWritable(); await w.write(blob); await w.close();
    await root.removeEntry('G-old.png');
    await scanFs();
    const n = fsx.db.scores['newdir/G-new.png'];
    return { note: n && n.note, tempo: n && n.tempo, old: !!fsx.db.scores['G-old.png'], file: fsx.db.contis[0].songs[0].file, basket: fsx.db.basket };
  });
  ok(r.note === '메모' && r.tempo === 'slow', `분류가 옮겨지지 않음: ${JSON.stringify(r)}`);
  ok(!r.old, '예전 항목이 남아 있음');
  ok(r.file === 'newdir/G-new.png' && r.basket[0] === 'newdir/G-new.png', `콘티/바구니 연결 ${r.file} ${r.basket}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('최근 사용 표시: 28일 안에 쓴 곡과 예정된 곡에 배지', async () => {
  const { ctx, page, errors } = await setup({ 'G-gamsa.png': {}, 'A-gippeum.png': { w: 401 }, 'C-pyeongan.png': { w: 402 } });
  const r = await page.evaluate(async ([d1, d2, d3]) => {
    const mk = (id, date, t) => ({ id, date, type: '주일', service: '주일 찬양', songs: [{ title: t, canon: normT(t), key: '', files: [], file: '', print: true }] });
    fsx.db.scores['G-gamsa.png'].title = '감사'; fsx.db.scores['A-gippeum.png'].title = '기쁨'; fsx.db.scores['C-pyeongan.png'].title = '평안';
    fsx.db.contis = [mk('a', d1, '감사'), mk('b', d2, '기쁨'), mk('c', d3, '평안')]; await load();
    const txt = t => [...document.querySelectorAll('.card')].find(c => c.querySelector('.t').textContent === t).querySelector('.meta').textContent;
    return { a: txt('감사'), b: txt('기쁨'), c: txt('평안') };
  }, [today(-3), today(5), today(-60)]);
  ok(r.a.includes('3일 전'), `최근 사용 배지 없음: ${r.a}`);
  ok(r.b.includes('예정'), `예정 배지 없음: ${r.b}`);
  ok(!r.c.includes('일 전') && !r.c.includes('예정'), `오래된 곡에 배지가 붙음: ${r.c}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('콘티 JPG: A4 크기, 같은 날짜 콘티는 a/b 로 구분된 파일명', async () => {
  const { ctx, page, errors } = await setup({ 'G-hana.png': { w: 600, h: 800 }, 'A-dul.png': { w: 600, h: 500 } });
  const r = await page.evaluate(async () => {
    const song = (f, t) => ({ title: t, canon: normT(t), key: f[0], files: [f], file: f, print: true });
    fsx.db.contis = [
      { id: 'x1', date: '2025-03-02', type: '주일', service: '주일 1부', songs: [song('G-hana.png', '하나')] },
      { id: 'x2', date: '2025-03-02', type: '주일', service: '주일 2부', songs: [song('A-dul.png', '둘')] },
      { id: 'x3', date: '2025-03-09', type: '주일', service: '주일', songs: [song('G-hana.png', '하나')] }];
    const names = [], sizes = [];
    for (const c of fsx.db.contis) {
      openPrint(c); await new Promise(r => setTimeout(r, 600)); P.lay = null;
      const files = await exportJpgs(); names.push(files.map(f => f.name).join(','));
      const bm = await createImageBitmap(files[0].blob); sizes.push(bm.width + 'x' + bm.height);
      $('#pclose').click();
    }
    return { names, sizes };
  });
  ok(r.names[0].startsWith('250302a-1.jpg') && r.names[1].startsWith('250302b-1.jpg'), `같은 날짜 파일명 ${r.names}`);
  ok(r.names[2].startsWith('250309-1.jpg'), `일반 파일명 ${r.names[2]}`);
  ok(r.sizes.every(s => s === '2339x1654'), `A4(200dpi) 크기가 아님: ${r.sizes}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('콘티 텍스트 복사: 인쇄 창에도 버튼이 있고 같은 형식(샬롬~*, 빈 줄, 번호 곡명 (코드))', async () => {
  const { ctx, page, errors } = await setup({ 'D-a.png': {}, 'D-b.png': { w: 401 } });
  const r = await page.evaluate(async () => {
    const song = (f, t) => ({ title: t, canon: normT(t), key: 'D', files: [f], file: f, print: true });
    const c = { id: 'z', date: '2026-10-16', type: '금요기도회', service: '금요기도회 설교 후 찬양', songs: [song('D-a.png', '예수늘함께계시네'), song('D-b.png', '나무엇과도주님을')] };
    fsx.db.contis = [c]; let copied = '';
    navigator.clipboard.writeText = async t => { copied = t; };
    openPrint(c); await new Promise(r => setTimeout(r, 400));
    $('#pcopy').click(); await new Promise(r => setTimeout(r, 100));
    return copied;
  });
  ok(r === '샬롬~*\n10/16 금요기도회 설교 후 찬양입니다.\n\n1. 예수늘함께계시네 (D)\n2. 나무엇과도주님을 (D)', JSON.stringify(r));
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('배치 "가로 한 면에 2칸 (단면)": 장마다 2칸, 앞/뒤 구분 없이 1·2·3 장, 모든 장에 머리글', async () => {
  const { ctx, page, errors } = await setup({ 'G-a.png': { w: 600, h: 900 }, 'G-b.png': { w: 601, h: 900 }, 'G-c.png': { w: 602, h: 900 }, 'G-d.png': { w: 603, h: 900 }, 'G-e.png': { w: 604, h: 900 } });
  const r = await page.evaluate(async () => {
    const song = (f, t) => ({ title: t, canon: normT(t), key: 'G', files: [f], file: f, print: true, place: 'new' });
    const c = { id: 's1', date: '2026-10-16', type: '금요기도회', service: '금요기도회', header: '머리글', headerCustom: true,
      songs: ['a', 'b', 'c', 'd', 'e'].map(x => song(`G-${x}.png`, x)) };
    fsx.db.contis = [c]; c.print = { ...prefsOf(c), mode: '2up1' };
    openPrint(c); await new Promise(r => setTimeout(r, 700));
    const pages = P.lay.pages.map(pg => ({ no: pg.no, single: pg.single, front: pg.front, header: pg.header, panels: pg.panels.filter(pn => pn.items.some(i => i.kind === 'img')).length, W: pg.W, H: pg.H }));
    const files = await exportJpgs();
    return { pages, names: files.map(f => f.name), labels: [...document.querySelectorAll('.pglab')].map(e => e.textContent) };
  });
  ok(r.pages.length === 3, `장 수 ${r.pages.length}`);
  ok(r.pages.map(p => p.panels).join() === '2,2,1', `장별 칸 ${r.pages.map(p => p.panels)}`);
  ok(r.pages.every(p => p.single && p.front && p.header === '머리글' && p.W > p.H), `단면 속성 ${JSON.stringify(r.pages)}`);
  ok(r.names.join() === '261016-1.jpg,261016-2.jpg,261016-3.jpg', `파일명 ${r.names}`);
  ok(r.labels[0].includes('1페이지') && !r.labels[0].includes('앞'), `미리보기 이름 ${r.labels}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('인쇄 설정: 기본 A3·2칸(양면), 콘티마다 따로 저장, 곡 수별 프리셋(1곡/2곡/3곡 이상)', async () => {
  const files = {}; for (const n of 'abcdefgh') files[`G-${n}.png`] = { w: 600 + n.charCodeAt(0), h: 700 };
  const { ctx, page, errors } = await setup(files);
  const r = await page.evaluate(async () => {
    const song = (n, i) => ({ title: n, canon: n, key: 'G', files: [`G-${n}.png`], file: `G-${n}.png`, print: true, place: 'new' });
    const mk = (id, n) => ({ id, date: '2026-11-0' + (id.charCodeAt(0) % 9 + 1), type: '주일', service: '주일', songs: 'abcdefgh'.slice(0, n).split('').map(song) });
    const A = mk('A', 1), B = mk('B', 1), C = mk('C', 2), D = mk('D', 3), E = mk('E', 8);
    fsx.db.contis = [A, B, C, D, E];
    const open = async c => { openPrint(c); await new Promise(r => setTimeout(r, 450)); return { paper: $('#p-paper').value, mode: $('#p-mode').value, stat: $('#p-prestat').textContent }; };
    const out = {};
    out.defA = await open(A);                                                     // 기본값
    $('#p-paper').value = 'A4'; $('#p-paper').dispatchEvent(new Event('input')); // A 콘티만 A4 로
    out.A_after = [A.print && A.print.paper, B.print === undefined];
    $('#pclose').click(); out.B = await open(B);                                  // B 는 그대로 A3
    $('#p-paper').value = 'B4'; $('#p-mode').value = '2up1';
    $('#p-paper').dispatchEvent(new Event('input')); $('#p-presave').click();     // B 설정을 '1곡' 프리셋으로 저장
    out.preset1 = presets()['1'].paper + '/' + presets()['1'].mode + ' B.print=' + B.print;
    $('#pclose').click(); out.A = await open(A);                                  // A 는 개별 설정(A4) 유지
    $('#pclose').click(); out.C = await open(C);                                  // 2곡 → 2곡 프리셋(A3/2up)
    $('#pclose').click(); out.D = await open(D);                                  // 3곡 → 3곡 이상 프리셋
    // 곡 수 바뀌면 프리셋 전환: D 에서 곡 하나만 남기면 1곡 프리셋(B4/단면)
    D.songs[1].print = false; D.songs[2].print = false; refreshPreview(); await new Promise(r => setTimeout(r, 700));
    out.D_one = { paper: $('#p-paper').value, mode: $('#p-mode').value, stat: $('#p-prestat').textContent };
    $('#pclose').click(); out.E = await open(E);                                  // 8곡: 칸이 늘어나면 칸 번호 선택지도 늘어남
    out.opts = document.querySelector('#psongs select.pl').options.length - 3; out.panels = P.lay.panelCount;
    return out;
  });
  ok(r.defA.paper === 'A3' && r.defA.mode === '2up', `기본값 ${JSON.stringify(r.defA)}`);
  ok(r.A_after[0] === 'A4' && r.A_after[1], `A만 바뀌어야 함 ${r.A_after}`);
  ok(r.B.paper === 'A3', `다른 콘티는 그대로여야 함 ${JSON.stringify(r.B)}`);
  ok(r.preset1 === 'B4/2up1 B.print=undefined', `1곡 프리셋 ${r.preset1}`);
  ok(r.A.paper === 'A4', `개별 설정 유지 ${JSON.stringify(r.A)}`);
  ok(r.C.paper === 'A3' && r.C.mode === '2up' && r.C.stat.includes('2곡'), `2곡 ${JSON.stringify(r.C)}`);
  ok(r.D.paper === 'A3' && r.D.stat.includes('3곡 이상'), `3곡 이상 ${JSON.stringify(r.D)}`);
  ok(r.D_one.paper === 'B4' && r.D_one.mode === '2up1' && r.D_one.stat.includes('1곡 프리셋'), `곡 수 변경 시 프리셋 전환 ${JSON.stringify(r.D_one)}`);
  ok(r.E.paper === 'A3' && r.opts >= r.panels + 1 && r.opts >= 6, `칸 번호 선택지 ${r.opts}, 칸 ${r.panels}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('제목 띄어쓰기 정리: 찬송가 목록 → 다른 콘티 → AI(Haiku) 순으로 적용, 글자가 바뀐 답은 버림', async () => {
  const { ctx, page, errors } = await setup({ 'G-h.png': {}, 'G-c.png': { w: 401 }, 'G-n.png': { w: 402 }, 'G-x.png': { w: 403 }, 'G-s.png': { w: 404 } });
  let asked = null;
  await page.route('https://api.anthropic.com/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    asked = JSON.parse(route.request().postData());
    const list = JSON.parse(asked.messages[0].content.match(/\[\{"n".*?\}\]/s)[0]);
    const spaced = { '그날이도적같이': '그날이 도적같이', '나무엇과도': '나 무엇과도' };   // 일부러 틀린 답(글자가 다름)도 섞음
    const out = list.map(x => ({ n: x.n, t: x.t === '이상한곡제목' ? '이상한곡 제목입니다' : (spaced[x.t] || x.t) }));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }] }) });
  });
  await page.evaluate(async () => {
    const sc = fsx.db.scores;
    sc['G-h.png'].title = '갈릴리마을그숲속에서524'; sc['G-c.png'].title = '모든능력과모든권세'; sc['G-n.png'].title = '그날이도적같이'; sc['G-x.png'].title = '이상한곡제목'; sc['G-s.png'].title = '이미 띄어쓴 제목';
    fsx.db.hymns = { titles: ['갈릴리 마을 그 숲속에서', '모든 능력과 모든 권세'], updated: '2026-01-01' };   // 찬송가 목록
    fsx.db.contis = [{ id: 'c1', date: '2026-01-04', type: '주일', service: '주일', songs: [{ title: '모든 능력과 모든 권세(찬양)', canon: '모든능력과모든권세', key: 'G', files: [], file: '', print: true }, { title: '모든능력과모든권세', canon: '모든능력과모든권세', key: 'G', files: [], file: '', print: true }] }];
    await load();
    const root = await navigator.storage.getDirectory(); const w = await (await root.getFileHandle('claude_api_key.txt', { create: true })).createWritable(); await w.write('sk-ant-TEST'); await w.close();
    document.querySelector('#spacebtn').click();
  });
  const rows1 = await page.evaluate(() => SP.rows.map(r => r.old + '→' + r.neu + '[' + r.src + ']').join(' | '));
  ok(rows1.includes('갈릴리마을그숲속에서524→갈릴리 마을 그 숲속에서[찬송가 목록]'), `찬송가 목록 ${rows1}`);
  ok(rows1.includes('모든능력과모든권세→모든 능력과 모든 권세[찬송가 목록]') || rows1.includes('[다른 콘티]'), `찬송가/콘티 ${rows1}`);
  ok(await page.evaluate(() => SP.todo.map(g => g.old).sort().join()) === '그날이도적같이,이상한곡제목', '남은 곡(AI 대상)이 다름');
  await page.click('#sp-ai'); await page.waitForFunction(() => !SP.busy && /AI가|실패/.test($('#sp-msg').textContent), null, { timeout: 15000 }); await page.waitForTimeout(200);
  const ai = await page.evaluate(() => SP.rows.filter(r => r.src === 'AI').map(r => r.old + '→' + r.neu).join('|'));
  ok(ai.includes('그날이도적같이→그날이 도적같이') && ai.includes('이상한곡제목→이상한곡 제목입니다') === false, `AI 결과 ${ai}`);   // 글자가 바뀐 '입니다' 답은 버려짐
  await page.click('#sp-apply'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ t: Object.fromEntries(Object.entries(fsx.db.scores).map(([k, v]) => [k, v.title])), conti: fsx.db.contis[0].songs.map(g => g.title) }));
  ok(r.t['G-h.png'] === '갈릴리 마을 그 숲속에서', `찬송가 적용 ${r.t['G-h.png']}`);
  ok(r.t['G-c.png'] === '모든 능력과 모든 권세(찬양)' || r.t['G-c.png'] === '모든 능력과 모든 권세', `콘티 제목 적용 ${r.t['G-c.png']}`);
  ok(r.t['G-n.png'] === '그날이 도적같이' && r.t['G-x.png'] === '이상한곡제목' && r.t['G-s.png'] === '이미 띄어쓴 제목', `AI/보존 ${JSON.stringify(r.t)}`);
  ok(r.conti[1].includes(' ') && r.conti[1].replace(/\s/g, '').startsWith('모든능력과모든권세'), `콘티 속 곡 ${r.conti}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('찬송가 장 수 기록: 찬송가 카테고리 곡의 메모에 "310장" 기록, 기존 메모 보존, 다시 실행해도 그대로, 검색으로 찾기', async () => {
  const { ctx, page, errors } = await setup({ 'G-a.png': {}, 'G-b310.png': { w: 401 }, 'G-c.png': { w: 402 }, 'G-d.png': { w: 403 }, 'G-e.png': { w: 404 } });
  const r = await page.evaluate(async () => {
    const sc = fsx.db.scores;
    sc['G-a.png'].title = '주 하나님 지으신 모든 세계'; sc['G-a.png'].tags = ['찬송가']; sc['G-a.png'].note = '내 메모';
    sc['G-b310.png'].title = '이름없는곡310'; sc['G-b310.png'].tags = ['찬송가'];        // 제목은 목록에 없고 파일명 끝 번호(310)로 찾음
    sc['G-e.png'].title = '주 하나님 지으신 모든 세계(찬79)'; sc['G-e.png'].tags = ['찬송가'];
    sc['G-c.png'].title = '새찬송'; sc['G-c.png'].tags = ['CCM'];                      // CCM 은 대상이 아님
    sc['G-d.png'].title = '알수없는찬송'; sc['G-d.png'].tags = ['찬송가'];             // 못 찾는 곡
    fsx.db.hymns = { titles: ['주 하나님 지으신 모든 세계'], items: [{ n: 79, title: '주 하나님 지으신 모든 세계' }], updated: '2026-01-01' };
    await load(); document.querySelector('#hymnbtn').click();
    const first = hnPlan(); document.querySelector('#hnapply').click(); await new Promise(r => setTimeout(r, 400));
    const second = hnPlan();
    $('#hclose').click(); $('#q').value = '310장'; render();
    return { rows: first.rows.map(x => x.id + '=' + x.tag + ':' + x.how).join(), none: first.none.map(x => x.id).join(), notes: Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, v.note])), titles: Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, v.title])), again: second.rows.length, found: [...document.querySelectorAll('.card .t')].map(e => e.textContent).join() };
  });
  ok(r.rows.includes('G-a.png=79장:제목 일치') && r.rows.includes('G-b310.png=310장:파일명 번호'), `대상 ${r.rows}`);
  ok(r.none === 'G-d.png', `못 찾은 곡 ${r.none}`);
  ok(r.notes['G-a.png'] === '79장 · 내 메모' && r.notes['G-b310.png'] === '310장' && !r.notes['G-c.png'], `메모 ${JSON.stringify(r.notes)}`);
  ok(r.titles['G-b310.png'] === '이름없는곡' && r.titles['G-e.png'] === '주 하나님 지으신 모든 세계', `제목에서 장 수 제거 ${JSON.stringify(r.titles)}`);
  ok(r.again === 0, `다시 실행 시 바뀌는 곡 ${r.again}`);
  ok(r.found === '이름없는곡', `검색 결과 ${r.found}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('콘티 휴지통: 삭제 → 휴지통 → 복원, 30일 지난 콘티는 자동 삭제', async () => {
  const { ctx, page, errors } = await setup({});
  const r = await page.evaluate(async () => {
    const mk = (id, d) => ({ id, date: d, type: '주일', service: '주일', songs: [] });
    fsx.db.contis = [mk('a', '2026-01-04'), mk('b', '2026-01-11')];
    fsx.db.contisTrash = [Object.assign(mk('old', '2025-01-01'), { deletedAt: new Date(Date.now() - 31 * 86400000).toISOString() })];
    setMode('conti'); C.sel = contis()[0]; renderContiDetail(); $('#d-del').click();
    const afterDel = [contis().length, trash().map(c => c.id).join()];
    $('#ctrash').click(); document.querySelector('#trres .tri button[data-a=re]').click();
    return { afterDel, afterRestore: [contis().length, trash().length] };
  });
  ok(r.afterDel[0] === 1 && r.afterDel[1] === 'a', `삭제 후 ${r.afterDel}`);
  ok(r.afterRestore[0] === 2 && r.afterRestore[1] === 0, `복원 후 ${r.afterRestore}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('콘티 바구니: 카드 버튼으로 담기, 바구니로 새 콘티 만들기', async () => {
  const { ctx, page, errors } = await setup({ 'G-gamsa.png': {}, 'A-gippeum.png': { w: 401 } });
  await page.evaluate(async () => { fsx.db.scores['G-gamsa.png'].title = '감사'; fsx.db.scores['A-gippeum.png'].title = '기쁨'; await load(); });
  await page.locator('.card', { hasText: '감사' }).locator('.bkb').click();
  await page.locator('.card', { hasText: '기쁨' }).locator('.bkb').click();
  const inb = await page.locator('.card.inb').count();
  await page.click('#tab-conti'); await page.click('#bknew');
  const r = await page.evaluate(() => ({ songs: C.sel.songs.map(s => s.title).join(), left: basket().length }));
  ok(inb === 2, `바구니 표시 카드 ${inb}`);
  ok(r.songs === '감사,기쁨' && r.left === 0, JSON.stringify(r));
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('백업: 지금 백업 → 목록 → 복원 (복원 전 데이터도 백업)', async () => {
  const { ctx, page, errors } = await setup({ 'G-a.png': {} });
  const r = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    BK.handle = await root.getDirectoryHandle('backup', { create: true });
    fsx.db.scores['G-a.png'].note = '처음'; await saveDb();
    const name = await backupNow();
    fsx.db.scores['G-a.png'].note = '바뀜'; await saveDb();
    await bkRestore(BK.handle, name); await load();
    const list = await bkList(BK.handle);
    return { note: fsx.db.scores['G-a.png'].note, list };
  });
  ok(r.note === '처음', `복원 후 메모 ${r.note}`);
  ok(r.list.length === 2 && r.list.some(n => n.includes('before_restore')), `백업 목록 ${r.list}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('데이터 파일이 손상되면 시작 화면에 "백업에서 복원" 안내', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL_);
  const r = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
    const w = await (await root.getFileHandle('scorebox_data.json', { create: true })).createWritable(); await w.write('{"scores": {"a":'); await w.close();
    await window.ScoreBox.open(root);
    return { msg: $('#smsg').textContent, btn: getComputedStyle($('#btn-restore')).display };
  });
  ok(r.msg.includes('손상') && r.btn !== 'none', JSON.stringify(r));
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('찬양 추천: 악보 폴더의 bible.json · API 키로 Haiku 에 요청, 결과 표시', async () => {
  const { ctx, page, errors } = await setup({ 'G-gamsa.png': {} });
  let sent = null, key = null;
  await page.route('https://api.anthropic.com/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    sent = JSON.parse(route.request().postData()); key = route.request().headers()['x-api-key'];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ summary: '요약', library: [{ title: '감사', reason: '이유' }], outside: [{ title: '다른 곡', artist: '', reason: '이유2' }] }) }] }) });
  });
  await page.evaluate(async () => {
    fsx.db.scores['G-gamsa.png'].title = '감사'; await load();
    const root = await navigator.storage.getDirectory();
    const put = async (n, t) => { const w = await (await root.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); };
    await put('claude_api_key.txt', 'sk-ant-TEST\n');
    await put('bible.json', JSON.stringify({ books: [{ name: '요한복음', short: '요', verses: [{ chapter: 3, verse: '16', v1: 16, v2: 16, text: '하나님이 세상을 이처럼 사랑하사' }] }] }));
  });
  await page.click('#recbtn');
  await page.waitForFunction(() => REC.books.length && REC.key);
  await page.click('#rc-go'); await page.waitForTimeout(500);
  const txt = await page.innerText('#rc-res');
  ok(sent && sent.model === 'claude-haiku-5-5' && key === 'sk-ant-TEST', `요청 ${sent && sent.model} ${key}`);
  ok(sent.messages[0].content.includes('요한복음 3:16') && sent.messages[0].content.includes('감사'), '요청에 본문/곡 목록이 없음');
  ok(txt.includes('감사') && txt.includes('다른 곡'), `결과 ${txt}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('찬양 추천: 악보 보기 후에도 추천 창·결과가 유지되고, 앱을 다시 열어도 마지막 결과가 보임', async () => {
  const { ctx, page, errors } = await setup({ 'G-gamsa.png': {} });
  await page.route('https://api.anthropic.com/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ summary: '요약문', library: [{ title: '감사', reason: '이유1' }], outside: [] }) }] }) });
  });
  await page.evaluate(async () => {
    fsx.db.scores['G-gamsa.png'].title = '감사'; await load();
    const root = await navigator.storage.getDirectory();
    const put = async (n, t) => { const w = await (await root.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); };
    await put('claude_api_key.txt', 'sk-ant-TEST');
    await put('bible.json', JSON.stringify({ books: [{ name: 'john', short: 'j', verses: [{ chapter: 3, verse: '16', v1: 16, v2: 16, text: 'for god so loved' }, { chapter: 3, verse: '17', v1: 17, v2: 17, text: 'x' }] }] }));
  });
  await page.click('#recbtn'); await page.waitForFunction(() => REC.books.length && REC.key);
  await page.selectOption('#rc-v1', '17'); await page.selectOption('#rc-v2', '17');
  await page.click('#rc-go'); await page.waitForSelector('#rc-res .rci');
  await page.locator('#rc-res .op').first().click(); await page.waitForTimeout(300);
  let st = await page.evaluate(() => [$('#recdlg').open, $('#dlg').open]);
  ok(st[0] && st[1], `악보 보기 후 창 상태 ${st}`);
  await page.click('#e-close');
  st = await page.evaluate(() => [$('#recdlg').open, $('#dlg').open, $('#rc-res').textContent.includes('요약문')]);
  ok(st[0] && !st[1] && st[2], `악보 닫은 뒤 ${st}`);
  await page.click('#rc-close'); await page.click('#recbtn'); await page.waitForTimeout(400);
  const again = await page.evaluate(() => ({ txt: $('#rc-res').textContent, v: $('#rc-v1').value }));
  ok(again.txt.includes('요약문') && again.v === '17', `다시 열었을 때 ${JSON.stringify(again)}`);
  // 앱을 껐다 켠 것처럼: 페이지를 새로 읽고 같은 폴더를 다시 연다
  await page.reload();
  await page.evaluate(async () => { const root = await navigator.storage.getDirectory(); await window.ScoreBox.open(root); });
  await page.click('#recbtn'); await page.waitForFunction(() => REC.books.length); await page.waitForTimeout(300);
  const reopened = await page.evaluate(() => ({ txt: $('#rc-res').textContent, v: $('#rc-v1').value }));
  ok(reopened.txt.includes('요약문') && reopened.v === '17', `앱을 다시 연 뒤 ${JSON.stringify(reopened)}`);
  ok(!errors.length, errors.join());
  await ctx.close();
});

await test('화면 캡처 (라이트/다크) — tests/output 에 저장', async () => {
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await setup({ 'G-gamsa.png': {}, 'A-gippeum.png': { w: 401 } }, { scheme });
    await page.screenshot({ path: path.join(OUT, `library_${scheme}.png`) });
    await page.click('#tab-conti'); await page.screenshot({ path: path.join(OUT, `conti_${scheme}.png`) });
    ok(!errors.length, errors.join());
    await ctx.close();
  }
});

await browser.close(); server.close();
const fail = results.filter(r => !r[0]);
console.log(`\n${results.length - fail.length}/${results.length} 통과`);
process.exit(fail.length ? 1 : 0);
