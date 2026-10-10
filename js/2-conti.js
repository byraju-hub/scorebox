/* Raju's ScoreBox — 콘티: 목록 · 편집 · 곡 추가 · 인쇄 레이아웃 · 자르기 · JPG */
/* ================= 콘티 (목록 · 편집 · 인쇄 · JPG) ================= */
const C={sel:null,q:'',type:'',year:'',timer:null,page:1,per:15,jump:false};
const DOW='일월화수목금토';
const normT=s=>String(s||'').replace(/[0-9\s\-_().,·~!?:;+'"“”‘’]/g,'');
const contis=()=>fsx.db.contis=fsx.db.contis||[];
const dowOf=d=>DOW[new Date(d+'T00:00:00').getDay()];
const fmtDate=d=>{const [y,m,dd]=d.split('-');return `${+m}/${+dd}(${dowOf(d)})`};
const todayStr=()=>{const t=new Date();return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`};
const songsOf=c=>c.songs||[];
const PREF_DEF={paper:'A3',mode:'2up',order:'booklet',margin:6,minScale:85,dpi:200,frame:true,numbers:true};
const prefs=()=>{const o=fsx.db.printPrefs;if(o&&!o.v){o.paper=PREF_DEF.paper;o.mode=PREF_DEF.mode;o.margin=PREF_DEF.margin;o.v=2}return fsx.db.printPrefs=Object.assign({},PREF_DEF,{v:2},o||{})};
function saveSoon(){clearTimeout(C.timer);C.timer=setTimeout(()=>saveDb(),400)}

/* --- 가져오기: 구간(sections) 형식 → 평평한 songs 배열 --- */
function flattenConti(e){
  if(e.songs)return e;
  const songs=[],notes=[];
  for(const s of e.sections||[]){
    if(s.name==='말씀'){notes.push((s.extra||[]).join(' · '));continue}
    for(const g of s.songs)songs.push({title:g.title,canon:g.canon,key:g.key||'',refrain:!!g.refrain,note:g.note||'',special:!!g.special,
      sec:s.name,files:g.files||[],file:g.file||'',print:!g.special});
  }
  return {id:e.id,date:e.date,type:e.type,service:e.service,subtitle:e.subtitle||'',theme:e.theme||'',songs,notes:notes.filter(Boolean).join(' / ')};
}
function importContis(list){
  const have=new Set(contis().map(c=>c.id));let n=0;
  for(const e of list){const c=flattenConti(e);if(!have.has(c.id)){contis().push(c);have.add(c.id);n++}}
  return n;
}

/* --- 악보함 색인 / 사용 통계 --- */
function libItems(){return Object.entries(fsx.db.scores).filter(([,s])=>!s.missing&&!s.excluded).map(([id,s])=>({id,...s}))}
function usageMap(){
  const m=new Map();
  for(const c of contis())for(const g of songsOf(c)){
    if(g.special)continue;const k=g.canon||normT(g.title);const u=m.get(k)||{n:0,last:''};u.n++;if(c.date>u.last)u.last=c.date;m.set(k,u);
  }
  return m;
}
/* 최근에 쓴 곡 / 앞으로 쓸 곡 표시용: 제목(숫자·공백 제외) 기준, 최근 28일 안의 사용과 오늘 이후 예정 */
const RECENT_DAYS=28;
function recentUse(){
  const m=new Map(),t=todayStr();if(!fsx.db||!Array.isArray(fsx.db.contis))return m;
  for(const c of fsx.db.contis)for(const g of songsOf(c)){
    if(g.special)continue;const k=g.canon||normT(g.title),u=m.get(k)||{past:'',next:''};
    if(c.date<=t){if(c.date>u.past)u.past=c.date}else if(!u.next||c.date<u.next)u.next=c.date;m.set(k,u)}
  return m;
}
function recentBadge(m,title){
  const u=m.get(normT(title));if(!u)return '';
  if(u.next){const [,mm,dd]=u.next.split('-');return `<span class="badge ru up" title="${esc(u.next)} 콘티에 들어 있습니다">📅 ${+mm}/${+dd} 예정</span>`}
  if(u.past){const d=daysAgo(u.past);if(d<=RECENT_DAYS)return `<span class="badge ru" title="마지막 사용: ${esc(u.past)}">🕘 ${d===0?'오늘':d+'일 전'}</span>`}
  return '';
}
function daysAgo(d){return Math.round((new Date(todayStr()+'T00:00:00')-new Date(d+'T00:00:00'))/86400000)}
function usageText(u){return u?`${u.n}회 · 마지막 ${u.last}${daysAgo(u.last)>=0?` (${daysAgo(u.last)}일 전)`:''}`:'사용 기록 없음'}
function candidates(g){
  const sc=fsx.db.scores,ok=id=>sc[id]&&!sc[id].missing&&!sc[id].excluded;
  const set=new Set((g.files||[]).filter(ok));
  const k=g.canon||normT(g.title);
  for(const it of libItems())if(normT(it.title)===k)set.add(it.id);
  const ko=st.keys||[];
  return [...set].sort((a,b)=>(ko.indexOf(sc[a].key)+99)%99-(ko.indexOf(sc[b].key)+99)%99||a.localeCompare(b));
}
const fileLabel=id=>{const s=fsx.db.scores[id];return `${s&&s.key?s.key+' · ':''}${id.split('/').pop()}`};
function fileSelect(g,onchange){
  const cs=candidates(g),sel=document.createElement('select');
  sel.innerHTML='<option value="">(악보 없음)</option>'+cs.map(id=>`<option value="${esc(id)}">${esc(fileLabel(id))}</option>`).join('');
  if(g.file&&!cs.includes(g.file))sel.insertAdjacentHTML('beforeend',`<option value="${esc(g.file)}">${esc(fileLabel(g.file))}</option>`);
  sel.value=g.file||'';sel.onchange=()=>{g.file=sel.value;onchange&&onchange()};return sel;
}

/* --- 탭 전환 --- */
function setMode(m){document.body.classList.toggle('conti',m==='conti');$('#tab-lib').classList.toggle('p',m!=='conti');$('#tab-conti').classList.toggle('p',m==='conti');if(m==='conti')renderContiList()}
$('#tab-lib').onclick=()=>setMode('lib');$('#tab-conti').onclick=()=>setMode('conti');

/* --- 콘티 목록 --- */
function contiMatches(c){
  if(C.type&&c.type!==C.type)return false;
  if(C.year&&!c.date.startsWith(C.year))return false;
  const q=C.q.trim().toLowerCase();if(!q)return true;
  return (c.date+' '+fmtDate(c.date)+' '+c.service+' '+c.subtitle+' '+c.theme+' '+songsOf(c).map(g=>g.title).join(' ')).toLowerCase().includes(q);
}
const TRASH_DAYS=30;
const trash=()=>fsx.db.contisTrash=Array.isArray(fsx.db.contisTrash)?fsx.db.contisTrash:[];
function trashPurge(){const t=trash(),lim=Date.now()-TRASH_DAYS*86400000,keep=t.filter(c=>new Date(c.deletedAt).getTime()>lim);if(keep.length!==t.length){fsx.db.contisTrash=keep;saveSoon()}}
function trashRender(){
  trashPurge();const t=trash().slice().sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  $('#trres').innerHTML=t.map(c=>{const left=Math.max(0,Math.ceil((new Date(c.deletedAt).getTime()+TRASH_DAYS*86400000-Date.now())/86400000));
    return `<div class="tri" data-id="${esc(c.id)}"><span class="t"><b>${esc(c.date)} (${dowOf(c.date)})</b> ${esc(c.service)}<small>${songsOf(c).length}곡 · 삭제 ${esc(c.deletedAt.slice(0,10))} · ${left}일 후 자동 삭제</small></span><button class="p" data-a="re">복원</button><button data-a="del">완전 삭제</button></div>`}).join('')||'<p style="color:var(--mut)">휴지통이 비어 있습니다.</p>';
  $('#trres').querySelectorAll('.tri').forEach(row=>row.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const id=row.dataset.id,c=trash().find(x=>x.id===id);if(!c)return;
    if(b.dataset.a==='re'){const {deletedAt,...rest}=c;fsx.db.contisTrash=trash().filter(x=>x!==c);contis().push(rest);C.sel=rest;C.jump=true;saveSoon();$('#trdlg').close();renderContiList();renderContiDetail()}
    else if(confirm('이 콘티를 완전히 삭제할까요? (복원할 수 없습니다)')){fsx.db.contisTrash=trash().filter(x=>x!==c);saveSoon();trashRender();renderContiList()}}));
}
$('#ctrash').onclick=()=>{trashRender();$('#trdlg').showModal()};
$('#trclose').onclick=()=>$('#trdlg').close();
$('#trempty').onclick=()=>{if(!trash().length||!confirm('휴지통의 콘티를 모두 완전히 삭제할까요? (복원할 수 없습니다)'))return;fsx.db.contisTrash=[];saveSoon();trashRender();renderContiList()};
function renderContiList(){
  trashPurge();$('#ctn').textContent=trash().length?`(${trash().length})`:'';
  if(typeof basketRender==='function')basketRender();
  const all=contis().slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  const years=[...new Set(all.map(c=>c.date.slice(0,4)))];
  const ys=$('#cyear');if(ys.options.length!==years.length+1){const v=ys.value;ys.innerHTML='<option value="">모든 연도</option>'+years.map(y=>`<option>${y}</option>`).join('');ys.value=v}
  const list=all.filter(contiMatches);
  $('#ccnt').textContent=`${list.length} / ${all.length}개`;
  const pages=Math.max(1,Math.ceil(list.length/C.per));
  if(C.jump&&C.sel){const ix=list.findIndex(c=>c.id===C.sel.id);if(ix>=0)C.page=Math.floor(ix/C.per)+1}C.jump=false;
  C.page=Math.min(Math.max(1,C.page),pages);
  $('#clist').innerHTML=list.slice((C.page-1)*C.per,C.page*C.per).map(c=>`<div class="ci ${C.sel&&C.sel.id===c.id?'on':''}" data-id="${esc(c.id)}"><b>${esc(c.date)} (${dowOf(c.date)})</b> ${esc(c.service)}${c.subtitle?' · '+esc(c.subtitle):''}<br><small>${songsOf(c).length}곡${c.theme?' · '+esc(c.theme):''}</small></div>`).join('')||'<p style="padding:12px;color:var(--mut)">콘티가 없습니다.</p>';
  $('#clist').querySelectorAll('.ci').forEach(el=>el.onclick=()=>{C.sel=contis().find(c=>c.id===el.dataset.id);renderContiList();renderContiDetail()});
  const pg=$('#cpager');pg.style.display=pages>1?'flex':'none';
  if(pages>1){
    const a=Math.max(1,Math.min(C.page-2,pages-4)),b=Math.min(pages,a+4);let h=`<button data-p="1" ${C.page===1?'disabled':''} title="처음">«</button><button data-p="${C.page-1}" ${C.page===1?'disabled':''} title="이전">‹</button>`;
    for(let i=a;i<=b;i++)h+=`<button data-p="${i}" ${i===C.page?'class="p"':''}>${i}</button>`;
    h+=`<button data-p="${C.page+1}" ${C.page===pages?'disabled':''} title="다음">›</button><button data-p="${pages}" ${C.page===pages?'disabled':''} title="마지막">»</button><select id="cpsel" title="페이지 선택">${Array.from({length:pages},(_,i)=>`<option value="${i+1}" ${i+1===C.page?'selected':''}>${i+1} / ${pages}</option>`).join('')}</select>`;
    pg.innerHTML=h;
    pg.querySelectorAll('button[data-p]').forEach(bt=>bt.onclick=()=>{C.page=+bt.dataset.p;renderContiList();$('#clist').scrollTop=0});
    $('#cpsel').onchange=e=>{C.page=+e.target.value;renderContiList();$('#clist').scrollTop=0};
  }
}
$('#cq').oninput=e=>{C.q=e.target.value;C.page=1;renderContiList()};
$('#ctype').onchange=e=>{C.type=e.target.value;C.page=1;renderContiList()};
$('#cyear').onchange=e=>{C.year=e.target.value;C.page=1;renderContiList()};
$('#cimp').onclick=()=>$('#cimpf').click();
$('#cimpf').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const j=JSON.parse(await f.text());const n=importContis(j.contis||[]);await saveDb();renderContiList();alert(`콘티 ${n}개를 가져왔습니다. (이미 있던 콘티는 건너뜀)`)}
  catch(err){alert('콘티 파일을 읽을 수 없습니다: '+err.message)}
};
$('#cnew').onclick=()=>{
  const c={id:'n'+Date.now(),date:todayStr(),type:'금요기도회',service:'금요기도회 찬양',subtitle:'',theme:'',songs:[],notes:''};
  contis().push(c);C.sel=c;C.jump=true;saveSoon();renderContiList();renderContiDetail();
};

/* --- 콘티 상세/편집 --- */
const songKey=g=>g.key||((fsx.db&&fsx.db.scores&&fsx.db.scores[g.file])||{}).key||((g.file||'').split('/').pop().match(/^([A-G][#b]?m?)[-_ ]/)||[])[1]||'';
function contiText(c){
  const [y,m,d]=c.date.split('-');let out=`${+m}/${+d} ${c.service}입니다.\n`,sec=null,i=0;
  for(const g of songsOf(c)){
    if(g.sec&&g.sec!==sec&&/#\d/.test(g.sec)){out+=`${i?'\n':''}[${g.sec.replace(/^\s*/, '')}]\n`;sec=g.sec;i=0}
    i++;out+=`${i}. ${g.title}${(k=>k?` (${k}${g.refrain?', 후렴':''})`:g.refrain?' (후렴)':'')(songKey(g))}\n`;
  }
  return out.trim()+'\n';
}
function renderContiDetail(){
  const c=C.sel,box=$('#cd');
  if(!c){box.innerHTML='<p style="color:var(--mut)">콘티를 선택하세요.</p>';return}
  const up=usageMap();
  box.innerHTML=`<div class="fr"><label>날짜 <input type="date" id="d-date" value="${esc(c.date)}"></label>
    <label>종류 <select id="d-type">${['주일','금요기도회','은혜로기도회','특별'].map(t=>`<option ${t===c.type?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>예배 이름 <input id="d-service" value="${esc(c.service)}" size="20"></label>
    <label>부제 <input id="d-sub" value="${esc(c.subtitle)}" size="14"></label>
    <label>주제 <input id="d-theme" value="${esc(c.theme)}" size="12"></label></div>
    <div class="fr"><button id="d-add" class="p">＋ 곡 추가</button><button id="d-print" class="p">🖨 인쇄 · JPG 만들기</button>
      <button id="d-copy">📋 텍스트 복사</button><button id="d-dup">복제</button><button id="d-del" style="color:#e03131">삭제</button>
      <span id="d-saved" style="color:var(--mut);font-size:12px"></span></div>
    ${c.notes?`<div style="color:var(--mut);font-size:12px;margin-bottom:6px">말씀: ${esc(c.notes)}</div>`:''}
    <div id="d-songs"></div>`;
  const bind=(id,k,fn)=>$(id).onchange=e=>{c[k]=e.target.value;if(fn)fn();touch()};
  bind('#d-date','date',()=>{c.id=c.id.startsWith('n')?c.id:c.id});bind('#d-type','type');bind('#d-service','service');bind('#d-sub','subtitle');bind('#d-theme','theme');
  const touch=()=>{saveSoon();$('#d-saved').textContent='저장됨';renderContiList()};
  const sb=$('#d-songs');sb.innerHTML='';
  songsOf(c).forEach((g,i)=>{
    const r=document.createElement('div');r.className='sr';
    r.innerHTML=`<span class="n">${i+1}</span><input class="t" value="${esc(g.title)}"><span class="fs"></span>
      <label style="font-size:12px;white-space:nowrap"><input type="checkbox" class="rf" ${g.refrain?'checked':''}> 후렴</label>
      <small>${esc(usageText(up.get(g.canon||normT(g.title))))}</small>
      <button class="u">▲</button><button class="dn">▼</button><button class="x" style="color:#e03131">✕</button>`;
    r.querySelector('.fs').append(fileSelect(g,touch));
    r.querySelector('.t').onchange=e=>{g.title=e.target.value;touch()};
    r.querySelector('.rf').onchange=e=>{g.refrain=e.target.checked;touch()};
    r.querySelector('.u').onclick=()=>{if(i>0){[c.songs[i-1],c.songs[i]]=[c.songs[i],c.songs[i-1]];touch();renderContiDetail()}};
    r.querySelector('.dn').onclick=()=>{if(i<c.songs.length-1){[c.songs[i+1],c.songs[i]]=[c.songs[i],c.songs[i+1]];touch();renderContiDetail()}};
    r.querySelector('.x').onclick=()=>{c.songs.splice(i,1);touch();renderContiDetail()};
    sb.append(r);
  });
  if(!songsOf(c).length)sb.innerHTML='<p style="color:var(--mut)">곡이 없습니다. <b>＋ 곡 추가</b>로 악보함에서 고르세요.</p>';
  $('#d-add').onclick=openPicker;$('#d-print').onclick=()=>openPrint(c);
  $('#d-copy').onclick=async()=>{try{await navigator.clipboard.writeText(contiText(c));alert('콘티 텍스트를 복사했습니다.')}catch(e){prompt('복사하세요',contiText(c))}};
  $('#d-dup').onclick=()=>{const n=JSON.parse(JSON.stringify(c));n.id='n'+Date.now();n.date=todayStr();contis().push(n);C.sel=n;C.jump=true;saveSoon();renderContiList();renderContiDetail()};
  $('#d-del').onclick=()=>{if(!confirm(`${c.date} ${c.service} 콘티를 삭제할까요?\n(휴지통에 30일 동안 보관되며 복원할 수 있습니다)`))return;trash().push(Object.assign({},c,{deletedAt:new Date().toISOString()}));fsx.db.contis=contis().filter(x=>x!==c);C.sel=null;saveSoon();renderContiList();renderContiDetail()};
}

/* --- 곡 추가 (악보함에서) --- */
function openPicker(){if(!$('#pickdlg').open)$('#pickdlg').showModal();$('#pkq').value='';renderPick();$('#pkq').focus()}
$('#pkclose').onclick=()=>$('#pickdlg').close();$('#pkq').oninput=renderPick;$('#pksort').onchange=renderPick;
function renderPick(){
  const q=normT($('#pkq').value).toLowerCase(),up=usageMap(),groups=new Map();
  for(const it of libItems()){const k=normT(it.title);if(q&&!k.toLowerCase().includes(q)&&!it.tags.join('').toLowerCase().includes(q))continue;
    if(!groups.has(k))groups.set(k,{canon:k,title:it.title,items:[]});groups.get(k).items.push(it)}
  let arr=[...groups.values()];
  const s=$('#pksort').value,u=g=>up.get(g.canon);
  if(s==='old')arr.sort((a,b)=>(u(a)?u(a).last:'0').localeCompare(u(b)?u(b).last:'0')||a.title.localeCompare(b.title,'ko'));
  else if(s==='most')arr.sort((a,b)=>(u(b)?u(b).n:0)-(u(a)?u(a).n:0)||a.title.localeCompare(b.title,'ko'));
  else arr.sort((a,b)=>a.title.localeCompare(b.title,'ko',{numeric:true}));
  const inbk=g=>g.items.some(x=>inBasket(x.id));arr=[...arr.filter(inbk),...arr.filter(g=>!inbk(g))];
  $('#pickres').innerHTML=arr.slice(0,200).map((g,i)=>`<div class="pk ${inbk(g)?'inbk':''}" data-i="${i}"><span class="t">${inbk(g)?'🧺 ':''}${esc(g.title)}</span><small>${esc(usageText(u(g)))}</small>${g.items.sort((a,b)=>(st.keys.indexOf(a.key)+99)%99-(st.keys.indexOf(b.key)+99)%99).map(it=>`<button data-id="${esc(it.id)}" class="${inBasket(it.id)?'inbk':''}">＋ ${esc(it.key||'?')}</button>`).join('')}</div>`).join('')||'<p style="color:var(--mut)">검색 결과가 없습니다.</p>';
  $('#pickres').querySelectorAll('.pk').forEach(row=>{const g=arr[row.dataset.i];row.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const it=g.items.find(x=>x.id===b.dataset.id);
    C.sel.songs.push({title:g.title,canon:g.canon,key:it.key||'',refrain:false,note:'',special:false,sec:'',files:g.items.map(x=>x.id),file:it.id,print:true});
    saveSoon();renderContiList();renderContiDetail();b.textContent='✓ 추가됨'});});
}

/* ================= 인쇄 레이아웃 엔진 ================= */
const IMG_OK=/\.(jpe?g|png|gif|webp|bmp)$/i;
const imgCache=new Map();
async function loadImg(id){
  if(imgCache.has(id)&&fsx.urls.has(id))return imgCache.get(id);
  const url=await getUrl(id);if(!url)return null;
  const img=new Image();img.src=url;try{await img.decode()}catch(e){return null}
  const r={img,w:img.naturalWidth,h:img.naturalHeight,url};imgCache.set(id,r);return r;
}
function paperDims(p){const [s,l]={B4:[257,364],A3:[297,420],A4:[210,297]}[p.paper];return p.mode==='1up'?{W:s,H:l}:{W:l,H:s}}
async function buildLayout(c,p){
  const {W,H}=paperDims(p),k=Math.max(W,H)/420,m=+p.margin,hdr=9*k,pad=2*k,gap=2*k,labH=6*k,per=p.mode==='1up'?1:p.mode==='3up'?3:2;
  const fx=m,fy=m+hdr,fw=W-2*m,fh=H-fy-m,warns=[],items=[];
  for(const g of songsOf(c)){
    if(g.print===false)continue;
    if(!g.file){warns.push(`'${g.title}': 악보 파일이 선택되지 않았습니다`);continue}
    if(!IMG_OK.test(g.file)){warns.push(`'${g.title}': PDF 악보는 인쇄 레이아웃에 넣을 수 없습니다 (이미지로 변환 필요)`);continue}
    const im=await loadImg(g.file);if(!im){warns.push(`'${g.title}': 악보를 열 수 없습니다 (${g.file})`);continue}
    const cr=g.crop||{top:0,bottom:1},sy=im.h*cr.top,sh=im.h*(cr.bottom-cr.top),cl=cr.left||0,crr=cr.right==null?1:cr.right;
    let sxx=im.w*cl,sww=im.w*(crr-cl),shr=1;const zs=(cr.scale||100)/100;
    if(zs>1){const vis=sww/zs;sxx+=(sww-vis)/2;sww=vis}else shr=zs;
    items.push({g,im,sy,sh,sx:sxx,sw:sww,shr,label:g.label||'',place:g.place||'auto',no:items.length+1});
  }
  const pw=(fw/per)-2*pad,ph=fh-2*pad,minS=p.minScale/100;
  const hOf=it=>pw*it.shr*it.sh/it.sw+(it.label?labH:0);
  const panels=[],tots=[];let cur=-1;
  const put=(ix,it)=>{while(panels.length<=ix){panels.push([]);tots.push(0)}const h=hOf(it);tots[ix]=panels[ix].length?tots[ix]+gap+h:h;panels[ix].push(it);cur=ix};
  for(const it of items){
    const n=/^[1-9]\d?$/.test(String(it.place))?+it.place:0;
    if(n){put(n-1,it);continue}
    const h=hOf(it);
    if(cur>=0&&it.place!=='new'&&(it.place==='same'||ph/(tots[cur]+gap+h)>=minS)){put(cur,it);continue}
    let ix=cur+1;while(panels[ix]&&panels[ix].length)ix++;put(ix,it);
  }
  const group=p.mode==='1up'?2:p.mode==='3up'?6:4;while(panels.length%group)panels.push([]);
  const pages=[];
  const ensure=i=>pages[i]||(pages[i]={W,H,front:i%2===0,header:'',panels:[],frame:{x:fx,y:fy,w:fw,h:fh},per,k,pad});
  panels.forEach((its,idx)=>{
    let page,side;
    if(p.mode==='1up'){page=idx;side=0}
    else if(p.mode==='3up'){page=Math.floor(idx/3);side=idx%3}
    else{const sheet=Math.floor(idx/4),q=idx%4;const map=p.order==='seq'?[[0,0],[0,1],[1,0],[1,1]]:[[0,0],[1,0],[1,1],[0,1]];page=sheet*2+map[q][0];side=map[q][1]}
    const pg=ensure(page);
    const px=fx+side*(fw/per)+pad,py=fy+pad;
    const total=its.reduce((a,it,i)=>a+hOf(it)+(i?gap:0),0),sc=its.length?Math.min(1,ph/total):1;
    if(its.length&&sc<0.75)warns.push(`'${its[0].g.title}' 칸이 ${Math.round(sc*100)}%로 작게 축소됩니다`);
    let y=py;const out=[];
    for(const it of its){
      const w=pw*sc*it.shr,h=(pw*it.shr*it.sh/it.sw)*sc,x=px+(pw-w)/2;
      if(it.label){out.push({kind:'label',text:it.label,x:px,y,w:pw,h:labH*sc});y+=labH*sc}
      out.push({kind:'img',im:it.im,sx:it.sx,sy:it.sy,sw:it.sw,sh:it.sh,x,y,w,h});
      if(p.numbers&&!it.g.noNum)out.push({kind:'num',text:`(${it.no})`,x:x+0.6*k,y:y+0.6*k});
      y+=h+gap*sc;
    }
    pg.panels.push({side,items:out});
  });
  for(let i=0;i<(pages.length+(pages.length%2));i++)ensure(i);
  const used=pages.map(pg=>pg.panels.some(pn=>pn.items.length));
  const res=pages.filter((pg,i)=>used[i]);
  res.forEach(pg=>pg.header=pg.front?(c.header||''):'');
  res.forEach((pg,i)=>pg.no=i+1);
  return {pages:res,warns,count:items.length};
}
/* HTML 렌더 (미리보기 / 인쇄) */
function renderPageHTML(pg,p){
  const d=document.createElement('div');d.className='pg';d.style.cssText=`width:${pg.W}mm;height:${pg.H}mm`;
  const A=(css,html='')=>{const e=document.createElement('div');e.className='abs';e.style.cssText=css;e.innerHTML=html;d.append(e);return e};
  if(pg.header)A(`left:${pg.frame.x}mm;top:${pg.frame.y-9*pg.k+0.5}mm;font-weight:700;font-size:${5.2*pg.k}mm;line-height:${6*pg.k}mm;white-space:nowrap`,esc(pg.header));
  if(p.frame){A(`left:${pg.frame.x}mm;top:${pg.frame.y}mm;width:${pg.frame.w}mm;height:${pg.frame.h}mm;border:0.3mm solid #000;box-sizing:border-box`);
    for(let i=1;i<pg.per;i++)A(`left:${pg.frame.x+pg.frame.w*i/pg.per}mm;top:${pg.frame.y}mm;height:${pg.frame.h}mm;border-left:0.3mm solid #000`)}
  for(const pn of pg.panels)for(const it of pn.items){
    if(it.kind==='num')A(`left:${it.x}mm;top:${it.y}mm;padding:0 ${0.8*pg.k}mm;background:#fffd;color:#000;font-weight:700;font-size:${4.6*pg.k}mm;line-height:${6*pg.k}mm;white-space:nowrap`,esc(it.text));
    else if(it.kind==='label')A(`left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;height:${it.h}mm;text-align:center;color:#e03131;font-weight:700;font-size:${4.4*pg.k}mm;line-height:${it.h}mm`,esc(it.text));
    else{const e=document.createElement('div');e.className='cr';e.style.cssText=`left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;height:${it.h}mm`;
      const im=document.createElement('img');im.src=it.im.url;
      im.style.cssText=`width:${it.im.w/it.sw*it.w}mm;height:${it.im.h/it.sh*it.h}mm;left:${-it.sx/it.sw*it.w}mm;top:${-it.sy/it.sh*it.h}mm`;e.append(im);d.append(e)}
  }
  return d;
}
/* JPG (canvas) */
function renderPageCanvas(pg,p,dpi){
  const px=dpi/25.4,cv=document.createElement('canvas');cv.width=Math.round(pg.W*px);cv.height=Math.round(pg.H*px);
  const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.imageSmoothingQuality='high';
  const FONT='"Gowun Dodum","Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif';
  if(pg.header){x.fillStyle='#000';x.font=`700 ${5.2*pg.k*px}px ${FONT}`;x.textBaseline='alphabetic';x.fillText(pg.header,pg.frame.x*px,(pg.frame.y-2.2*pg.k)*px)}
  if(p.frame){x.strokeStyle='#000';x.lineWidth=0.3*px;x.strokeRect(pg.frame.x*px,pg.frame.y*px,pg.frame.w*px,pg.frame.h*px);
    for(let i=1;i<pg.per;i++){const lx=(pg.frame.x+pg.frame.w*i/pg.per)*px;x.beginPath();x.moveTo(lx,pg.frame.y*px);x.lineTo(lx,(pg.frame.y+pg.frame.h)*px);x.stroke()}}
  for(const pn of pg.panels)for(const it of pn.items){
    if(it.kind==='num'){x.font=`700 ${4.6*pg.k*px}px ${FONT}`;x.textAlign='left';x.textBaseline='middle';const tw=x.measureText(it.text).width,pd=0.8*pg.k*px,bh=6*pg.k*px;x.fillStyle='rgba(255,255,255,.87)';x.fillRect(it.x*px,it.y*px,tw+2*pd,bh);x.fillStyle='#000';x.fillText(it.text,it.x*px+pd,it.y*px+bh/2)}
    else if(it.kind==='label'){x.fillStyle='#e03131';x.font=`700 ${4.4*pg.k*px}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillText(it.text,(it.x+it.w/2)*px,(it.y+it.h/2)*px);x.textAlign='left'}
    else x.drawImage(it.im.img,it.sx,it.sy,it.sw,it.sh,it.x*px,it.y*px,it.w*px,it.h*px);
  }
  return cv;
}
const blobOf=(cv,q=0.92)=>new Promise(r=>cv.toBlob(r,'image/jpeg',q));

/* --- 인쇄 대화상자 --- */
const P={c:null,lay:null,timer:0,busy:false};
function defaultHeader(c){const [y,m,d]=c.date.split('-');return `${y}년 ${+m}월 ${+d}일 ${c.service}${c.subtitle?' - '+c.subtitle:''}`}
function openPrint(c){
  P.c=c;const p=prefs();
  for(const g of songsOf(c)){if(g.refrain&&!g.crop&&!g.autoRef){g.crop={top:0.6,bottom:1};g.label=g.label||`[${g.title} (후렴)]`;g.autoRef=true}if(g.print===undefined)g.print=!g.special}
  if(!c.headerCustom)c.header=defaultHeader(c);
  $('#p-paper').value=p.paper;$('#p-mode').value=p.mode;$('#p-order').value=p.order;$('#p-header').value=c.header;
  $('#p-margin').value=p.margin;$('#p-minscale').value=p.minScale;$('#p-dpi').value=p.dpi;$('#p-frame').checked=p.frame;$('#p-numbers').checked=p.numbers;
  $('#ptitle').textContent=`인쇄 · JPG — ${c.date} ${c.service}`;
  $('#pdlg').classList.add('on');renderPSongs();refreshPreview();
}
$('#pclose').onclick=()=>{$('#pdlg').classList.remove('on');saveSoon();renderContiDetail()};
for(const id of ['paper','mode','order','margin','minscale','dpi','frame','numbers','header'])$('#p-'+id).addEventListener('input',()=>{
  const p=prefs();p.paper=$('#p-paper').value;p.mode=$('#p-mode').value;p.order=$('#p-order').value;p.margin=+$('#p-margin').value||0;
  p.minScale=+$('#p-minscale').value;p.dpi=+$('#p-dpi').value;p.frame=$('#p-frame').checked;p.numbers=$('#p-numbers').checked;P.c.header=$('#p-header').value;if(id==='header')P.c.headerCustom=true;
  if(p.paper==='A4'&&!P.touchedMargin&&id==='paper'){p.margin=6;$('#p-margin').value=6}
  if(id==='margin')P.touchedMargin=true;saveSoon();refreshPreview();
});
$('#pall').onclick=()=>{songsOf(P.c).forEach(g=>g.print=true);renderPSongs();refreshPreview()};
$('#pnone').onclick=()=>{songsOf(P.c).forEach(g=>g.print=false);renderPSongs();refreshPreview()};
function renderPSongs(){
  const box=$('#psongs');box.innerHTML='';
  songsOf(P.c).forEach((g,i)=>{
    const r=document.createElement('div');r.className='pr';
    const crop=g.crop?`✂ ${Math.round(g.crop.top*100)}–${Math.round(g.crop.bottom*100)}%`+((g.crop.left||g.crop.right!=null&&g.crop.right<1)?` · ${Math.round((g.crop.left||0)*100)}–${Math.round((g.crop.right==null?1:g.crop.right)*100)}%`:'')+(g.crop.scale&&g.crop.scale!==100?` · ${g.crop.scale}%`:''):'✂ 자르기';
    r.innerHTML=`<label class="t"><input type="checkbox" ${g.print!==false?'checked':''}> ${i+1}. ${esc(g.title)}${g.refrain?' <small>(후렴)</small>':''}</label>
      <span class="fs"></span><button class="cr">${crop}</button><input class="lb" placeholder="빨간 라벨 예: [입례]" value="${esc(g.label||'')}">
      <select class="pl"><option value="auto">칸: 자동</option><option value="new">새 칸에서 시작</option><option value="same">위 곡과 같은 칸</option>${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n}번 칸에 넣기</option>`).join('')}</select>`;
    r.querySelector('.fs').append(fileSelect(g,()=>{refreshPreview()}));
    r.querySelector('input[type=checkbox]').onchange=e=>{g.print=e.target.checked;refreshPreview()};
    r.querySelector('.lb').oninput=e=>{g.label=e.target.value;refreshPreview()};
    const pl=r.querySelector('.pl');pl.value=g.place||'auto';pl.onchange=()=>{g.place=pl.value;refreshPreview()};
    r.querySelector('.cr').onclick=()=>openCrop(g);
    box.append(r);
  });
}
function refreshPreview(){clearTimeout(P.timer);P.timer=setTimeout(async()=>{
  if(P.busy){refreshPreview();return}P.busy=true;
  try{
    const p=prefs();const lay=P.lay=await buildLayout(P.c,p);const box=$('#pprev');box.innerHTML='';
    $('#pwarn').innerHTML=lay.warns.map(w=>'⚠ '+esc(w)).join('<br>');
    if(!lay.pages.length){box.innerHTML='<p style="color:var(--mut)">인쇄할 악보가 없습니다. 곡을 선택하세요.</p>';return}
    const avail=box.clientWidth-40,k=Math.min(1.2,avail/(lay.pages[0].W*3.7795));
    lay.pages.forEach(pg=>{
      const lab=document.createElement('div');lab.className='pglab';
      lab.textContent=`${pg.no}면 (${pg.front?'앞':'뒤'}) · ${p.paper} ${pg.W>pg.H?'가로':'세로'}`;box.append(lab);
      const w=document.createElement('div');w.className='pgwrap';w.style.zoom=k;w.append(renderPageHTML(pg,p));box.append(w);
    });
  }catch(e){$('#pwarn').textContent='미리보기 오류: '+e.message}finally{P.busy=false}
},120)}

/* --- 자르기 --- */
let CR=null;
let CRIM=null;
async function openCrop(g){
  if(!g.file||!IMG_OK.test(g.file)){alert('이미지 악보만 자를 수 있습니다.');return}
  const im=await loadImg(g.file);if(!im)return;CR=g;CRIM=im;$('#crtitle').textContent=g.title;$('#crimg').src=im.url;
  const c=g.crop||{top:0,bottom:1};$('#crtop').value=Math.round(c.top*100);$('#crbot').value=Math.round(c.bottom*100);$('#crlef').value=Math.round((c.left||0)*100);$('#crrig').value=Math.round((c.right==null?1:c.right)*100);$('#crsc').value=c.scale||100;crUpd();
  $('#crdlg').showModal();
}
function crPrev(){
  const box=$('#crprev');if(!CR||!CRIM){return}
  const p=prefs(),{W,H}=paperDims(p),k=Math.max(W,H)/420,m=+p.margin,per=p.mode==='1up'?1:p.mode==='3up'?3:2;
  const pw=(W-2*m)/per-4*k,ph=H-2*m-9*k-4*k,PX=250;
  const t=+$('#crtop').value/100,b=+$('#crbot').value/100,l=+$('#crlef').value/100,rr=+$('#crrig').value/100,zs=+$('#crsc').value/100;
  const im=CRIM;let sx=im.w*l,sw=im.w*(rr-l),sy=im.h*t,sh=im.h*(b-t),shr=1;
  if(zs>1){const vis=sw/zs;sx+=(sw-vis)/2;sw=vis}else shr=zs;
  let dw=pw*shr,dh=pw*shr*sh/sw;const f=Math.min(1,ph/dh);dw*=f;dh*=f;
  const S=PX/pw;box.style.width=PX+'px';box.style.height=(ph*S)+'px';box.innerHTML='';
  const e=document.createElement('div');e.className='cr';e.style.cssText=`left:${(pw-dw)/2*S}px;top:0;width:${dw*S}px;height:${dh*S}px`;
  const g=document.createElement('img');g.src=im.url;g.style.cssText=`width:${im.w/sw*dw*S}px;height:${im.h/sh*dh*S}px;left:${-sx/sw*dw*S}px;top:${-sy/sh*dh*S}px`;e.append(g);box.append(e);
  $('#crinfo').innerHTML=`칸 너비의 <b>${Math.round(dw/pw*100)}%</b> · 칸 높이의 <b>${Math.round(dh/ph*100)}%</b> 차지`+(f<1?'<br>칸 높이를 넘어 자동으로 줄어든 크기입니다.':'')+`<br>(${p.paper} · ${p.mode==='1up'?'1칸':p.mode==='3up'?'3칸':'2칸'} 기준, 다른 곡이 함께 들어가면 더 작아질 수 있어요)`;
}
function crUpd(){
  let t=+$('#crtop').value,b=+$('#crbot').value;if(b-t<5){if(document.activeElement===$('#crtop'))t=b-5;else b=t+5;$('#crtop').value=t;$('#crbot').value=b}
  $('#crsh1').style.height=t+'%';$('#crsh2').style.height=(100-b)+'%';$('#crln1').style.top=t+'%';$('#crln2').style.top=b+'%';
  $('#crtv').textContent=t+'%';$('#crbv').textContent=b+'%';
  let l=+$('#crlef').value,rr=+$('#crrig').value;if(rr-l<5){if(document.activeElement===$('#crlef'))l=rr-5;else rr=l+5;$('#crlef').value=l;$('#crrig').value=rr}
  $('#crsh3').style.width=l+'%';$('#crsh4').style.width=(100-rr)+'%';$('#crln3').style.left=l+'%';$('#crln4').style.left=rr+'%';
  $('#crscv').textContent=$('#crsc').value+'%';
  $('#crlv').textContent=l+'%';$('#crrv').textContent=rr+'%';
  crPrev();
}
$('#crtop').oninput=crUpd;$('#crbot').oninput=crUpd;$('#crlef').oninput=crUpd;$('#crrig').oninput=crUpd;$('#crsc').oninput=crUpd;
$('#crok').onclick=()=>{const t=+$('#crtop').value/100,b=+$('#crbot').value/100,l=+$('#crlef').value/100,rr=+$('#crrig').value/100,sc=+$('#crsc').value;CR.crop=(t===0&&b===1&&l===0&&rr===1&&sc===100)?null:{top:t,bottom:b,left:l,right:rr,scale:sc};$('#crdlg').close();renderPSongs();refreshPreview()};
$('#crreset').onclick=()=>{CR.crop=null;$('#crdlg').close();renderPSongs();refreshPreview()};
$('#crcancel').onclick=()=>$('#crdlg').close();

/* --- 인쇄 / JPG --- */
$('#pprint').onclick=async()=>{
  const p=prefs(),lay=P.lay||await buildLayout(P.c,p);if(!lay.pages.length){alert('인쇄할 악보가 없습니다.');return}
  const {W,H}=lay.pages[0];
  let sty=document.getElementById('pagecss');if(!sty){sty=document.createElement('style');sty.id='pagecss';document.head.append(sty)}
  sty.textContent=`@page{size:${W}mm ${H}mm;margin:0}`;
  const root=$('#printroot');root.innerHTML='';lay.pages.forEach(pg=>root.append(renderPageHTML(pg,p)));
  await Promise.all([...root.querySelectorAll('img')].map(i=>i.decode().catch(()=>{})));
  window.addEventListener('afterprint',()=>{root.innerHTML=''},{once:true});window.print();
};
const jpgBase=()=>{const d=P.c.date.replace(/-/g,'').slice(2),same=contis().filter(c=>c.date===P.c.date);return same.length>1?d+'abcdefghijklmnopqrstuvwxyz'[Math.max(0,same.indexOf(P.c))]:d};
async function exportJpgs(){
  const p=prefs(),lay=P.lay||await buildLayout(P.c,p);if(!lay.pages.length){alert('내보낼 악보가 없습니다.');return null}
  try{await document.fonts.load('700 20px "Gowun Dodum"','가A')}catch(e){}
  const out=[];let sheet=0;
  for(const pg of lay.pages){if(pg.front)sheet++;const n=Math.max(sheet-1,0)*2+(pg.front?1:2);
    const b=await blobOf(renderPageCanvas(pg,p,p.dpi*297/Math.max(pg.W,pg.H)));out.push({name:`${jpgBase()}-${n}.jpg`,blob:b})}
  return out;
}
$('#pjpg').onclick=async()=>{
  const files=await exportJpgs();if(!files)return;
  try{
    const dir=await fsx.root.getDirectoryHandle(DIRS.out,{create:true});
    for(const f of files){const h=await dir.getFileHandle(f.name,{create:true});const w=await h.createWritable();await w.write(f.blob);await w.close()}
    alert(`JPG ${files.length}장을 악보 폴더의 '콘티출력' 폴더에 저장했습니다.\n\n${files.map(f=>f.name).join('\n')}`);
  }catch(e){alert('폴더에 저장하지 못했습니다: '+e.message+'')}
};
window.ScoreBoxConti={importContis,buildLayout,renderPageCanvas,prefs,contiText,flattenConti};
