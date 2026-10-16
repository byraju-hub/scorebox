/* Raju's ScoreBox — 제목 띄어쓰기 정리 (① 찬송가 목록 ② 다른 콘티의 제목 ③ 남은 곡은 Claude Haiku) */
const SP={rows:[],busy:false};
const hasKo=t=>/[가-힣]/.test(t),hasSpace=t=>/\s/.test(String(t).trim());
const spKey=t=>normT(t);
/* ① ② 띄어쓰기가 이미 되어 있는 제목 사전: 키(공백·숫자 뺀 글자) → 띄어쓴 제목 */
function spDict(){
  const d=new Map();
  for(const t of (fsx.db.hymns&&fsx.db.hymns.titles)||[])if(hasSpace(t))d.set(spKey(t),{t:t.trim().replace(/\s+/g,' '),src:'찬송가 목록'});
  const cs=[...(fsx.db.contis||[]),...(fsx.db.contisTrash||[])];
  const cnt=new Map();   // 같은 곡이 여러 모양이면 가장 많이 쓴 모양
  for(const c of cs)for(const g of c.songs||[]){const t=(g.title||'').trim();if(!hasKo(t)||!hasSpace(t))continue;const k=spKey(t),m=cnt.get(k)||new Map();m.set(t,(m.get(t)||0)+1);cnt.set(k,m)}
  for(const [k,m] of cnt)d.set(k,{t:[...m.entries()].sort((a,b)=>b[1]-a[1])[0][0].replace(/\s+/g,' '),src:'다른 콘티'});  // 콘티가 찬송가 목록보다 우선
  return d;
}
/* 띄어쓰기를 바꿀 곡 묶음 계산 (같은 제목은 한 줄로) */
function spPlan(){
  const dict=spDict(),groups=new Map();
  for(const [id,s] of Object.entries(fsx.db.scores)){
    if(s.missing||s.excluded)continue;const t=(s.title||'').trim();if(!hasKo(t)||hasSpace(t))continue;
    const k=spKey(t);if(k.length<4)continue;
    const g=groups.get(k)||{key:k,old:t,ids:[]};g.ids.push(id);groups.set(k,g);
  }
  const rows=[],todo=[];
  for(const g of groups.values()){const h=dict.get(g.key);if(h&&h.t!==g.old)rows.push({...g,neu:h.t,src:h.src,on:true});else if(!h)todo.push(g)}
  return {rows,todo};
}
function spRender(){
  const box=$('#sp-list'),rows=SP.rows;
  box.innerHTML=rows.map((r,i)=>`<div class="sprow ${r.src==='AI'?'ai':''}" data-i="${i}"><input type="checkbox" class="on" ${r.on?'checked':''}><span class="old">${esc(r.old)}${r.ids.length>1?` <small>(${r.ids.length}개 파일)</small>`:''}</span><span>→</span><input class="neu" value="${esc(r.neu)}"><small class="src">${esc(r.src)}</small></div>`).join('')||'<p style="color:var(--mut)">바꿀 곡이 없습니다.</p>';
  box.querySelectorAll('.sprow').forEach(el=>{const r=rows[+el.dataset.i];el.querySelector('.on').onchange=e=>{r.on=e.target.checked;spStat()};el.querySelector('.neu').oninput=e=>{r.neu=e.target.value}});
  spStat();
}
function spStat(){
  const n=c=>SP.rows.filter(r=>r.src===c&&r.on).length,ai=SP.rows.filter(r=>r.src==='AI').length;
  $('#sp-sum').innerHTML=`찬송가 목록·다른 콘티로 바꿀 곡 <b>${SP.rows.filter(r=>r.src!=='AI').length}</b>개`+(ai?` · AI로 바꿀 곡 <b>${ai}</b>개`:'')+` — 선택 <b>${SP.rows.filter(r=>r.on).length}</b>개 · 아직 못 고친 곡 <b>${SP.todo.length}</b>개`;
  $('#sp-ai').disabled=SP.busy||!SP.todo.length;$('#sp-ai').textContent=SP.todo.length?`✨ 남은 ${SP.todo.length}곡 AI(Haiku)로 띄어쓰기`:'✨ AI로 띄어쓰기 (남은 곡 없음)';
  $('#sp-apply').disabled=!SP.rows.some(r=>r.on);
}
async function spApiKey(){try{const h=await fsx.root.getFileHandle('claude_api_key.txt');return (await (await h.getFile()).text()).trim()}catch(e){return ''}}
/* ③ Haiku: 글자는 그대로 두고 띄어쓰기만 넣게 하고, 글자가 달라진 답은 버림 */
async function spAskAI(list,key){
  const prompt=`다음은 한국 교회 찬양·찬송가 제목인데 띄어쓰기가 되어 있지 않습니다. 각 제목에 올바른 띄어쓰기만 넣어 주세요. 글자를 바꾸거나 빼거나 더하지 마세요(공백만 추가). 찬송가·CCM 제목으로 자연스러운 띄어쓰기를 쓰세요.\n\n입력(JSON 배열):\n${JSON.stringify(list.map((x,i)=>({n:i,t:x.key})))}\n\n반드시 아래 JSON 배열만 출력하세요(코드블록·설명 금지):\n[{"n":0,"t":"띄어쓴 제목"}]`;
  const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:'claude-haiku-5-5',max_tokens:8000,output_config:{effort:'low'},messages:[{role:'user',content:prompt}]})});
  const j=await res.json();if(!res.ok)throw new Error((j.error&&j.error.message)||('HTTP '+res.status));
  const text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n'),a=text.indexOf('['),z=text.lastIndexOf(']');
  return JSON.parse(text.slice(a,z+1));
}
$('#sp-ai').onclick=async()=>{
  const key=await spApiKey();if(!key){$('#sp-msg').textContent='악보 폴더에 claude_api_key.txt 파일(API 키 한 줄)이 필요합니다.';return}
  SP.busy=true;spStat();let done=0,bad=0;const todo=SP.todo.slice(),BATCH=80;
  try{
    for(let i=0;i<todo.length;i+=BATCH){
      const part=todo.slice(i,i+BATCH);$('#sp-msg').textContent=`AI에게 묻는 중… ${Math.min(i+BATCH,todo.length)}/${todo.length}`;
      const out=await spAskAI(part,key);
      for(const o of out){const g=part[o.n];if(!g||typeof o.t!=='string')continue;const t=o.t.trim().replace(/\s+/g,' ');
        if(spKey(t)!==g.key){bad++;continue}   // 글자가 달라졌으면 버림
        SP.todo=SP.todo.filter(x=>x!==g);if(t!==g.key||hasSpace(t))SP.rows.push({...g,neu:t,src:'AI',on:hasSpace(t)});done++}
    }
    $('#sp-msg').textContent=`AI가 ${done}곡을 고쳤습니다`+(bad?` (글자가 달라져 버린 답 ${bad}개)`:'')+'. 아래 목록을 확인하고 고칠 부분은 직접 수정한 뒤 적용하세요.';
  }catch(e){$('#sp-msg').textContent='AI 호출에 실패했습니다: '+e.message}
  SP.busy=false;spRender();
};
$('#sp-all').onclick=()=>{const all=SP.rows.every(r=>r.on);SP.rows.forEach(r=>r.on=!all);spRender()};
$('#sp-apply').onclick=async()=>{
  const sc=fsx.db.scores;let nf=0,nc=0;
  for(const r of SP.rows){if(!r.on)continue;const neu=r.neu.trim().replace(/\s+/g,' ');if(!neu||spKey(neu)!==r.key)continue;   // 글자가 바뀐 수정은 적용하지 않음
    for(const id of r.ids)if(sc[id]&&sc[id].title!==neu){sc[id].title=neu;nf++}
    for(const c of [...(fsx.db.contis||[]),...(fsx.db.contisTrash||[])])for(const g of c.songs||[])if(!hasSpace(g.title||'')&&spKey(g.title||'')===r.key){g.title=neu;nc++}}
  await saveDb();await load();if(typeof renderContiList==='function'&&document.body.classList.contains('conti')){renderContiList();renderContiDetail()}
  $('#sp-msg').textContent=`악보 ${nf}개, 콘티 속 곡 ${nc}개의 제목을 바꿨습니다.`;
  const p=spPlan();SP.rows=SP.rows.filter(r=>!r.on);SP.todo=p.todo;spRender();
};
$('#spacebtn').onclick=()=>{const p=spPlan();SP.rows=p.rows;SP.todo=p.todo;$('#sp-msg').textContent='';$('#spdlg').showModal();spRender()};
$('#sp-close').onclick=()=>$('#spdlg').close();
