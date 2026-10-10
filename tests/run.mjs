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
