const DB_NAME='arcana-db', DB_VERSION=1;
let db;
const $=id=>document.getElementById(id);
const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('docs',{keyPath:'id'});d.createObjectStore('chunks',{keyPath:'id'});d.createObjectStore('notes',{keyPath:'id'});d.createObjectStore('settings',{keyPath:'key'});d.createObjectStore('messages',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
const put=(s,v)=>new Promise((res,rej)=>{let r=store(s,'readwrite').put(v);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const all=s=>new Promise((res,rej)=>{let r=store(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const del=(s,k)=>new Promise((res,rej)=>{let r=store(s,'readwrite').delete(k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const get=(s,k)=>new Promise((res,rej)=>{let r=store(s).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random();
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showView(v){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$('view-'+v).classList.add('active');document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('pageTitle').textContent=({chat:'Ассистент',library:'Библиотека',notes:'Заметки',settings:'Настройки ИИ'})[v];$('sidebar').classList.remove('open');}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
document.querySelectorAll('.prompt').forEach(b=>b.onclick=()=>{$('question').value=b.dataset.prompt;sendQuestion()});
$('newChat').onclick=()=>{$('messages').innerHTML='';$('welcome').style.display='block';};
function splitChunks(text,size=1100,overlap=160){let out=[];for(let i=0;i<text.length;i+=size-overlap){let t=text.slice(i,i+size).trim();if(t.length>40)out.push(t);if(i+size>=text.length)break;}return out}
async function extractFile(file){
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='txt'||ext==='md')return await file.text();
 if(ext==='pdf'){
  if(!window.pdfjsLib)throw Error('PDF.js не загрузился. Для PDF требуется интернет при открытии приложения.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const data=new Uint8Array(await file.arrayBuffer()),pdf=await pdfjsLib.getDocument({data}).promise;let pages=[];
  for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),c=await p.getTextContent();pages.push(`\n[Страница ${n}]\n`+c.items.map(x=>x.str).join(' '));}
  return pages.join('\n');
 }
 throw Error('Формат пока не поддерживается: '+ext);
}
$('fileInput').onchange=async e=>{for(const file of e.target.files){try{toast('Читаю '+file.name+'…');const text=await extractFile(file);if(!text.trim())throw Error('Текст не найден. Возможно, это скан.');const id=uid(),parts=splitChunks(text);await put('docs',{id,name:file.name,type:file.type||file.name.split('.').pop(),chars:text.length,chunks:parts.length,added:new Date().toISOString()});for(let i=0;i<parts.length;i++)await put('chunks',{id:id+'-'+i,docId:id,docName:file.name,index:i,text:parts[i]});toast('Добавлено: '+file.name+' ('+parts.length+' фрагментов)');}catch(err){toast(file.name+': '+err.message)}}e.target.value='';renderLibrary()};
async function renderLibrary(){const docs=await all('docs');$('libraryList').innerHTML=docs.length?docs.map(d=>`<div class="doc-card"><div><b>▤ ${escapeHTML(d.name)}</b><small>${d.chunks} фрагм. · ${d.chars.toLocaleString('ru-RU')} символов · ${new Date(d.added).toLocaleDateString()}</small></div><button data-del="${d.id}">Удалить</button></div>`).join(''):'<div class="empty">Пока нет книг. Добавь первый материал.</div>';document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const id=b.dataset.del;for(const c of await all('chunks'))if(c.docId===id)await del('chunks',c.id);await del('docs',id);renderLibrary();toast('Материал удалён')})}
function terms(s){return (s.toLowerCase().match(/[а-яёa-z0-9]{3,}/g)||[]).filter(x=>!['это','как','что','для','или','при','про','его','её','они','она','the','and','for'].includes(x))}
async function searchLibrary(q,limit=7){const chunks=await all('chunks'),qs=[...new Set(terms(q))];if(!qs.length)return[];return chunks.map(c=>{const t=c.text.toLowerCase();let score=0;for(const w of qs){let at=0,n=0;while((at=t.indexOf(w,at))!==-1&&n<8){n++;at+=w.length}score+=n*(w.length>6?2:1)}return{...c,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit)}
function addMessage(role,text,sources=[]){$('welcome').style.display='none';const div=document.createElement('div');div.className='message '+role;div.textContent=text;if(sources.length){const s=document.createElement('div');s.className='sources';s.textContent='Источники из библиотеки: '+sources.map(x=>x.docName+' · фрагмент '+(x.index+1)).join('; ');div.appendChild(s)}$('messages').appendChild(div);$('messages').scrollTop=$('messages').scrollHeight}
async function getSettings(){const vals={};for(const k of ['aiMode','apiUrl','modelName','apiKey']){const x=await get('settings',k);vals[k]=x?.value||''}return vals}
async function answer(q){
 const hits=await searchLibrary(q,8),settings=await getSettings();
 const context=hits.map((h,i)=>`[Источник ${i+1}: ${h.docName}, фрагмент ${h.index+1}]\n${h.text}`).join('\n\n---\n\n');
 const system=`Ты ARCANA — исследовательский ассистент по Таро, рунам, символизму, истории эзотерических традиций и викканской практике. Отвечай по-русски, уважительно и без клише. Не поддакивай автоматически: проверяй логику, различай факт, мнение автора, историческую реконструкцию и современную эзотерическую интерпретацию. Не выдавай гадание за проверяемое установление фактов: карты и руны не могут достоверно подтвердить порчу, магическое воздействие, мысли другого человека или результат ритуала. Если контекста книг недостаточно, прямо скажи это и не выдумывай цитаты. При использовании контекста называй автора/книгу, если эти сведения есть.`;
 if(settings.aiMode==='remote'||settings.aiMode==='local'){
  if(!settings.apiUrl||!settings.modelName)throw Error('Заполни адрес API и название модели в настройках.');
  const response=await fetch(settings.apiUrl,{method:'POST',headers:{'Content-Type':'application/json',...(settings.apiKey?{Authorization:'Bearer '+settings.apiKey}:{})},body:JSON.stringify({model:settings.modelName,messages:[{role:'system',content:system+'\n\nФрагменты книг пользователя:\n'+(context||'Релевантных фрагментов в библиотеке не найдено.')},{role:'user',content:q}],temperature:0.5})});
  if(!response.ok)throw Error('Ошибка API '+response.status+': '+(await response.text()).slice(0,300));
  const data=await response.json();return{text:data.choices?.[0]?.message?.content||'Сервер вернул пустой ответ.',sources:hits};
 }
 if(!hits.length)return{text:'В локальной библиотеке пока не нашлось подходящих фрагментов. Добавь книги или подключи ИИ в настройках, чтобы получить ответ с более широкими знаниями. Я не буду придумывать содержание источников.',sources:[]};
 return{text:'Я нашёл совпадающие фрагменты в твоей библиотеке, но генеративный ИИ пока не подключён. Ниже — материалы для самостоятельного анализа:\n\n'+hits.slice(0,5).map((h,i)=>`${i+1}. ${h.docName}, фрагмент ${h.index+1} (совпадение: ${h.score})\n${h.text.slice(0,850)}${h.text.length>850?'…':''}`).join('\n\n')+'\n\nПодключи модель в настройках, чтобы я мог сопоставлять источники и формировать развёрнутые ответы.',sources:hits};
}
async function sendQuestion(){const q=$('question').value.trim();if(!q)return;$('question').value='';addMessage('user',q);const wait=document.createElement('div');wait.className='message assistant';wait.textContent='Ищу материалы и формирую ответ…';$('messages').appendChild(wait);try{const r=await answer(q);wait.remove();addMessage('assistant',r.text,r.sources)}catch(e){wait.remove();addMessage('assistant','Не удалось получить ответ: '+e.message+'\n\nПроверь настройки подключения и доступность сервера.')}} 
$('chatForm').onsubmit=e=>{e.preventDefault();sendQuestion()};
$('question').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendQuestion()}};
$('saveNote').onclick=async()=>{const title=$('noteTitle').value.trim(),body=$('noteBody').value.trim();if(!title&&!body)return toast('Добавь текст заметки');await put('notes',{id:uid(),title:title||'Без названия',body,created:new Date().toISOString()});$('noteTitle').value='';$('noteBody').value='';renderNotes();toast('Заметка сохранена')};
async function renderNotes(){const notes=(await all('notes')).sort((a,b)=>b.created.localeCompare(a.created));$('notesList').innerHTML=notes.map(n=>`<div class="note-card"><div><b>${escapeHTML(n.title)}</b><small>${new Date(n.created).toLocaleString()}</small><p>${escapeHTML(n.body).slice(0,240)}</p></div><button data-note="${n.id}">Удалить</button></div>`).join('')||'<div class="empty">Заметок пока нет.</div>';document.querySelectorAll('[data-note]').forEach(b=>b.onclick=async()=>{await del('notes',b.dataset.note);renderNotes()})}
$('saveSettings').onclick=async()=>{for(const [key,id] of Object.entries({aiMode:'aiMode',apiUrl:'apiUrl',modelName:'modelName',apiKey:'apiKey'}))await put('settings',{key,value:$(id).value.trim()});$('settingsStatus').textContent='Настройки сохранены на этом устройстве.';toast('Настройки сохранены')};
$('testAI').onclick=async()=>{const s=await getSettings();if(s.aiMode==='library')return $('settingsStatus').textContent='Выбран режим локального поиска без генеративной модели.';try{const r=await fetch(s.apiUrl,{method:'POST',headers:{'Content-Type':'application/json',...(s.apiKey?{Authorization:'Bearer '+s.apiKey}:{})},body:JSON.stringify({model:s.modelName,messages:[{role:'user',content:'Ответь одним словом: подключение работает?'}],max_tokens:30})});$('settingsStatus').textContent=r.ok?'Подключение успешно.':'Сервер ответил ошибкой: '+r.status}catch(e){$('settingsStatus').textContent='Не удалось подключиться: '+e.message+' (возможен CORS или недоступный адрес)'}};
$('exportData').onclick=async()=>{const data={exported:new Date().toISOString(),docs:await all('docs'),chunks:await all('chunks'),notes:await all('notes')};const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='arcana-backup.json';a.click();URL.revokeObjectURL(url)};
$('clearData').onclick=async()=>{if(!confirm('Удалить все книги, фрагменты, заметки и настройки на этом устройстве?'))return;for(const name of ['docs','chunks','notes','settings','messages']){const tx=db.transaction(name,'readwrite');tx.objectStore(name).clear()}setTimeout(()=>{renderLibrary();renderNotes();toast('Локальные данные очищены')},200)};
async function init(){db=await openDB();await renderLibrary();await renderNotes();const s=await getSettings();for(const [k,v] of Object.entries(s))if($(k))$(k).value=v;if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
init().catch(e=>toast('Ошибка базы данных: '+e.message));
