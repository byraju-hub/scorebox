/* Raju's ScoreBox — 콘티 통계 · 찬송가/CCM 분류 */
/* ================= 콘티 통계 ================= */
const ST={top:20,never:false,never_n:30,tbl:{}};
const STAT_SKIP=new Set(['입례','영접송','축복송','영접송입례']);
const fmtN=n=>n.toLocaleString();
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function periodRange(v){
  const t=todayStr(),y=+t.slice(0,4);
  if(v==='all')return ['0000-00-00','9999-12-31'];
  if(v==='year')return [`${y}-01-01`,'9999-12-31'];
  if(v==='lastyear')return [`${y-1}-01-01`,`${y-1}-12-31`];
  const d=new Date(t+'T00:00:00');d.setMonth(d.getMonth()-(+v));
  return [`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,'9999-12-31'];
}
function statData(){
  const [from,to]=periodRange($('#st-period').value),type=$('#st-type').value,skip=$('#st-skip').checked;
  const cs=contis().filter(c=>c.date>=from&&c.date<=to&&(!type||c.type===type));
  const sc=fsx.db.scores,tmap=Object.fromEntries(fsx.db.tempos.map(t=>[t.id,t.label])),uses=[];
  for(const c of cs)for(const g of songsOf(c)){
    if(g.special)continue;if(skip&&STAT_SKIP.has(normT(g.title)))continue;
    const f=g.file&&sc[g.file];
    uses.push({c,g,canon:g.canon||normT(g.title),key:(f&&f.key)||g.key||'(미지정)',speed:(f&&f.tempo&&tmap[f.tempo])||'(미지정)'});
  }
  return {cs,uses};
}
function topSongs(uses){
  const m=new Map();
  for(const u of uses){let r=m.get(u.canon);if(!r){r={canon:u.canon,n:0,titles:new Map(),last:'',cs:[]};m.set(u.canon,r)}
    r.n++;r.titles.set(u.g.title,(r.titles.get(u.g.title)||0)+1);if(u.c.date>r.last)r.last=u.c.date;r.cs.push(u.c)}
  return [...m.values()].map(r=>({...r,title:[...r.titles.entries()].sort((a,b)=>b[1]-a[1])[0][0],cs:r.cs.sort((a,b)=>b.date.localeCompare(a.date))}))
    .sort((a,b)=>b.n-a.n||b.last.localeCompare(a.last)||a.title.localeCompare(b.title,'ko'));
}
/* --- 툴팁 (값이 먼저, 이름은 보조 / textContent 만 사용) --- */
function tipShow(pt,label,value,extra){
  const t=$('#stip');t.replaceChildren(el('div','tv',value),el('div','tl',label),...(extra?[el('div','te',extra)]:[]));
  t.style.display='block';tipMove(pt);
}
function tipMove(pt){
  const t=$('#stip'),r=t.getBoundingClientRect();let x=pt.clientX+14,y=pt.clientY+14;
  if(x+r.width>innerWidth-8)x=pt.clientX-r.width-14;if(y+r.height>innerHeight-8)y=pt.clientY-r.height-14;
  t.style.left=Math.max(8,x)+'px';t.style.top=Math.max(8,y)+'px';
}
const tipHide=()=>{$('#stip').style.display='none'};
function bindTip(node,label,value,extra){
  node.addEventListener('pointerenter',e=>tipShow(e,label,value,extra));
  node.addEventListener('pointermove',tipMove);node.addEventListener('pointerleave',tipHide);
  node.addEventListener('focus',()=>{const r=node.getBoundingClientRect();tipShow({clientX:r.left+Math.min(r.width/2,120),clientY:r.top},label,value,extra)});
  node.addEventListener('blur',tipHide);
}
/* --- 표 (모든 차트의 표 보기) --- */
function buildTable(headers,rows,numCols=[]){
  const t=el('table','stt'),th=el('thead'),tr=el('tr');
  headers.forEach((h,i)=>{const c=el('th',numCols.includes(i)?'n':'',h);tr.append(c)});th.append(tr);t.append(th);
  const tb=el('tbody');for(const r of rows){const row=el('tr');r.forEach((v,i)=>row.append(el('td',numCols.includes(i)?'n':'',String(v))));tb.append(row)}
  t.append(tb);return t;
}
function card(id,title,sub,chart,headers,rows,{wide=false,numCols=[],foot=null,noToggle=false}={}){
  const c=el('div','scard'+(wide?' wide':'')),h=el('div','sh');h.append(el('h4','',title));
  const tg=el('button','tg','표로 보기');if(!noToggle)h.append(tg);c.append(h);if(sub)c.append(el('div','sub',sub));
  const body=el('div','sbody'),table=buildTable(headers,rows,numCols);body.append(chart);c.append(body);if(foot)c.append(foot);
  const apply=()=>{const on=!noToggle&&!!ST.tbl[id];body.replaceChildren(on?table:chart);tg.textContent=on?'차트로 보기':'표로 보기'};
  tg.onclick=()=>{ST.tbl[id]=!ST.tbl[id];apply();tipHide()};apply();return c;
}
/* --- 가로 막대 (한 가지 색 = 슬롯 1, 막대 끝에 값) --- */
function hbars(rows,{unit='회',detail=false,lw=0}={}){
  const box=el('div','hbs'),mx=Math.max(1,...rows.map(r=>r.value));
  if(!rows.length){box.append(el('div','sub','표시할 데이터가 없습니다.'));return box}
  rows.forEach(r=>{
    const row=el('div','hb');row.tabIndex=0;if(lw)row.style.setProperty('--lw',lw+'px');const lb=el('div','lb',r.label);lb.title=r.label;
    const tr=el('div','tr'),br=el('div','br');br.style.width=`calc((100% - 56px) * ${r.value/mx})`;
    tr.append(br,el('div','vl',fmtN(r.value)+unit));row.append(lb,tr);bindTip(row,r.label,fmtN(r.value)+unit,r.extra);
    if(detail&&r.cs){
      let open=null;const toggle=()=>{
        if(open){open.remove();open=null;return}
        open=el('div','hd');open.append(el('span','',`사용한 콘티 ${r.cs.length}개 :`));
        r.cs.slice(0,12).forEach(c=>{const b=el('button','',`${fmtDate(c.date)} ${c.date.slice(0,4)} · ${c.service.replace(/\s*찬양$/,'')}`);b.onclick=()=>gotoConti(c.id);open.append(b)});
        if(r.cs.length>12)open.append(el('span','',`… 외 ${r.cs.length-12}개`));row.after(open);
      };
      row.addEventListener('click',toggle);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
    }
    box.append(row);
  });
  return box;
}
/* --- 세로 막대 (눈금선 + 최댓값만 직접 표시) --- */
function niceMax(v){const steps=[1,2,5,10,20,25,50,100,200,500,1000];for(const s of steps){if(v<=s*4)return {max:Math.ceil(v/s)*s,step:s}}return {max:Math.ceil(v/1000)*1000,step:1000}}
function columns(items,{unit='개'}={}){
  const box=el('div','cc');if(!items.length){box.style.height='auto';box.append(el('div','sub','표시할 데이터가 없습니다.'));return box}
  const mx=Math.max(...items.map(i=>i.value)),{max,step}=niceMax(Math.max(1,mx));
  for(let v=0;v<=max;v+=step){const g=el('div','gl');g.style.top=(100-v/max*100)+'%';box.append(g);const t=el('div','gt',fmtN(v));t.style.top=(100-v/max*100)+'%';box.append(t)}
  const cols=el('div','cols'),every=Math.max(1,Math.ceil(items.length/12));
  items.forEach((it,i)=>{
    const col=el('div','col');col.tabIndex=0;const bar=el('div','bar');bar.style.height=(it.value/max*100)+'%';col.append(bar);
    if(it.value===mx&&!col.dataset.mx){const m=el('div','mx',fmtN(it.value));m.style.bottom=(it.value/max*100)+'%';col.append(m)}
    if(i%every===0||i===items.length-1)col.append(el('div','xl',it.label));
    bindTip(col,it.tip||it.label,fmtN(it.value)+unit);cols.append(col);
  });
  box.append(cols);return box;
}
/* --- 누적 막대 (예배 종류 비율: 슬롯 1~4 고정 색, 조각 사이 2px 간격) --- */
const TYPE_COLOR={'주일':'--s1','금요기도회':'--s2','은혜로기도회':'--s3','특별':'--s4'};
function lumOf(rgb){const m=rgb.match(/\d+/g).map(Number),f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])}
function stacked(rows,{unit='개'}={}){
  const wrap=el('div'),total=rows.reduce((a,r)=>a+r.value,0),bar=el('div','sb'),lg=el('div','lg');
  if(!total){wrap.append(el('div','sub','표시할 데이터가 없습니다.'));return wrap}
  rows.filter(r=>r.value>0).forEach(r=>{
    const sg=el('div','sg');sg.tabIndex=0;sg.style.flex=r.value;sg.style.background=`var(${TYPE_COLOR[r.label]||'--s1'})`;bar.append(sg);
    bindTip(sg,r.label,`${fmtN(r.value)}${unit} (${Math.round(r.value/total*100)}%)`);
    requestAnimationFrame(()=>{ // 라벨이 들어갈 때만 조각 안에 표시, 글자색은 배경 밝기로 선택
      const txt=`${Math.round(r.value/total*100)}%`;
      if(sg.getBoundingClientRect().width>txt.length*9+16){sg.textContent=txt;sg.style.color=lumOf(getComputedStyle(sg).backgroundColor)>0.35?'#111':'#fff'}
    });
  });
  rows.forEach(r=>{const s=el('span'),i=el('i');i.style.background=`var(${TYPE_COLOR[r.label]||'--s1'})`;s.append(i,document.createTextNode(r.label+' '),el('small','',`${fmtN(r.value)}${unit}`));lg.append(s)});
  wrap.append(bar,lg);return wrap;
}
/* --- 화면 조립 --- */
function renderStats(){
  tipHide();const {cs,uses}=statData(),box=$('#statbody');box.replaceChildren();
  const tops=topSongs(uses),songN=tops.length;
  const kp=el('div','kpis');
  [['콘티',fmtN(cs.length)+'개',cs.length?`${cs[0]?cs.map(c=>c.date).sort()[0]:''} ~ ${cs.map(c=>c.date).sort().pop()}`:'기간 내 콘티 없음'],
   ['곡 사용',fmtN(uses.length)+'회','입례·영접송 등 제외 설정 적용'],
   ['서로 다른 곡',fmtN(songN)+'곡','악보 제목 기준'],
   ['콘티당 평균',(cs.length?(uses.length/cs.length).toFixed(1):'0')+'곡','곡 사용 ÷ 콘티 수']
  ].forEach(([l,v,s])=>{const k=el('div','kpi');k.append(el('div','l',l),el('div','v',v),el('div','s',s));kp.append(k)});
  box.append(kp);
  const grid=el('div','sgrid');box.append(grid);
  // ① 많이 쓴 곡
  const shown=tops.slice(0,ST.top),more=el('div');
  if(tops.length>ST.top){const b=el('button','',`더 보기 (${Math.min(ST.top+20,tops.length)}위까지)`);b.style.marginTop='8px';b.onclick=()=>{ST.top+=20;renderStats()};more.append(b)}
  if(ST.top>20){const b=el('button','','접기');b.style.cssText='margin:8px 0 0 6px';b.onclick=()=>{ST.top=20;renderStats()};more.append(b)}
  grid.append(card('top',`많이 쓴 곡 TOP ${Math.min(ST.top,tops.length)}`,'막대나 곡 이름을 누르면 그 곡을 쓴 콘티가 펼쳐지고, 날짜를 누르면 해당 콘티로 이동합니다.',
    hbars(shown.map(r=>({label:r.title,value:r.n,cs:r.cs,extra:`마지막 사용 ${r.last}`})),{detail:true}),
    ['순위','곡','사용 횟수','마지막 사용'],tops.slice(0,Math.max(ST.top,50)).map((r,i)=>[i+1,r.title,r.n,r.last]),{wide:true,numCols:[0,2],foot:more}));
  // ② 월별/연도별 콘티 수
  const byMonth=new Map(),yrs=new Set();for(const c of cs){const m=c.date.slice(0,7);byMonth.set(m,(byMonth.get(m)||0)+1);yrs.add(c.date.slice(0,4))}
  const months=[...byMonth.keys()].sort(),span=months.length?((+months.at(-1).slice(0,4)-+months[0].slice(0,4))*12+(+months.at(-1).slice(5)-+months[0].slice(5))+1):0;
  let tl,items;
  if(span>24){tl='연도별 콘티 수';const y={};for(const c of cs){const k=c.date.slice(0,4);y[k]=(y[k]||0)+1}items=Object.keys(y).sort().map(k=>({label:k,value:y[k],tip:`${k}년`}))}
  else{tl='월별 콘티 수';items=[];if(months.length){let [yy,mm]=months[0].split('-').map(Number);const [ey,em]=months.at(-1).split('-').map(Number);
    while(yy<ey||(yy===ey&&mm<=em)){const k=`${yy}-${String(mm).padStart(2,'0')}`;items.push({label:`${String(yy).slice(2)}.${String(mm).padStart(2,'0')}`,value:byMonth.get(k)||0,tip:`${yy}년 ${mm}월`});mm++;if(mm>12){mm=1;yy++}}}}
  grid.append(card('time',tl,span>24?'기간이 길어 연도별로 묶었습니다.':'콘티를 만든 날짜 기준입니다.',columns(items),['기간','콘티 수'],items.map(i=>[i.tip,i.value]),{numCols:[1]}));
  // ③ 예배 종류 비율
  const tc={'주일':0,'금요기도회':0,'은혜로기도회':0,'특별':0};for(const c of cs)tc[c.type]=(tc[c.type]||0)+1;
  const trows=Object.keys(tc).map(k=>({label:k,value:tc[k]}));
  grid.append(card('type','예배 종류 비율','콘티 수 기준입니다.',stacked(trows),['예배 종류','콘티 수','비율'],trows.map(r=>[r.label,r.value,cs.length?Math.round(r.value/cs.length*100)+'%':'-']),{numCols:[1,2]}));
  // ④ 코드 분포 / ⑤ 빠르기 분포
  const kc={};for(const u of uses)kc[u.key]=(kc[u.key]||0)+1;
  const korder=[...(st.keys||[]),'(미지정)'],krow=korder.filter(k=>kc[k]).map(k=>({label:k,value:kc[k]}));
  Object.keys(kc).filter(k=>!korder.includes(k)).forEach(k=>krow.push({label:k,value:kc[k]}));
  grid.append(card('key','코드(Key) 분포','쓰인 곡의 코드입니다. 악보 파일을 고른 곡은 그 파일의 코드를 따릅니다.',hbars(krow,{unit:'회',lw:64}),['코드','사용 횟수','비율'],krow.map(r=>[r.label,r.value,uses.length?Math.round(r.value/uses.length*100)+'%':'-']),{numCols:[1,2]}));
  const sc2={};for(const u of uses)sc2[u.speed]=(sc2[u.speed]||0)+1;
  const sorder=[...(fsx.db.tempos||[]).map(t=>t.label),'(미지정)'],srow=sorder.filter(k=>sc2[k]).map(k=>({label:k,value:sc2[k]}));
  grid.append(card('speed','빠르기(Speed) 분포','악보함에서 지정한 빠르기 기준입니다. (미지정)은 아직 빠르기를 정하지 않은 곡입니다.',hbars(srow,{unit:'회',lw:84}),['빠르기','사용 횟수','비율'],srow.map(r=>[r.label,r.value,uses.length?Math.round(r.value/uses.length*100)+'%':'-']),{numCols:[1,2]}));
  // ⑥ 오래 안 쓴 곡 (전체 기간 기준)
  const all=new Map();for(const c of contis())for(const g of songsOf(c)){if(g.special||(($('#st-skip').checked)&&STAT_SKIP.has(normT(g.title))))continue;const k=g.canon||normT(g.title);const r=all.get(k)||{n:0,last:'',title:g.title,cs:[]};r.n++;if(c.date>=r.last){r.last=c.date;r.title=g.title}r.cs.push(c);all.set(k,r)}
  const today=todayStr(),rowsOld=[...all.values()].filter(r=>r.last<=today).sort((a,b)=>a.last.localeCompare(b.last)||a.title.localeCompare(b.title,'ko'));
  let list=rowsOld.map(r=>({title:r.title,last:r.last,days:daysAgo(r.last),n:r.n}));
  const never=[];if(ST.never){const seen=new Set(all.keys());const g=new Map();for(const it of libItems()){const k=normT(it.title);if(k&&!seen.has(k)&&!g.has(k))g.set(k,it.title)}[...g.values()].sort((a,b)=>a.localeCompare(b,'ko')).forEach(t=>never.push({title:t,last:'-',days:'-',n:0}))}
  const full=[...list,...never],lim=full.slice(0,ST.never_n);
  const nb=el('div'),b1=el('label');b1.style.cssText='display:flex;gap:6px;align-items:center;font-size:12px;color:var(--mut);margin-top:8px';
  const cbx=el('input');cbx.type='checkbox';cbx.checked=ST.never;cbx.onchange=()=>{ST.never=cbx.checked;renderStats()};b1.append(cbx,document.createTextNode('악보함에 있지만 콘티에 한 번도 안 쓴 곡도 목록 끝에 포함'));nb.append(b1);
  if(full.length>ST.never_n){const m=el('button','',`더 보기 (${full.length-ST.never_n}곡 남음)`);m.style.marginTop='8px';m.onclick=()=>{ST.never_n+=30;renderStats()};nb.append(m)}
  const dt=buildTable(['곡','마지막 사용','경과','총 사용'],lim.map(r=>[r.title,r.last,r.days==='-'?'-':`${fmtN(r.days)}일 전`,r.n?r.n+'회':'기록 없음']),[2,3]);
  const holder=el('div');holder.append(dt);
  grid.append(card('old','오래 안 쓴 곡',`전체 기간 기준 (위 기간·예배 선택과 무관). 콘티 짤 때 참고하세요. 총 ${fmtN(full.length)}곡 중 ${fmtN(lim.length)}곡 표시.`,holder,['곡','마지막 사용','경과','총 사용'],lim.map(r=>[r.title,r.last,r.days==='-'?'-':`${r.days}일 전`,r.n?r.n+'회':'기록 없음']),{wide:true,foot:nb,noToggle:true}));
}
function gotoConti(id){
  $('#statdlg').classList.remove('on');tipHide();setMode('conti');
  C.q='';C.type='';C.year='';$('#cq').value='';$('#ctype').value='';$('#cyear').value='';
  C.sel=contis().find(c=>c.id===id)||null;C.jump=true;renderContiList();renderContiDetail();
  const it=[...document.querySelectorAll('#clist .ci')].find(e=>e.dataset.id===id);if(it)it.scrollIntoView({block:'center'});
}
$('#statbtn').onclick=()=>{ST.top=20;ST.never_n=30;$('#statdlg').classList.add('on');renderStats()};
$('#statclose').onclick=()=>{$('#statdlg').classList.remove('on');tipHide()};
for(const id of ['#st-period','#st-type','#st-skip'])$(id).addEventListener('change',()=>{ST.top=20;renderStats()});

/* ================= 찬송가 / CCM 분류 ================= */
function parseHymns(j){
  const KEYS=['title','제목','name','hymn','hymn_title','hymnTitle','songTitle','song','text','label'];
  const pick=o=>{if(typeof o==='string')return o;if(o&&typeof o==='object'){for(const k of Object.keys(o))if(KEYS.includes(k)||KEYS.includes(k.toLowerCase())){if(typeof o[k]==='string')return o[k]}
    for(const k of Object.keys(o))if(typeof o[k]==='string'&&/[가-힣]/.test(o[k]))return o[k]}return ''};
  let arr=[];
  if(Array.isArray(j))arr=j.map(pick);
  else if(j&&typeof j==='object'){
    const listKey=Object.keys(j).find(k=>Array.isArray(j[k]));
    if(listKey)arr=j[listKey].map(pick);else arr=Object.values(j).map(pick);
  }
  const clean=t=>String(t).replace(/^\s*(제\s*)?\d+\s*(장|번)?\s*[.\-:)\]]?\s*/,'').replace(/\s+/g,' ').trim();
  return [...new Set(arr.map(clean).filter(t=>normT(t).length>=2))];
}
const HSTEM=rel=>{const n=rel.split('/').pop().replace(/\.[A-Za-z0-9]+$/,'');return n.replace(/^[A-Ga-g][#b]?m?-/,'')};
function candKeys(id,s){
  const set=new Set([normT(s.title)]);const stem=HSTEM(id);set.add(normT(stem));
  for(const m of stem.matchAll(/\(([^)]+)\)/g))set.add(normT(m[1]));
  const parts=stem.split('-').map(normT).filter(Boolean);parts.forEach(p=>set.add(p));
  return [...set].filter(k=>k.length>=2);
}
function hymnPlan(){
  const titles=(fsx.db.hymns&&fsx.db.hymns.titles)||[],o={num:$('#h-num').checked,part:$('#h-part').checked,ccm:$('#h-ccm').checked,skip:$('#h-skip').checked};
  const hk=titles.map(t=>[normT(t),t]).filter(([k])=>k.length>=2),exact=new Map(hk);
  const plan={hymn:[],ccm:[],skip:[]};
  for(const [id,s] of Object.entries(fsx.db.scores)){
    if(s.missing||s.excluded)continue;const tags=s.tags||[];
    if(o.skip&&(tags.includes('찬송가')||tags.includes('CCM'))){plan.skip.push({id,title:s.title});continue}
    const ck=candKeys(id,s);let why='',hit='';
    for(const k of ck){if(exact.has(k)){why='제목 일치';hit=exact.get(k);break}}
    if(!why&&o.part){for(const [h,t] of hk){if(h.length>=5&&ck.some(k=>k.length>=h.length&&k.includes(h))){why='부분 일치';hit=t;break}}}
    if(!why&&o.num){const m=HSTEM(id).match(/(?<=\D)([1-9]\d{1,2})(?:-\d)?$/);if(m&&+m[1]>=1&&+m[1]<=645){why='번호 '+(+m[1]);hit='찬송가 '+(+m[1])+'장'}}
    if(why)plan.hymn.push({id,title:s.title,why,hit});else plan.ccm.push({id,title:s.title});
  }
  plan.o=o;plan.n=titles.length;return plan;
}
function hymnRender(){
  const p=hymnPlan(),sum=$('#hsum'),box=$('#hlists');
  const by=k=>p.hymn.filter(h=>h.why.startsWith(k)).length;
  sum.replaceChildren();
  sum.append(el('div','',`불러온 찬송가 제목: ${p.n?fmtN(p.n)+'개':'없음 (파일명 번호만 사용)'}`));
  const l2=el('div','');l2.innerHTML=`<b>찬송가</b> ${fmtN(p.hymn.length)}곡 (제목 일치 ${by('제목')} · 부분 일치 ${by('부분')} · 번호 ${by('번호')}) &nbsp;|&nbsp; <b>CCM</b> ${p.o.ccm?fmtN(p.ccm.length)+'곡':'표시 안 함'} &nbsp;|&nbsp; 건너뜀 ${fmtN(p.skip.length)}곡`;sum.append(l2);
  box.replaceChildren();
  const mk=(title,arr,fmt,open)=>{const d=el('details');if(open)d.open=true;d.append(el('summary','',`${title} (${fmtN(arr.length)}곡)`));const ul=el('ul');
    arr.slice(0,400).forEach(x=>{const li=el('li');li.append(document.createTextNode(fmt(x)));ul.append(li)});if(arr.length>400)ul.append(el('li','',`… 외 ${arr.length-400}곡`));d.append(ul);return d};
  box.append(mk('찬송가로 분류될 곡',p.hymn,x=>`${x.title}  ← ${x.why}${x.why.startsWith('번호')?'':` (${x.hit})`}`,true));
  if(p.o.ccm)box.append(mk('CCM으로 표시될 곡',p.ccm,x=>x.title,false));
  $('#happly').disabled=!(p.hymn.length||(p.o.ccm&&p.ccm.length));
  return p;
}
function ensureHymnTags(){const L=tagList();for(const n of ['CCM','찬송가']){const i=L.findIndex(t=>t.name===n);const t=i>=0?L.splice(i,1)[0]:{name:n,keywords:[]};L.unshift(t)}}
$('#hymnbtn').onclick=()=>{
  const h=fsx.db.hymns;$('#hinfo').textContent=h&&h.titles.length?`저장된 목록 ${fmtN(h.titles.length)}개 (${h.updated||''})`:'아직 불러온 목록이 없습니다';
  $('#hdlg').showModal();hymnRender();
};
$('#hfile').onclick=()=>$('#hfilei').click();
$('#hfilei').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const titles=parseHymns(JSON.parse(await f.text()));
    if(!titles.length){alert('찬송가 제목을 찾지 못했습니다. 파일 형식을 알려 주세요.');return}
    fsx.db.hymns={titles,updated:todayStr()};await saveDb();$('#hinfo').textContent=`${f.name} · 제목 ${fmtN(titles.length)}개 불러옴 (예: ${titles.slice(0,3).join(', ')})`;hymnRender();
  }catch(err){alert('파일을 읽을 수 없습니다: '+err.message)}
};
for(const id of ['#h-num','#h-part','#h-ccm','#h-skip'])$(id).addEventListener('change',hymnRender);
$('#happly').onclick=async()=>{
  const p=hymnPlan();
  if(!confirm(`찬송가 ${fmtN(p.hymn.length)}곡에 '찬송가' 카테고리를${p.o.ccm?`, 나머지 ${fmtN(p.ccm.length)}곡에 'CCM' 카테고리를`:''} 붙입니다.\n(이미 붙은 다른 카테고리는 그대로 두고, 직접 분류한 곡은 설정에 따라 건너뜁니다)`))return;
  const sc=fsx.db.scores;
  for(const h of p.hymn){const s=sc[h.id];s.tags=[...new Set([...(s.tags||[]).filter(t=>t!=='CCM'),'찬송가'])].sort()}
  if(p.o.ccm)for(const c of p.ccm){const s=sc[c.id];s.tags=[...new Set([...(s.tags||[]).filter(t=>t!=='찬송가'),'CCM'])].sort()}
  ensureHymnTags();await saveDb();st.tag.clear();$('#hdlg').close();await load();
  alert(`분류했습니다.\n찬송가 ${fmtN(p.hymn.length)}곡${p.o.ccm?` · CCM ${fmtN(p.ccm.length)}곡`:''}\n왼쪽 카테고리(Tag)의 '찬송가' / 'CCM' 칩으로 골라 볼 수 있습니다.`);
};
$('#hclose').onclick=()=>$('#hdlg').close();
