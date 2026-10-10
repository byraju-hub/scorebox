/* Raju's ScoreBox — 찬양 추천 (성경 본문 → Claude) */
/* ================= 찬양 추천 (성경 본문 → Claude) ================= */
const REC={books:[],last:null,key:''};
function parseBible(j){
  const books=new Map();
  const txt=v=>typeof v==='string'?v:(v&&typeof v==='object'?(v.text||v.content||v.body||v.verse||v['본문']||v['내용']||''):'');
  const add=(b,c,v,t,end,meta)=>{b=String(b).trim();c=+c;v=+v;t=String(t||'').trim();if(!b||!c||!v||!t)return;let o=books.get(b);if(!o){o={name:b,ch:{},e:{},al:[]};books.set(b,o)}if(meta&&meta.length)o.al=meta;(o.ch[c]=o.ch[c]||{})[v]=t;if(end&&+end>v)(o.e[c]=o.e[c]||{})[v]=+end};
  const pick=(o,ks)=>{for(const k of ks)if(o[k]!==undefined)return o[k]};
  const BK=['book','bookName','book_name','bname','name','책','성경','title'],CK=['chapter','chap','장','c','cn'],VK=['verse','절','v','vn','verse_no'],TK=['text','content','body','본문','내용','verse_text','t'];
  const fromChapters=(bn,chs)=>{
    if(Array.isArray(chs))chs.forEach((ch,i)=>{
      if(Array.isArray(ch))ch.forEach((v,k)=>add(bn,i+1,k+1,txt(v)));
      else if(ch&&typeof ch==='object'){const cn=pick(ch,CK)??i+1,vs=pick(ch,['verses','절','vs'])??ch;
        if(Array.isArray(vs))vs.forEach((v,k)=>add(bn,cn,(v&&pick(v,VK))||k+1,txt(v)));else for(const [vn,t] of Object.entries(vs))add(bn,cn,vn,txt(t))}});
    else if(chs&&typeof chs==='object')for(const [cn,vs] of Object.entries(chs)){
      if(Array.isArray(vs))vs.forEach((v,k)=>add(bn,cn,(v&&typeof v==='object'&&pick(v,VK))||k+1,txt(v)));
      else if(vs&&typeof vs==='object')for(const [vn,t] of Object.entries(vs))add(bn,cn,vn,txt(t))}
  };
  const walk=x=>{
    if(x&&!Array.isArray(x)&&typeof x==='object'&&Array.isArray(x.books)&&x.books.some(b=>b&&Array.isArray(b.verses))){
      for(const b of x.books){if(!b||!Array.isArray(b.verses))continue;const al=[b.short,...(b.aliases||[])].filter(Boolean);
        for(const v of b.verses){const m=String(v.verse||'').match(/^(\d+)(?:\s*[-~]\s*(\d+))?/),s1=v.v1||(m&&+m[1]),s2=v.v2||(m&&m[2]&&+m[2])||s1;add(b.name,v.chapter,s1,v.text,s2,al)}}
      return}
    if(Array.isArray(x)){
      for(const el of x){
        if(!el||typeof el!=='object')continue;
        const bn=pick(el,BK),chs=pick(el,['chapters','장들','contents']);
        if(chs!==undefined&&bn!==undefined)fromChapters(bn,chs);
        else{const c=pick(el,CK),v=pick(el,VK),t=pick(el,TK);if(bn!==undefined&&c!==undefined&&v!==undefined)add(bn,c,v,txt(t))}
      }
    }else if(x&&typeof x==='object'){
      const ks=Object.keys(x);
      if(ks.length&&ks.every(k=>/^\D+\s*\d+\s*[:.]\s*\d+/.test(k))){for(const [k,t] of Object.entries(x)){const m=k.match(/^(\D+?)\s*(\d+)\s*[:.]\s*(\d+)/);if(m)add(m[1],m[2],m[3],txt(t))}return}
      if(ks.length<=2&&ks.some(k=>/^(books?|bible|data|성경)$/i.test(k))){walk(x[ks.find(k=>/^(books?|bible|data|성경)$/i.test(k))]);return}
      for(const [bn,chs] of Object.entries(x))fromChapters(bn,chs);
    }
  };
  walk(j);
  return [...books.values()];
}
function recFillBooks(){const sel=$('#rc-book');sel.innerHTML=REC.books.map((b,i)=>`<option value="${i}">${esc(b.name)}</option>`).join('');recFillCh()}
const recBook=()=>REC.books[+$('#rc-book').value];
function recFillCh(){const b=recBook();$('#rc-ch').innerHTML=b?Object.keys(b.ch).map(Number).sort((x,y)=>x-y).map(c=>`<option>${c}</option>`).join(''):'';recFillV()}
function recFillV(){const b=recBook();if(!b){$('#rc-v1').innerHTML=$('#rc-v2').innerHTML='';$('#rc-text').textContent='';return}
  const cn=+$('#rc-ch').value,set=new Set();for(const k of Object.keys(b.ch[cn]||{})){const a=+k,z=(b.e[cn]||{})[a]||a;for(let v=a;v<=z;v++)set.add(v)}
  const vs=[...set].sort((x,y)=>x-y),o=vs.map(v=>`<option>${v}</option>`).join('');
  const v1=$('#rc-v1'),v2=$('#rc-v2');v1.innerHTML=o;v2.innerHTML=o;v2.value=vs[vs.length-1];recText()}
