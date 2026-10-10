/* Raju's ScoreBox — 콘티 바구니 */
/* ================= 콘티 바구니 ================= */
const basket=()=>fsx.db.basket=Array.isArray(fsx.db.basket)?fsx.db.basket:[];
const inBasket=id=>!!(fsx.db&&Array.isArray(fsx.db.basket)&&fsx.db.basket.includes(id));
function basketPrune(){const b=basket(),ok=b.filter(id=>fsx.db.scores[id]&&!fsx.db.scores[id].missing);if(ok.length!==b.length)fsx.db.basket=ok}
function basketSet(ids,on){const b=basket();for(const id of ids){const i=b.indexOf(id);if(on&&i<0)b.push(id);if(!on&&i>=0)b.splice(i,1)}saveSoon();basketRender();render()}
function basketBtn(){const b=$('#e-basket');if(!st.cur){return}const on=inBasket(st.cur.id);b.textContent=on?'🧺 바구니에서 빼기':'🧺 콘티 바구니에 담기';b.classList.toggle('off',on)}
$('#e-basket').onclick=()=>{if(!st.cur)return;basketSet([st.cur.id],!inBasket(st.cur.id));basketBtn()};
$('#bbasket').onclick=()=>{if(!st.sel.size)return;const n=st.sel.size;basketSet([...st.sel],true);st.sel.clear();render();alert(`${n}곡을 콘티 바구니에 담았습니다.`)};
function songFromItem(it){
  const k=normT(it.title),files=libItems().filter(x=>normT(x.title)===k).map(x=>x.id);
  return {title:it.title,canon:k,key:it.key||'',refrain:false,note:'',special:false,sec:'',files:files.includes(it.id)?files:[it.id,...files],file:it.id,print:true};
}
function basketRender(){
  if(!fsx.db)return;basketPrune();const b=basket();$('#bkn').textContent=b.length;
  $('#bklist').innerHTML=b.map((id,i)=>{const s=fsx.db.scores[id];return `<div class="bki" data-i="${i}"><span class="t" title="${esc(id)}">${esc(s.title)}${s.key?` (${esc(s.key)})`:''}</span><button data-a="up" ${i?'':'disabled'}>▲</button><button data-a="dn" ${i<b.length-1?'':'disabled'}>▼</button><button data-a="rm">✕</button></div>`}).join('')||'<p style="color:var(--mut);font-size:12px;margin:0">비어 있습니다.</p>';
  $('#bklist').querySelectorAll('.bki').forEach(row=>row.querySelectorAll('button').forEach(bt=>bt.onclick=()=>{
    const i=+row.dataset.i,a=bt.dataset.a;
    if(a==='rm')b.splice(i,1);else{const j=a==='up'?i-1:i+1;[b[i],b[j]]=[b[j],b[i]]}
    saveSoon();basketRender();render()}));
  $('#bknew').disabled=!b.length;$('#bkclear').disabled=!b.length;
  const c2=$('#bkclear2');c2.style.display=b.length?'':'none';c2.textContent=`🧺 바구니 비우기 (${b.length})`;
}
$('#bkclear2').onclick=$('#bkclear').onclick=()=>{if(!basket().length||!confirm('콘티 바구니를 비울까요?'))return;fsx.db.basket=[];saveSoon();basketRender();render()};
$('#bknew').onclick=()=>{
  const b=basket();if(!b.length)return;
  const c={id:'n'+Date.now(),date:todayStr(),type:'금요기도회',service:'금요기도회 찬양',subtitle:'',theme:'',songs:b.map(id=>songFromItem({id,...fsx.db.scores[id]})),notes:''};
  contis().push(c);C.sel=c;C.jump=true;
  if(confirm(`바구니의 ${b.length}곡으로 새 콘티를 만들었습니다.\n바구니를 비울까요?`))fsx.db.basket=[];
  saveSoon();basketRender();render();renderContiList();renderContiDetail();
};
