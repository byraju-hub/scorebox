/* Raju's ScoreBox — 카테고리(Tag) 설정 · 중복 곡 정리 */
/* ================= 주제/태그 카테고리 ================= */
function tagList(){
  const db=fsx.db;
  if(!db.tagList){
    const c={};for(const s of Object.values(db.scores))for(const t of s.tags||[])c[t]=(c[t]||0)+1;
    db.tagList=Object.entries(c).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([name])=>({name,keywords:[]}));
  }
  const have=new Set(db.tagList.map(t=>t.name));  // 곡에 쓰이는데 목록에 없는 태그는 자동으로 추가
  for(const s of Object.values(db.scores))for(const t of s.tags||[])if(!have.has(t)){db.tagList.push({name:t,keywords:[]});have.add(t)}
  return db.tagList;
}
function scanTags(rel,parts){
  const stem=stemOf(rel).toLowerCase(),set=new Set(parts);
  for(const t of tagList())for(const k of t.keywords||[])if(k&&stem.includes(k.toLowerCase()))set.add(t.name);
  return [...set].sort();
}
function renderTagChips(){
  const box=$('#e-tagchips'),cur=new Set(splitTags($('#e-tags').value).map(t=>t.trim()).filter(Boolean));
  box.innerHTML=tagList().map(t=>`<span class="chip ${cur.has(t.name)?'on':''}" data-t="${esc(t.name)}">${esc(t.name)}</span>`).join('')||'<small style="color:var(--mut)">⚙ 카테고리(Tag) 설정에서 추가하세요</small>';
  box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{
    const set=new Set(splitTags($('#e-tags').value).map(x=>x.trim()).filter(Boolean));
    set.has(c.dataset.t)?set.delete(c.dataset.t):set.add(c.dataset.t);$('#e-tags').value=[...set].join(', ');renderTagChips();
  });
}
$('#e-tags').addEventListener('input',renderTagChips);
const tagUse=()=>{const u={};for(const s of Object.values(fsx.db.scores))if(!s.missing)for(const t of s.tags||[])u[t]=(u[t]||0)+1;return u};
function trow(t,n){
  const r=document.createElement('div');r.style.cssText='display:flex;gap:6px;align-items:center';r.dataset.old=t.name||'';
  r.innerHTML=`<input class="tn" placeholder="카테고리 이름 (예: 성령)" size="12" value="${esc(t.name||'')}"><input class="tk" placeholder="자동 인식 키워드 (쉼표)" style="flex:1" value="${esc((t.keywords||[]).join(', '))}"><small style="color:var(--mut);white-space:nowrap">${n}곡</small><button class="up">▲</button><button class="dn">▼</button><button class="rm" title="삭제">🗑</button>`;
  r.querySelector('.up').onclick=()=>r.previousElementSibling&&r.previousElementSibling.before(r);
  r.querySelector('.dn').onclick=()=>r.nextElementSibling&&r.nextElementSibling.after(r);
  r.querySelector('.rm').onclick=()=>r.remove();return r;
}
$('#tcfg').onclick=()=>{const u=tagUse();$('#trows').replaceChildren(...tagList().map(t=>trow(t,u[t.name]||0)));$('#tdlg').showModal()};
$('#tadd').onclick=()=>{const r=trow({name:'',keywords:[]},0);$('#trows').append(r);r.querySelector('.tn').focus()};
$('#tclose').onclick=()=>$('#tdlg').close();
async function apiTags(rows){
  const list=[],map={},seen=new Set();
  for(const r of rows){
    if(!r.name)continue;if(r.old&&!(r.old in map))map[r.old]=r.name;
    if(!seen.has(r.name)){seen.add(r.name);list.push({name:r.name,keywords:r.keywords})}
  }
  fsx.db.tagList=list;
  for(const s of Object.values(fsx.db.scores))s.tags=[...new Set((s.tags||[]).map(t=>map[t]).filter(Boolean))].sort();
  await saveDb();
}
$('#tsave').onclick=async()=>{
  const rows=[...$('#trows').children].map(r=>({old:r.dataset.old,name:r.querySelector('.tn').value.trim(),keywords:splitTags(r.querySelector('.tk').value).map(k=>k.trim()).filter(Boolean)}));
  const keep=new Set(rows.filter(r=>r.old&&r.name).map(r=>r.old)),u=tagUse();
  const gone=tagList().filter(t=>!keep.has(t.name)&&u[t.name]>0);
  if(gone.length&&!confirm(`삭제되는 카테고리(${gone.map(t=>`${t.name} ${u[t.name]}곡`).join(', ')})는 곡에서도 빠집니다. 계속할까요?`))return;
  await apiTags(rows);st.tag.clear();$('#tdlg').close();load();
};