function recSel(){const b=recBook(),c=+$('#rc-ch').value,v1=+$('#rc-v1').value,v2=Math.max(v1,+$('#rc-v2').value);if(!b)return null;
  const arr=[];for(const k of Object.keys(b.ch[c]||{}).map(Number).sort((x,y)=>x-y)){const z=(b.e[c]||{})[k]||k;if(z>=v1&&k<=v2)arr.push([z>k?k+'-'+z:k,b.ch[c][k]])}
  return {ref:`${b.name} ${c}:${v1===v2?v1:v1+'-'+v2}`,verses:arr}}
function recText(){const s=recSel();$('#rc-text').innerHTML=s?s.verses.map(([v,t])=>`<sup>${v}</sup>${esc(t)}`).join(' '):'';}
$('#rc-book').onchange=recFillCh;$('#rc-ch').onchange=recFillV;$('#rc-v1').onchange=()=>{if(+$('#rc-v2').value<+$('#rc-v1').value)$('#rc-v2').value=$('#rc-v1').value;recText()};$('#rc-v2').onchange=()=>{if(+$('#rc-v2').value<+$('#rc-v1').value)$('#rc-v1').value=$('#rc-v2').value;recText()};
async function recLoad(){
  const w=$('#rc-warn');w.style.display='none';w.textContent='';
  try{
    if(!REC.books.length){const fh=await fsx.root.getFileHandle('bible.json');const bk=parseBible(JSON.parse(await (await fh.getFile()).text()));if(!bk.length)throw new Error('bible.json 에서 책·장·절을 찾지 못했습니다');REC.books=bk}
  }catch(e){w.textContent=(e.name==='NotFoundError'?'악보 폴더에 bible.json 파일이 없습니다.\n악보 폴더(예: Pictures)에 bible.json 을 넣은 뒤 다시 열어 주세요.':'bible.json 을 읽지 못했습니다: '+e.message);w.style.display='block'}
  try{const kh=await fsx.root.getFileHandle('claude_api_key.txt');REC.key=(await (await kh.getFile()).text()).trim()}catch(e){REC.key='';w.textContent+=(w.textContent?'\n\n':'')+'악보 폴더에 claude_api_key.txt 파일(안에 API 키 한 줄)이 없습니다.\n이 파일을 악보 폴더에 넣어 주세요.';w.style.display='block'}
}
$('#recbtn').onclick=async()=>{recFillBooks();$('#rc-status').textContent='';$('#rc-res').innerHTML='';$('#recdlg').showModal();await recLoad();recFillBooks()};
$('#rc-close').onclick=()=>$('#recdlg').close();
function recLibTitles(){const seen=new Map();for(const it of libItems()){const k=normT(it.title);if(k&&!seen.has(k))seen.set(k,it.title)}return [...seen.values()]}
const recFindLib=t=>{const n=normT(t);return libItems().filter(i=>i.title===t||normT(i.title)===n)};
function recPrompt(sel,nlib,nout,titles){
  return `성경 본문: ${sel.ref}\n\n본문 내용:\n${sel.verses.map(([v,t])=>v+'. '+t).join('\n')}\n\n[악보함 곡 제목 목록]\n${titles.join('\n')}\n\n요청:\n1) 이 본문의 주제·정서에 어울리는 찬양을 악보함 목록에서 ${nlib}곡 고르세요. 제목은 목록에 있는 것을 글자 그대로 쓰세요.\n2) 악보함 목록에 없는 어울리는 찬양(찬송가·CCM 등)을 ${nout}곡 추천하세요. 한국 교회에서 한국어로 부르는 곡(한국어 찬송가, 한국어 CCM·한국 찬양팀 곡, 한국어로 번안되어 널리 불리는 곡)을 우선하고, 한국어 제목이 없는 외국 곡은 되도록 피하세요. 제목은 한국에서 쓰는 한국어 제목으로 쓰고, 가능하면 작곡가·가수(찬양팀)도 적으세요.\n각 곡마다 본문과 어떻게 어울리는지 한두 문장으로 이유를 쓰세요.\n\n반드시 아래 JSON만 출력하세요(코드블록·설명 금지):\n{"summary":"본문 주제 요약 한 문장","library":[{"title":"","reason":""}],"outside":[{"title":"","artist":"","reason":""}]}`}
