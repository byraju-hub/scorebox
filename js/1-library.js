/* Raju's ScoreBox — 악보함: 데이터(scorebox_data.json) · 스캔 · 카드 화면 · 편집 · 시작 화면 */
const $=s=>document.querySelector(s);
const st={items:[],keys:[],tempos:{},key:new Set(),tempo:new Set(),tag:new Set(),unrev:false,showEx:false,exCount:0,sel:new Set(),cur:null,list:[]};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isPdf=id=>id.toLowerCase().endsWith('.pdf');
const splitTags=v=>String(v).split(/[,，]/);

/* ---------- 데이터 (scorebox_data.json) ---------- */
const DATA_NAME='scorebox_data.json';
// 악보 폴더 안의 특별한 폴더 (스캔에서 제외). 테스트에서는 바꿔 쓸 수 있도록 한곳에 모음
const DIRS={out:'콘티출력',trash:'_삭제된악보'};
const EXTS=new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.pdf']);
const DEFAULT_TEMPOS=[
  {id:'fast',label:'빠른',keywords:['빠른','fast','경쾌','신나는']},
  {id:'mid',label:'보통',keywords:[]},
  {id:'slow',label:'느린',keywords:['느린','slow','잔잔','고요','묵상']}];
const BASE=['C','C#','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const DEFAULT_KEYS=BASE.flatMap(n=>[n,n+'m']).map(name=>({name,aliases:[]}));
const SEP='[\\s_\\-()\\[\\].,]';
const KEY_END='(?=$|'+SEP+'|[^\\x00-\\x7f])'; // 뒤에 영문/숫자가 오면 코드가 아님 (예: Gloria)
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

const fsx={root:null,files:new Map(),db:null,urls:new Map(),q:Promise.resolve()};

function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('scorebox',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function kvGet(k){try{const d=await idb();return await new Promise((res,rej)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}catch(e){return undefined}}
async function kvSet(k,v){try{const d=await idb();await new Promise((res,rej)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){}}

async function loadDb(){
  let db={scores:{}};
  try{const f=await(await fsx.root.getFileHandle(DATA_NAME)).getFile();db=JSON.parse(await f.text())}
  catch(e){if(e.name!=='NotFoundError')throw e}
  db.scores=db.scores||{};
  db.tempos=db.tempos||DEFAULT_TEMPOS.map(t=>({...t,keywords:[...t.keywords]}));
  db.keys=db.keys||DEFAULT_KEYS.map(k=>({...k,aliases:[]}));
  fsx.db=db;
}
function saveDb(){
  const text=JSON.stringify(fsx.db,null,1);
  fsx.q=fsx.q.then(async()=>{
    const h=await fsx.root.getFileHandle(DATA_NAME,{create:true});
    const w=await h.createWritable();await w.write(text);await w.close();  // 닫을 때 한 번에 교체 (중간에 깨지지 않음)
  }).catch(e=>alert('분류 정보를 저장하지 못했습니다: '+e.message));
  return fsx.q;
}

function guess(stem,tempos,keys){
  const alias={};
  for(const k of keys)for(const n of [k.name,...(k.aliases||[])])if(n)alias[n]=k.name;
  let key='',title=stem;
  const names=Object.keys(alias);
  if(names.length){
    const alts=names.sort((a,b)=>b.length-a.length).map(reEsc).join('|');
    const m=new RegExp('^'+SEP+'*('+alts+')'+KEY_END).exec(stem)||new RegExp('(?:^|'+SEP+')('+alts+')'+KEY_END).exec(stem);
    if(m){key=alias[m[1]];const end=m.index+m[0].length;title=stem.slice(0,end-m[1].length)+' '+stem.slice(end)}
  }
  const low=stem.toLowerCase();let tempo='';
  for(const t of tempos)for(const w of t.keywords||[])
    if(w&&low.includes(w.toLowerCase())){tempo=tempo||t.id;title=title.replace(new RegExp(reEsc(w),'gi'),' ')}
  title=title.replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim()||stem;
  return {title,key,tempo};
}
const stemOf=rel=>{const n=rel.split('/').pop();const i=n.lastIndexOf('.');return i>0?n.slice(0,i):n};

async function walk(dir,prefix,out){
  for await(const [name,h] of dir.entries()){
    if(h.kind==='directory'){if(prefix===''&&(name===DIRS.out||name===DIRS.trash))continue;await walk(h,prefix+name+'/',out)}
    else{const i=name.lastIndexOf('.');if(i>=0&&EXTS.has(name.slice(i).toLowerCase()))out.set(prefix+name,h)}
  }
}
/* 이름이 바뀌거나 다른 폴더로 옮겨진 파일 찾기: 사라진 파일과 새 파일의 크기·확장자가 같으면 같은 악보로 봄 */
function renameDetect(files,sizes){
  const sc=fsx.db.scores,ext=r=>(r.match(/\.[^.\/]+$/)||[''])[0].toLowerCase();
  const gone=Object.keys(sc).filter(r=>!files.has(r)&&sc[r].size);
  const fresh=[...files.keys()].filter(r=>!sc[r]&&sizes.has(r));
  if(!gone.length||!fresh.length)return;
  const pairs=[];
  for(const n of fresh){
    const c=gone.filter(o=>sc[o].size===sizes.get(n)&&ext(o)===ext(n));
    if(c.length!==1)continue;
    if(fresh.filter(m=>sizes.get(m)===sizes.get(n)&&ext(m)===ext(n)).length!==1)continue;
    pairs.push([c[0],n]);
  }
  if(!pairs.length)return;
  const list=pairs.slice(0,10).map(([o,n])=>`· ${o}\n   → ${n}`).join('\n')+(pairs.length>10?`\n… 외 ${pairs.length-10}개`:'');
  if(!confirm(`이름이 바뀌었거나 다른 폴더로 옮겨진 것으로 보이는 악보 ${pairs.length}개를 찾았습니다.\n\n${list}\n\n기존 분류(코드·빠르기·카테고리·메모)와 콘티·바구니 연결을 새 파일로 이어 갈까요?\n(취소하면 새 악보로 따로 추가됩니다)`))return;
  for(const [o,n] of pairs)renameMove(o,n);
}
function renameMove(o,n){
  const sc=fsx.db.scores;sc[n]={...sc[o],missing:false};delete sc[o];
  const fix=g=>{if(g.file===o)g.file=n;if(g.files)g.files=g.files.map(f=>f===o?n:f)};
  for(const c of [...(fsx.db.contis||[]),...(fsx.db.contisTrash||[])]){for(const g of c.songs||[])fix(g);for(const sec of c.sections||[])for(const g of sec.songs||[])fix(g)}
  if(Array.isArray(fsx.db.basket))fsx.db.basket=fsx.db.basket.map(f=>f===o?n:f);
}
async function scanFs(){
  const files=new Map();await walk(fsx.root,'',files);
  fsx.files=files;
  for(const u of fsx.urls.values())URL.revokeObjectURL(u);fsx.urls.clear();
  const db=fsx.db,scores=db.scores,sizes=new Map();
  for(const [rel,h] of files){try{sizes.set(rel,(await h.getFile()).size)}catch(e){}}
  renameDetect(files,sizes);
  for(const rel of [...files.keys()].sort()){if(scores[rel]&&sizes.has(rel))scores[rel].size=sizes.get(rel);
    if(!scores[rel]){
      const g=guess(stemOf(rel),db.tempos,db.keys);
      const parts=rel.split('/').slice(0,-1);
      scores[rel]={title:g.title,key:g.key,tempo:g.tempo,tags:scanTags(rel,parts),note:'',reviewed:false,missing:false,size:sizes.get(rel)};
    }else scores[rel].missing=false;
  }
  for(const rel in scores)if(!files.has(rel))scores[rel].missing=true;
  await saveDb();
  return {total:files.size,missing:Object.values(scores).filter(s=>s.missing).length};
}

async function apiUpdate(ids,patch,addTags=[],removeTags=[]){
  const db=fsx.db,out={};
  if('title' in patch)out.title=String(patch.title).trim();
  if('key' in patch&&['',...db.keys.map(k=>k.name)].includes(String(patch.key).trim()))out.key=String(patch.key).trim();
  if('tempo' in patch&&['',...db.tempos.map(t=>t.id)].includes(patch.tempo))out.tempo=patch.tempo;
  if('tags' in patch)out.tags=[...new Set(patch.tags.map(t=>String(t).trim()).filter(Boolean))].sort();
  if('note' in patch)out.note=String(patch.note);
  if('reviewed' in patch)out.reviewed=!!patch.reviewed;
  if('excluded' in patch)out.excluded=!!patch.excluded;
  const add=addTags.map(t=>t.trim()).filter(Boolean);
  for(const id of ids){const s=db.scores[id];if(!s)continue;Object.assign(s,out);
    if(add.length||removeTags.length)s.tags=[...new Set([...s.tags,...add])].filter(t=>!removeTags.includes(t)).sort()}
  await saveDb();
}
async function apiTempos(items){
  const tempos=[],seen=new Set();
  for(const t of items){const label=String(t.label||'').trim();if(!label)continue;
    const id=t.id||'c'+Math.random().toString(16).slice(2,8);if(seen.has(id))continue;seen.add(id);
    tempos.push({id,label,keywords:(t.keywords||[]).map(k=>String(k).trim()).filter(Boolean)})}
  fsx.db.tempos=tempos;
  for(const s of Object.values(fsx.db.scores))if(!seen.has(s.tempo))s.tempo='';
  await saveDb();
}
async function apiKeys(items){
  const keys=[],rename={},used=new Set();
  for(const k of items){const name=String(k.name||'').trim();if(!name||used.has(name))continue;used.add(name);
    const old=k.old||name;if(!(old in rename))rename[old]=name;
    keys.push({name,aliases:(k.aliases||[]).map(a=>String(a).trim()).filter(a=>a&&a!==name)})}
  fsx.db.keys=keys;
  for(const s of Object.values(fsx.db.scores))s.key=rename[s.key]||'';
  await saveDb();
}
function exportCsv(){
  const labels=Object.fromEntries(fsx.db.tempos.map(t=>[t.id,t.label]));
  const q=v=>/[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':v;
  const rows=[['파일','제목','코드','빠르기','카테고리','메모'],...Object.entries(fsx.db.scores).sort(([a],[b])=>a<b?-1:1)
    .map(([rel,s])=>[rel,s.title,s.key,labels[s.tempo]||'',s.tags.join(','),s.note])];
  const blob=new Blob(['﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='scorebox.csv';a.click();
}

/* ---------- 파일 → 브라우저 URL (보이는 카드만 읽음) ---------- */
async function getUrl(id){
  if(fsx.urls.has(id))return fsx.urls.get(id);
  const h=fsx.files.get(id);if(!h)return '';
  const u=URL.createObjectURL(await h.getFile());fsx.urls.set(id,u);return u;
}
const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){
  io.unobserve(e.target);const im=e.target;getUrl(im.dataset.id).then(u=>{im.src=u})}},{rootMargin:'400px'});

/* ---------- 화면 ---------- */
async function load(){
  const db=fsx.db;
  const all=Object.entries(db.scores).map(([id,v])=>({id,...v})).filter(i=>!i.missing);
  st.exCount=all.filter(i=>i.excluded).length;
  st.items=all.filter(i=>!!i.excluded===st.showEx);
  st.tempoList=db.tempos;st.tempos=Object.fromEntries(db.tempos.map(t=>[t.id,t.label]));
  st.keyList=db.keys;st.keys=db.keys.map(k=>k.name);
  $('#dir').textContent='악보 폴더: '+fsx.root.name;
  for(const id of ['#e-key','#bk']){const el=$(id);el.innerHTML='<option value="">(미지정)</option>'+st.keys.map(k=>`<option>${esc(k)}</option>`).join('')}
  for(const id of ['#e-tempo','#bt']){const el=$(id);el.innerHTML='<option value="">(미지정)</option>'+Object.entries(st.tempos).map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('')}
  render();
}
function chips(el,entries,set,label){
  el.innerHTML=entries.map(([v,n])=>`<span class="chip ${set.has(v)?'on':''}" data-v="${esc(v)}">${esc(label?label(v):v)}<small>${n}</small></span>`).join('')||'<small style="color:var(--mut)">없음</small>';
  el.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{const v=c.dataset.v;if(set.has(v))set.delete(v);else{set.clear();set.add(v)}render()});
}
const count=(arr)=>{const m={};arr.forEach(v=>m[v]=(m[v]||0)+1);return m};
function matches(i,ign){
  const q=$('#q').value.trim().toLowerCase();
  if(q&&!(i.title+' '+i.id+' '+i.tags.join(' ')+' '+(i.note||'')).toLowerCase().includes(q))return false;
  if(ign!=='key'&&st.key.size&&!st.key.has(i.key||'(미지정)'))return false;
  if(ign!=='tempo'&&st.tempo.size&&!st.tempo.has(i.tempo||'-'))return false;
  if(ign!=='tag'&&st.tag.size&&![...st.tag].every(t=>i.tags.includes(t)))return false;
  if(st.unrev&&i.reviewed)return false;
  return true;
}
function render(){
  const kc=count(st.items.filter(i=>matches(i,'key')).map(i=>i.key||'(미지정)'));
  const order=[...st.keys,'(미지정)'];
  chips($('#f-key'),order.filter(k=>kc[k]||st.key.has(k)).map(k=>[k,kc[k]||0]),st.key);
  const tc=count(st.items.filter(i=>matches(i,'tempo')).map(i=>i.tempo||'-'));
  chips($('#f-tempo'),[...Object.keys(st.tempos),'-'].filter(k=>tc[k]||st.tempo.has(k)).map(k=>[k,tc[k]||0]),st.tempo,v=>st.tempos[v]||'(미지정)');
  const tg=count(st.items.filter(i=>matches(i,'tag')).flatMap(i=>i.tags));
  const tagOrder=tagList().map(t=>t.name);
  chips($('#f-tag'),[...tagOrder.filter(t=>tg[t]||st.tag.has(t)).map(t=>[t,tg[t]||0]),...Object.keys(tg).filter(t=>!tagOrder.includes(t)).map(t=>[t,tg[t]])],st.tag);
  $('#taglist').innerHTML=tagList().map(t=>`<option value="${esc(t.name)}">`).join('');
  $('#showall').classList.toggle('cur',!st.key.size&&!st.tempo.size&&!st.tag.size&&!st.unrev&&!st.showEx&&!$('#q').value.trim());
  const unrev=st.items.filter(i=>!i.reviewed).length;
  $('#n-ex').textContent=st.exCount;$('#f-ex').classList.toggle('on',st.showEx);
  $('#bex').style.display=st.showEx?'none':'';$('#brestore').style.display=st.showEx?'':'none';
  $('#n-unrev').textContent=unrev;$('#f-unrev').classList.toggle('on',st.unrev);

  const s=$('#sort').value,ko=(a,b)=>String(a).localeCompare(String(b),'ko',{numeric:true});
  st.list=st.items.filter(i=>matches(i)).sort((a,b)=>{
    if(s==='key')return (st.keys.indexOf(a.key)+99)%99-(st.keys.indexOf(b.key)+99)%99||ko(a.title,b.title);
    if(s==='tempo')return ko(a.tempo,b.tempo)||ko(a.title,b.title);
    return ko(a.title,b.title)});
  $('#cnt').textContent=`${st.list.length} / ${st.items.length}곡`;
  $('#allrev').style.display=(st.unrev&&st.list.length&&!st.showEx)?'':'none';$('#allrev').textContent=`✓ 보이는 ${st.list.length}곡 모두 확인 완료`;
  const RU=recentUse();
  $('#grid').innerHTML=st.list.map((i,n)=>`<div class="card ${st.sel.has(i.id)?'sel':''} ${inBasket(i.id)?'inb':''}" data-n="${n}">
    <input type="checkbox" class="ck" ${st.sel.has(i.id)?'checked':''}>
    ${i.reviewed?'':'<span class="rv">확인 필요</span>'}
    <div class="thumb">${isPdf(i.id)?'📄':`<img data-id="${esc(i.id)}" ${fsx.urls.has(i.id)?`src="${fsx.urls.get(i.id)}"`:''}>`}</div>
    <button class="bkb ${inBasket(i.id)?'on':''}" title="${inBasket(i.id)?'콘티 바구니에서 빼기':'콘티 바구니에 담기'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-2 10H5L3 9z"/><path d="M8 9l4-5 4 5"/></svg></button>
    <div class="meta"><div class="t" title="${esc(i.title)}">${esc(i.title)}</div>
    ${i.key?`<span class="badge k">${esc(i.key)}</span>`:''}${i.tempo?`<span class="badge ${esc(i.tempo)}">${esc(st.tempos[i.tempo]||'')}</span>`:''}
    ${i.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}${recentBadge(RU,i.title)}</div></div>`).join('');
  document.querySelectorAll('#grid img[data-id]:not([src])').forEach(im=>io.observe(im));
  document.querySelectorAll('.card').forEach(c=>{
    const it=st.list[c.dataset.n];
    c.onclick=e=>{if(e.target.closest('.bkb')){e.stopPropagation();basketSet([it.id],!inBasket(it.id));return}if(e.target.classList.contains('ck')){st.sel.has(it.id)?st.sel.delete(it.id):st.sel.add(it.id);render()}else openDlg(it)};
  });
  $('#bulk').style.display=st.sel.size?'flex':'none';$('#bn').textContent=st.sel.size+'곡 선택';
}
async function openDlg(it){
  st.cur=it;
  $('#view').innerHTML='';
  $('#e-title').value=it.title;$('#e-key').value=it.key;$('#e-tempo').value=it.tempo;
  $('#e-tags').value=it.tags.join(', ');renderTagChips();$('#e-note').value=it.note;$('#e-file').textContent=it.id;$('#e-ex').textContent=st.showEx?'↩ 목록으로 복원':'목록에서 제외';basketBtn();
  if(!$('#dlg').open)$('#dlg').showModal();
  const u=await getUrl(it.id);if(st.cur!==it)return;
  $('#view').innerHTML=isPdf(it.id)?`<iframe src="${u}"></iframe>`:`<img src="${u}">`;
}
async function save(next){
  const it=st.cur;
  await apiUpdate([it.id],{title:$('#e-title').value,key:$('#e-key').value,tempo:$('#e-tempo').value,
    tags:splitTags($('#e-tags').value),note:$('#e-note').value,reviewed:true});
  const idx=st.list.indexOf(it);await load();
  const nx=next&&st.list[Math.min(idx,st.list.length-1)];
  if(nx)openDlg(nx);else $('#dlg').close();
}
async function afterRemove(idx){
  await load();const nx=st.list[Math.min(idx,st.list.length-1)];
  if(nx)openDlg(nx);else $('#dlg').close();
}
$('#e-ex').onclick=async()=>{
  const it=st.cur,idx=st.list.indexOf(it);
  if(!confirm(st.showEx?'이 곡을 목록으로 복원합니다.':'이 곡을 앱 목록에서 제외합니다.\n파일은 그대로 남아 있고, 왼쪽 "제외한 곡"에서 복원할 수 있습니다.'))return;
  await apiUpdate([it.id],{excluded:!st.showEx});await afterRemove(idx);
};
$('#e-del').onclick=async()=>{
  const it=st.cur,idx=st.list.indexOf(it);
  if(!confirm(`이 파일을 삭제합니다.\n\n· ${it.id}\n\n파일은 악보 폴더의 '_삭제된악보' 폴더로 옮겨집니다. 되살리려면 그 폴더에서 원래 위치로 옮긴 뒤 '폴더 다시 스캔'을 누르세요.\n(파일은 두고 목록에서만 숨기려면 "목록에서 제외"를 사용하세요)`))return;
  try{await removeFile(it.id);delete fsx.db.scores[it.id];await saveDb()}
  catch(e){alert('삭제하지 못했습니다: '+e.message);return}
  await afterRemove(idx);
};
$('#e-save').onclick=()=>save(false);$('#e-next').onclick=()=>save(true);$('#e-close').onclick=()=>$('#dlg').close();
$('#q').oninput=render;$('#sort').onchange=render;
$('#f-unrev').onclick=()=>{st.unrev=!st.unrev;render()};
$('#bclear').onclick=()=>{st.sel.clear();render()};
$('#bapply').onclick=async()=>{
  const patch={reviewed:true};if($('#bk').value)patch.key=$('#bk').value;if($('#bt').value)patch.tempo=$('#bt').value;
  await apiUpdate([...st.sel],patch,splitTags($('#bat').value));
  st.sel.clear();$('#bat').value='';load();
};
$('#rescan').onclick=async()=>{const r=await scanFs();await load();alert(`스캔 완료: 파일 ${r.total}개 (사라진 파일 ${r.missing}개)`)};
$('#csv').onclick=exportCsv;
$('#f-ex').onclick=()=>{st.showEx=!st.showEx;st.sel.clear();load()};
$('#selall').onclick=()=>{const ids=st.list.map(i=>i.id),all=ids.length&&ids.every(id=>st.sel.has(id));
  ids.forEach(id=>all?st.sel.delete(id):st.sel.add(id));render()};
$('#showall').onclick=()=>{
  st.key.clear();st.tempo.clear();st.tag.clear();st.unrev=false;$('#q').value='';
  if(st.showEx){st.showEx=false;st.sel.clear();load()}else render();
};
$('#bsel').onclick=()=>$('#selall').onclick();
$('#bnote').onclick=async()=>{
  const ids=[...st.sel],withNote=ids.filter(id=>(fsx.db.scores[id]||{}).note);
  if(!withNote.length){alert('선택한 곡 중 메모가 있는 곡이 없습니다.');return}
  if(!confirm(`선택한 ${ids.length}곡 중 메모가 있는 ${withNote.length}곡의 메모를 모두 지웁니다.\n(메모만 지워지고 코드·빠르기·카테고리는 그대로입니다)`))return;
  await apiUpdate(ids,{note:''});st.sel.clear();load();
};
$('#brev').onclick=async()=>{await apiUpdate([...st.sel],{reviewed:true});st.sel.clear();load()};
$('#bunrev').onclick=async()=>{await apiUpdate([...st.sel],{reviewed:false});st.sel.clear();load()};
$('#allrev').onclick=async()=>{
  const ids=st.list.map(i=>i.id);
  if(!confirm(`지금 보이는 ${ids.length}곡을 모두 "확인 완료"로 표시합니다.\n(코드·빠르기·태그는 그대로이고, "확인 필요" 표시만 사라집니다)`))return;
  await apiUpdate(ids,{reviewed:true});st.sel.clear();load();
};
$('#bex').onclick=async()=>{
  if(!confirm(`${st.sel.size}곡을 앱 목록에서 제외합니다.\n파일은 그대로 남아 있고, 왼쪽 "제외한 곡"에서 복원할 수 있습니다.`))return;
  await apiUpdate([...st.sel],{excluded:true});st.sel.clear();load();
};
$('#brestore').onclick=async()=>{await apiUpdate([...st.sel],{excluded:false});st.sel.clear();load()};
async function removeFile(rel){  // 실제로 지우지 않고 악보 폴더의 _삭제된악보 폴더로 옮김 (같은 하위 폴더 구조 유지)
  const parts=rel.split('/');let dir=fsx.root;
  try{
    for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p);
    const name=parts[parts.length-1],file=await (await dir.getFileHandle(name)).getFile();
    let td=await fsx.root.getDirectoryHandle(DIRS.trash,{create:true});
    for(const p of parts.slice(0,-1))td=await td.getDirectoryHandle(p,{create:true});
    const dot=name.lastIndexOf('.'),base=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
    let nm=name;for(let i=2;;i++){try{await td.getFileHandle(nm);nm=`${base} (${i})${ext}`}catch(e){if(e.name==='NotFoundError')break;throw e}}
    const w=await (await td.getFileHandle(nm,{create:true})).createWritable();await w.write(file);await w.close();
    await dir.removeEntry(name);
  }catch(e){if(e.name!=='NotFoundError')throw e}
  fsx.files.delete(rel);const u=fsx.urls.get(rel);if(u){URL.revokeObjectURL(u);fsx.urls.delete(rel)}
}
$('#bdel').onclick=async()=>{
  const ids=[...st.sel],names=ids.slice(0,5).map(i=>'· '+i).join('\n')+(ids.length>5?`\n… 외 ${ids.length-5}개`:'');
  if(!confirm(`선택한 ${ids.length}곡의 파일을 삭제합니다.\n\n${names}\n\n파일은 악보 폴더의 '_삭제된악보' 폴더로 옮겨집니다 (되살리려면 원래 위치로 옮긴 뒤 폴더 다시 스캔).\n(파일은 두고 목록에서만 숨기려면 "목록에서 제외"를 사용하세요)`))return;
  const failed=[];
  for(const id of ids){try{await removeFile(id);delete fsx.db.scores[id]}catch(e){failed.push(id+' ('+e.message+')')}}
  await saveDb();st.sel.clear();await load();
  alert(failed.length?`${ids.length-failed.length}곡을 삭제했고 ${failed.length}곡은 실패했습니다:\n${failed.slice(0,5).join('\n')}`:`${ids.length}곡을 삭제했습니다.`);
};
function crow(t){
  const r=document.createElement('div');r.style.cssText='display:flex;gap:6px';r.dataset.id=t.id||'';
  r.innerHTML=`<input class="cl" placeholder="이름 (예: 빠른)" size="10" value="${esc(t.label||'')}"><input class="ck2" placeholder="자동 인식 키워드 (쉼표)" style="flex:1" value="${esc((t.keywords||[]).join(', '))}"><button title="삭제">🗑</button>`;
  r.querySelector('button').onclick=()=>r.remove();return r;
}
$('#cfg').onclick=()=>{$('#crows').replaceChildren(...st.tempoList.map(crow));$('#cdlg').showModal()};
$('#cadd').onclick=()=>$('#crows').append(crow({}));
$('#cclose').onclick=()=>$('#cdlg').close();
$('#csave').onclick=async()=>{
  const tempos=[...$('#crows').children].map(r=>({id:r.dataset.id,label:r.querySelector('.cl').value,keywords:splitTags(r.querySelector('.ck2').value)}));
  const gone=st.tempoList.filter(t=>!tempos.some(n=>n.id===t.id)&&st.items.some(i=>i.tempo===t.id));
  if(gone.length&&!confirm(`삭제되는 빠르기(${gone.map(t=>t.label).join(', ')})를 쓰는 곡은 "미지정"이 됩니다. 계속할까요?`))return;
  await apiTempos(tempos);st.tempo.clear();$('#cdlg').close();load();
};
function krow(k){
  const r=document.createElement('div');r.style.cssText='display:flex;gap:6px';r.dataset.old=k.name||'';
  r.innerHTML=`<input class="kn" placeholder="코드 (예: G)" size="7" value="${esc(k.name||'')}"><input class="ka" placeholder="별칭 (쉼표)" style="flex:1" value="${esc((k.aliases||[]).join(', '))}"><button class="up">▲</button><button class="dn">▼</button><button class="rm" title="삭제">🗑</button>`;
  r.querySelector('.up').onclick=()=>r.previousElementSibling&&r.previousElementSibling.before(r);
  r.querySelector('.dn').onclick=()=>r.nextElementSibling&&r.nextElementSibling.after(r);
  r.querySelector('.rm').onclick=()=>r.remove();return r;
}
$('#kcfg').onclick=()=>{$('#krows').replaceChildren(...st.keyList.map(krow));$('#kdlg').showModal()};
$('#kadd').onclick=()=>{const r=krow({});$('#krows').append(r);r.querySelector('.kn').focus()};
$('#kclose').onclick=()=>$('#kdlg').close();
$('#ksave').onclick=async()=>{
  const keys=[...$('#krows').children].map(r=>({old:r.dataset.old,name:r.querySelector('.kn').value,aliases:splitTags(r.querySelector('.ka').value)}));
  const gone=st.keyList.filter(k=>!keys.some(n=>n.old===k.name)&&st.items.some(i=>i.key===k.name));
  if(gone.length&&!confirm(`삭제되는 코드(${gone.map(k=>k.name).join(', ')})를 쓰는 곡은 "미지정"이 됩니다. 계속할까요?`))return;
  await apiKeys(keys);st.key.clear();$('#kdlg').close();load();
};
(function(){
  const z=$('#zoom');
  try{const v=localStorage.getItem('scorebox.zoom');if(v)z.value=v}catch(e){}
  const apply=()=>{document.documentElement.style.setProperty('--cw',z.value+'px');try{localStorage.setItem('scorebox.zoom',z.value)}catch(e){}};
  z.oninput=apply;apply();
})();

/* ---------- 시작: 폴더 선택 / 권한 ---------- */
const msg=t=>{const e=$('#smsg');e.textContent=t||'';e.style.color='var(--warn)'};
async function openRoot(handle){
  msg('폴더를 읽는 중…');
  fsx.root=handle;
  try{await loadDb();const r=await scanFs();await load();$('#start').style.display='none';if(typeof backupAuto==='function')backupAuto()}
  catch(e){if(e instanceof SyntaxError){msg('scorebox_data.json 파일이 손상되어 읽을 수 없습니다.\n백업 폴더를 지정해 두었다면 아래 버튼으로 최근 백업을 복원할 수 있습니다.');$('#btn-restore').style.display=''}else msg('폴더를 열지 못했습니다: '+e.message)}
}
async function pick(){
  try{
    const h=await showDirectoryPicker({id:'scorebox',mode:'readwrite'});
    await kvSet('dir',h);await openRoot(h);
  }catch(e){if(e.name!=='AbortError')msg('폴더를 선택할 수 없습니다: '+e.message+' (Chrome 이 막는 폴더라면 그 안의 하위 폴더를 선택해 보세요)')}
}
async function resume(h){
  try{
    if(await h.requestPermission({mode:'readwrite'})==='granted'){try{const b=await kvGet('backupDir');if(b&&await b.queryPermission({mode:'readwrite'})!=='granted')await b.requestPermission({mode:'readwrite'})}catch(e){}await openRoot(h)}
    else msg('폴더 접근을 허용해야 사용할 수 있습니다.');
  }catch(e){msg('폴더를 열 수 없습니다: '+e.message)}
}
$('#chdir').onclick=()=>{$('#start').style.display='flex'};
$('#btn-pick').onclick=pick;
window.ScoreBox={open:openRoot};  // (테스트용)
(async()=>{
  if(!window.showDirectoryPicker){
    $('#btn-pick').style.display='none';
    msg('이 브라우저는 폴더 접근을 지원하지 않습니다. Chrome 또는 Edge 에서 이 파일을 열어 주세요.');return;
  }
  const h=await kvGet('dir');
  if(!h)return;
  $('#btn-resume').textContent=`📂 “${h.name}” 폴더 열기`;$('#btn-resume').style.display='';
  $('#btn-resume').onclick=()=>resume(h);
  msg('Chrome 권한 창이 뜨면 “이 사이트를 방문할 때마다 허용”을 선택하세요. 다음부터는 폴더가 자동으로 열립니다.');$('#smsg').style.color='var(--mut)';$('#btn-resume').focus();
  try{if(await h.queryPermission({mode:'readwrite'})==='granted')await openRoot(h)}catch(e){}
})();
// 타이틀 로고 = 브라우저 탭 아이콘과 같은 그림
document.querySelectorAll('img.logo').forEach(i=>i.src=document.querySelector('link[rel=icon]').href)
