/* Raju's ScoreBox — 백업 · 복원 */
/* ================= 백업 · 복원 (scorebox_data.json → 백업 폴더) ================= */
const BK={handle:null,keep:30};
const bkStamp=(withTime)=>{const t=new Date(),p=n=>String(n).padStart(2,'0');return `${t.getFullYear()}-${p(t.getMonth()+1)}-${p(t.getDate())}`+(withTime?`_${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`:'')};
async function bkDir(ask){
  const h=BK.handle||(BK.handle=await kvGet('backupDir'));if(!h)return null;
  try{let ok=await h.queryPermission({mode:'readwrite'})==='granted';if(!ok&&ask)ok=await h.requestPermission({mode:'readwrite'})==='granted';return ok?h:null}catch(e){return null}
}
async function bkList(dir){const out=[];for await(const [n,h] of dir.entries())if(h.kind==='file'&&/^scorebox_data_.*\.json$/.test(n))out.push(n);return out.sort().reverse()}
async function bkWrite(dir,name,text){const w=await (await dir.getFileHandle(name,{create:true})).createWritable();await w.write(text);await w.close()}
async function bkPrune(dir){const auto=(await bkList(dir)).filter(n=>/^scorebox_data_\d{4}-\d\d-\d\d(_\d{6})?\.json$/.test(n));for(const n of auto.slice(BK.keep))try{await dir.removeEntry(n)}catch(e){}}
async function backupAuto(){  // 앱을 열 때 하루 한 번
  try{const dir=await bkDir(false);if(!dir||!fsx.db)return;const name=`scorebox_data_${bkStamp(false)}.json`;
    try{await dir.getFileHandle(name);return}catch(e){if(e.name!=='NotFoundError')return}
    await bkWrite(dir,name,JSON.stringify(fsx.db,null,1));await bkPrune(dir)}catch(e){}
}
async function backupNow(){const dir=await bkDir(true);if(!dir)throw new Error('백업 폴더를 먼저 지정하세요');const name=`scorebox_data_${bkStamp(true)}.json`;await bkWrite(dir,name,JSON.stringify(fsx.db,null,1));await bkPrune(dir);return name}
async function bkRestore(dir,name){
  const data=JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
  if(!data||typeof data!=='object'||!data.scores)throw new Error('ScoreBox 데이터 파일이 아닙니다');
  if(fsx.db)await bkWrite(dir,`scorebox_data_${bkStamp(true)}_before_restore.json`,JSON.stringify(fsx.db,null,1));
  fsx.db=data;await saveDb();
}
async function bkRender(){
  const h=BK.handle||(BK.handle=await kvGet('backupDir')),dir=await bkDir(false);
  $('#bk-dir').textContent=h?(dir?h.name:`${h.name} (접근 허용 필요 — "지금 백업"을 누르면 허용 창이 뜹니다)`):'지정 안 됨';
  const box=$('#bk-list');if(!dir){box.innerHTML='<p style="color:var(--mut);font-size:12px">백업 폴더를 지정하면 목록이 보입니다.</p>';return}
  const names=await bkList(dir);
  box.innerHTML=names.map(n=>`<div class="tri"><span class="t">${esc(n)}</span><button data-n="${esc(n)}">이 백업으로 복원</button></div>`).join('')||'<p style="color:var(--mut);font-size:12px">아직 백업이 없습니다.</p>';
  box.querySelectorAll('button[data-n]').forEach(b=>b.onclick=async()=>{
    if(!confirm(`${b.dataset.n} 으로 복원합니다.\n지금 데이터는 '…_before_restore.json' 으로 먼저 백업됩니다. 계속할까요?`))return;
    try{await bkRestore(dir,b.dataset.n);await load();$('#bk-msg').textContent='복원했습니다: '+b.dataset.n;bkRender()}catch(e){alert('복원하지 못했습니다: '+e.message)}});
}
$('#bkupbtn').onclick=()=>{$('#bk-msg').textContent='';$('#bkdlg').showModal();bkRender()};
$('#bk-close').onclick=()=>$('#bkdlg').close();
$('#bk-pick').onclick=async()=>{
  try{let h=await showDirectoryPicker({id:'scorebox-backup',mode:'readwrite',startIn:'documents'});
    if(h.name.toLowerCase()!=='backup')h=await h.getDirectoryHandle('backup',{create:true});
    BK.handle=h;await kvSet('backupDir',h);$('#bk-msg').textContent=`백업 폴더: ${h.name}`;await backupAuto();bkRender()}
  catch(e){if(e.name!=='AbortError')alert('폴더를 지정하지 못했습니다: '+e.message)}};
$('#bk-now').onclick=async()=>{try{const n=await backupNow();$('#bk-msg').textContent='백업했습니다: '+n;bkRender()}catch(e){alert(e.message)}};
/* 시작 화면: 데이터 파일이 망가졌을 때 최근 백업으로 복원 */
$('#btn-restore').onclick=async()=>{
  const dir=await bkDir(true);if(!dir){alert('백업 폴더가 지정되어 있지 않거나 접근이 허용되지 않았습니다.');return}
  const names=(await bkList(dir));if(!names.length){alert('백업 파일이 없습니다.');return}
  if(!confirm(`가장 최근 백업(${names[0]})으로 복원할까요?`))return;
  try{const data=JSON.parse(await (await (await dir.getFileHandle(names[0])).getFile()).text());fsx.db=data;await saveDb();$('#btn-restore').style.display='none';
    const r=await scanFs();await load();$('#start').style.display='none'}catch(e){alert('복원하지 못했습니다: '+e.message)}
};