async function recAsk(){
  const key=REC.key;if(!key){$('#rc-status').textContent='claude_api_key.txt 파일이 필요합니다.';return}
  const sel=recSel();if(!sel||!sel.verses.length){$('#rc-status').textContent='성경 본문을 선택하세요.';return}
  const nlib=8,nout=5,titles=recLibTitles();
  const body={model:'claude-haiku-5-5',max_tokens:8000,output_config:{effort:'low'},system:'당신은 한국 교회 찬양 인도자를 돕는 어시스턴트입니다. 성경 본문의 주제와 정서에 맞는 찬양을 신중하게 추천합니다.',messages:[{role:'user',content:recPrompt(sel,nlib,nout,titles)}]};
  $('#rc-go').disabled=true;$('#rc-status').textContent='Claude에게 물어보는 중… (수십 초 걸릴 수 있습니다)';$('#rc-res').innerHTML='';
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
    const j=await res.json();
    if(!res.ok)throw new Error((j.error&&j.error.message)||('HTTP '+res.status));
    const text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
    const a=text.indexOf('{'),z=text.lastIndexOf('}');let out;
    try{out=JSON.parse(text.slice(a,z+1))}catch(e){throw new Error('답변을 해석하지 못했습니다:\n'+text.slice(0,600))}
    REC.last={sel,out};recRender(sel,out);$('#rc-status').textContent='';
  }catch(e){$('#rc-status').textContent='';$('#rc-res').innerHTML=`<p style="color:#e03131;white-space:pre-wrap">추천을 받지 못했습니다: ${esc(e.message)}</p>`}
  $('#rc-go').disabled=false;
}
function recRender(sel,out){
  const lib=[],outside=[...(out.outside||[])];
  for(const x of out.library||[]){const items=recFindLib(x.title||'');if(items.length)lib.push({x,items});else outside.push({title:x.title,artist:'',reason:x.reason})}
  const q=t=>encodeURIComponent(t);
  $('#rc-res').innerHTML=`<p><b>${esc(sel.ref)}</b> — ${esc(out.summary||'')}</p>
  <h3>📚 악보함에 있는 찬양 (${lib.length})</h3>${lib.map(({x,items},i)=>`<div class="rci" data-i="${i}"><span class="t"><b>${esc(items[0].title)}</b> ${items.map(it=>it.key?`<span class="badge k">${esc(it.key)}</span>`:'').join('')}<small>${esc(x.reason||'')}</small></span><button class="obtn off bk">🧺 담기</button><button class="op">악보 보기</button></div>`).join('')||'<p style="color:var(--mut)">악보함에서 고른 곡이 없습니다.</p>'}
  <h3>🌐 악보함에 없는 찬양 (${outside.length})</h3>${outside.map(x=>`<div class="rci out"><span class="t"><b>${esc(x.title||'')}</b>${x.artist?` <small style="display:inline">· ${esc(x.artist)}</small>`:''}<small>${esc(x.reason||'')}</small></span><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${q((x.title||'')+' '+(x.artist||'')+' 악보')}">악보 검색</a><a target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q((x.title||'')+' '+(x.artist||''))}">YouTube</a></div>`).join('')||'<p style="color:var(--mut)">없음</p>'}`;
  $('#rc-res').querySelectorAll('.rci[data-i]').forEach(row=>{const {items}=lib[+row.dataset.i],bk=row.querySelector('.bk');
    const upd=()=>{const on=items.some(it=>inBasket(it.id));bk.textContent=on?'🧺 빼기':'🧺 담기';bk.classList.toggle('off',on)};upd();
    bk.onclick=()=>{const on=items.some(it=>inBasket(it.id));if(on)basketSet(items.map(i=>i.id),false);else basketSet([items[0].id],true);upd()};
    row.querySelector('.op').onclick=()=>{$('#recdlg').close();openDlg(items[0])}});
}
$('#rc-go').onclick=recAsk;