/* ================= 중복 곡 정리 ================= */
const D={mode:'exclude',showIgn:false,io:null};
const dupIgnore=()=>fsx.db.dupIgnore=fsx.db.dupIgnore||[];
function dupGroups(){
  const m=new Map();
  for(const it of libItems()){const n=normT(it.title);if(!n)continue;const k=n+'|'+(it.key||'');if(!m.has(k))m.set(k,[]);m.get(k).push(it)}
  const ign=new Set(dupIgnore());
  return [...m.entries()].filter(([,a])=>a.length>1)
    .map(([k,a])=>({k,title:a[0].title,key:a[0].key,items:a.sort((x,y)=>x.id.localeCompare(y.id)),ignored:ign.has(k)}))
    .filter(g=>D.showIgn||!g.ignored).sort((a,b)=>a.title.localeCompare(b.title,'ko',{numeric:true}));
}
function updateDupBadge(){const n=dupGroups().filter(g=>!g.ignored).length;$('#dupbtn').innerHTML=`<span class="ti">🧩</span>중복 곡 정리${n?`<b class="bdg">${n}묶음</b>`:''}`}
const _load=load;load=async function(){const r=await _load.apply(this,arguments);updateDupBadge();return r};
function lightbox(id){
  getUrl(id).then(u=>{if(!u)return;const d=document.createElement('div');d.id='lightbox';d.innerHTML=`<img src="${u}">`;d.onclick=()=>d.remove();document.body.append(d)});
}
async function fillMeta(it,el){
  try{
    const fh=fsx.files.get(it.id),f=await fh.getFile(),kb=Math.round(f.size/1024),ext=it.id.split('.').pop().toUpperCase();
    let dim='';if(IMG_OK.test(it.id)){const im=await loadImg(it.id);if(im)dim=`${im.w}×${im.h} · `}
    el.textContent=`${dim}${kb.toLocaleString()}KB · ${ext}`;
  }catch(e){el.textContent='정보를 읽을 수 없음'}
}
async function dupResolve(keepId,removeIds){
  const sc=fsx.db.scores,keep=sc[keepId],failed=[];
  for(const r of removeIds){
    const s=sc[r];if(!s)continue;
    if(D.mode==='delete'){try{await removeFile(r)}catch(e){failed.push(r+' ('+e.message+')');continue}}
    if(!keep.tempo&&s.tempo)keep.tempo=s.tempo;
    keep.tags=[...new Set([...(keep.tags||[]),...(s.tags||[])])].sort();
    if(!keep.note&&s.note)keep.note=s.note;
    keep.reviewed=keep.reviewed||s.reviewed;
    for(const c of contis())for(const g of c.songs||[]){if(g.file===r)g.file=keepId;if(g.files)g.files=[...new Set(g.files.map(f=>f===r?keepId:f))]}
    if(D.mode==='delete')delete sc[r];else s.excluded=true;
  }
  await saveDb();st.sel.clear();await load();renderDup();
  if(failed.length)alert(`삭제하지 못한 파일이 있습니다:\n${failed.slice(0,5).join('\n')}`);
}
function dupConfirm(keepId,removeIds){
  const names=removeIds.map(i=>'· '+i).join('\n');
  return confirm(D.mode==='delete'
    ?`다음 파일을 삭제합니다 (악보 폴더의 '_삭제된악보' 폴더로 옮겨지며, 원래 위치로 옮기면 되살릴 수 있습니다).\n\n${names}\n\n남기는 파일: ${keepId}`
    :`다음 곡을 앱 목록에서 제외합니다 (파일은 그대로 남고, 왼쪽 "제외한 곡"에서 복원할 수 있습니다).\n\n${names}\n\n남기는 곡: ${keepId}`);
}
function renderDup(){
  const gs=dupGroups(),box=$('#dupbody');
  $('#duptitle').textContent=`중복 곡 정리 — ${gs.filter(g=>!g.ignored).length}개 묶음`;
  box.innerHTML='';D.io&&D.io.disconnect();
  D.io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){D.io.unobserve(e.target);const c=e.target,id=c.dataset.id;
    const im=c.querySelector('img');if(im)getUrl(id).then(u=>{im.src=u});fillMeta({id},c.querySelector('.dm'))}},{root:box,rootMargin:'300px'});
  if(!gs.length){box.innerHTML='<p style="color:var(--mut)">정리할 중복 곡이 없습니다. (제목과 코드가 같은 곡이 없거나, 모두 "중복 아님"으로 표시했습니다)</p>';return}
  for(const g of gs){
    const card=document.createElement('div');card.className='dg'+(g.ignored?' ign':'');
    card.innerHTML=`<div class="dh"><b>${esc(g.title)}</b><span class="badge k">${esc(g.key||'코드 미지정')}</span><small>${g.items.length}개${g.ignored?' · 중복 아님으로 표시됨':''}</small><span style="flex:1"></span><button class="ign">${g.ignored?'다시 중복으로 보기':'중복 아님'}</button></div><div class="di"></div>`;
    card.querySelector('.ign').onclick=async()=>{const a=dupIgnore(),i=a.indexOf(g.k);i>=0?a.splice(i,1):a.push(g.k);await saveDb();updateDupBadge();renderDup()};
    const row=card.querySelector('.di');
    for(const it of g.items){
      const c=document.createElement('div');c.className='dc';c.dataset.id=it.id;
      c.innerHTML=`<div class="dth">${IMG_OK.test(it.id)?'<img>':'📄'}</div><div class="dn">${esc(it.id)}</div><small class="dm">…</small>
        <div class="da"><button class="keep p">✓ 이것만 남기기</button><button class="one">이것만 ${D.mode==='delete'?'삭제':'제외'}</button></div>`;
      c.querySelector('.dth').onclick=()=>lightbox(it.id);
      c.querySelector('.keep').onclick=async()=>{const rm=g.items.filter(x=>x!==it).map(x=>x.id);if(dupConfirm(it.id,rm))await dupResolve(it.id,rm)};
      c.querySelector('.one').onclick=async()=>{const keepIt=g.items.find(x=>x!==it);if(dupConfirm(keepIt.id,[it.id]))await dupResolve(keepIt.id,[it.id])};
      row.append(c);D.io.observe(c);
    }
    box.append(card);
  }
}
$('#dupbtn').onclick=()=>{$('#dupdlg').classList.add('on');renderDup()};
$('#dupclose').onclick=()=>{$('#dupdlg').classList.remove('on');load()};
$('#dupmode').onchange=e=>{D.mode=e.target.value;renderDup()};
$('#dupign').onchange=e=>{D.showIgn=e.target.checked;renderDup()};
