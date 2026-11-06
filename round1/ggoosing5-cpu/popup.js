"use strict";
const $ = selector => document.querySelector(selector);
const form = $('#todo-form'), input = $('#todo-input'), dateInput = $('#schedule-date'), timeInput = $('#schedule-time');
const add = $('#add'), cancel = $('#cancel-edit'), list = $('#todo-list'), message = $('#message');
const bulkInput = $('#bulk-input'), bulkAdd = $('#bulk-add');
const tabs = [...document.querySelectorAll('[data-view]')];
let todos = [], busy = false, ready = false, editingId = null, view = 'today';
function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dateKey(date) === value;
}
function shiftDate(key, amount) {
  const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate()+amount); return dateKey(date);
}
function monday(key) {
  return shiftDate(key, -((new Date(`${key}T12:00:00`).getDay()+6)%7));
}
function normalize(todo) {
  const scheduledDate = validDate(todo.scheduledDate) ? todo.scheduledDate : validDate(todo.createdDate) ? todo.createdDate : null;
  return { ...todo, scheduledDate, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(todo.time || '') ? todo.time : '' };
}
let today = dateKey(), weekStart = monday(today);
function setControls() {
  for (const control of [input,dateInput,timeInput,add,bulkInput,bulkAdd,cancel]) control.disabled = busy || !ready;
}
function resetEditor() {
  editingId = null; input.value = ''; dateInput.value = dateKey(); timeInput.value = '';
  add.textContent = '추가'; cancel.hidden = true; $('#editor-title').textContent = '새로운 일정';
}
function startEdit(todo) {
  if (busy) return;
  editingId = todo.id; input.value = todo.text; dateInput.value = todo.scheduledDate || '';
  timeInput.value = todo.time; add.textContent = '저장'; cancel.hidden = false;
  $('#editor-title').textContent = '일정 수정'; input.focus(); form.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function rowFor(todo) {
  const row = document.createElement('li'); row.classList.toggle('done', todo.done);
  const label = document.createElement('label'), check = document.createElement('input');
  check.type = 'checkbox'; check.checked = todo.done; check.disabled = busy;
  check.addEventListener('change', () => save(todos.map(item=>item.id===todo.id?{...item,done:check.checked}:item)));
  const text = document.createElement('span'); text.className='todo-text';
  const title = document.createElement('span'); title.textContent=todo.text;
  const date = document.createElement('small'); date.className='todo-date';
  date.textContent = `${todo.scheduledDate || '날짜 미지정'}${todo.time ? ` · ${todo.time}` : ''}`;
  text.append(title,date); label.append(check,text);
  const actions=document.createElement('div'); actions.className='row-actions';
  const edit=document.createElement('button'); edit.type='button'; edit.className='edit'; edit.textContent='수정'; edit.disabled=busy;
  edit.setAttribute('aria-label',`${todo.text} 수정`); edit.addEventListener('click',()=>startEdit(todo));
  const remove=document.createElement('button'); remove.type='button'; remove.className='delete'; remove.textContent='삭제'; remove.disabled=busy;
  remove.setAttribute('aria-label',`${todo.text} 삭제`);
  remove.addEventListener('click',async()=>{if(await save(todos.filter(item=>item.id!==todo.id))){if(editingId===todo.id)resetEditor();}});
  actions.append(edit,remove); row.append(label,actions); return row;
}
function render() {
  today=dateKey();
  const overdue=todos.filter(t=>!t.done && t.scheduledDate && t.scheduledDate<today);
  $('#previous-badge').textContent=String(overdue.length);
  $('#remaining').textContent=`전체 남은 ${todos.filter(t=>!t.done).length}개`;
  tabs.forEach(tab=>{tab.setAttribute('aria-pressed',String(tab.dataset.view===view));});
  $('#week-navigation').hidden=view!=='week';
  $('#week-label').textContent=`${weekStart} ~ ${shiftDate(weekStart,6)}`;
  const titles={today:'오늘 일정',week:'주간 일정',previous:'이전 미완료 일정',all:'전체 일정'};
  $('#list-title').textContent=titles[view];
  $('#view-help').textContent=view==='previous'?'예정 날짜가 지난 미완료 일정입니다.':view==='all'?'날짜 미지정 일정과 완료한 일정도 모두 확인할 수 있어요.':'';
  let visible=todos.filter(t=>view==='all'||(view==='today'&&t.scheduledDate===today)||(view==='previous'&&overdue.includes(t))||(view==='week'&&t.scheduledDate>=weekStart&&t.scheduledDate<=shiftDate(weekStart,6)));
  visible.sort((a,b)=>(a.scheduledDate||'9999').localeCompare(b.scheduledDate||'9999')||(a.time||'99:99').localeCompare(b.time||'99:99'));
  list.replaceChildren();
  if(view==='week'){
    for(let day=0;day<7;day++){
      const key=shiftDate(weekStart,day), section=document.createElement('section'); section.className='day-section';
      const heading=document.createElement('h3'); heading.textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(`${key}T12:00:00`));
      section.append(heading); const entries=visible.filter(t=>t.scheduledDate===key);
      if(entries.length){const ul=document.createElement('ul');entries.forEach(t=>ul.append(rowFor(t)));section.append(ul);}
      else {const p=document.createElement('p');p.className='day-empty';p.textContent='일정 없음';section.append(p);}
      list.append(section);
    }
  } else { const ul=document.createElement('ul');visible.forEach(t=>ul.append(rowFor(t)));list.append(ul); }
  $('#empty').hidden=visible.length>0||view==='week';
  $('#empty').textContent=view==='previous'?'이전 미완료 일정이 없어요.':'표시할 일정이 없어요.';
}
async function save(next) {
  if(busy||!ready)return false;
  busy=true;setControls();render();
  try{await chrome.storage.local.set({todos:next});todos=next;message.textContent='';return true;}
  catch{message.textContent='저장하지 못했어요. 다시 시도해 주세요.';return false;}
  finally{busy=false;setControls();render();}
}
function editorValues(){
  const text=input.value.trim(), scheduledDate=dateInput.value, time=timeInput.value;
  if(!text||text.length>200){message.textContent='일정 내용을 1~200자로 입력해 주세요.';input.focus();return null;}
  if(!validDate(scheduledDate)){message.textContent='일정 날짜를 선택해 주세요.';dateInput.focus();return null;}
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){message.textContent='올바른 시간을 입력해 주세요.';return null;}
  return {text,scheduledDate,time};
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!ready)return;
  const values=editorValues();if(!values)return;
  const editId=editingId;
  const next=editId?todos.map(t=>t.id===editId?{...t,...values}:t):[...todos,{id:crypto.randomUUID(),...values,done:false,createdDate:dateKey()}];
  if(await save(next)){
    view='week';weekStart=monday(values.scheduledDate);resetEditor();render();message.textContent=editId?'일정을 수정했어요.':'일정을 추가했어요.';
  }
});
cancel.addEventListener('click',()=>{resetEditor();message.textContent='';});
$('#bulk-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!ready)return;
  const lines=bulkInput.value.split(/\r\n|\n|\r/).map(s=>s.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s*)?/,'').trim()).filter(Boolean);
  if(!lines.length||lines.some(s=>s.length>200)){message.textContent='일정을 한 줄에 하나씩, 각 200자 이내로 입력해 주세요.';return;}
  if(!validDate(dateInput.value)){message.textContent='붙여넣은 일정을 추가할 날짜를 먼저 선택해 주세요.';return;}
  const scheduledDate=dateInput.value;
  const next=lines.map(text=>({id:crypto.randomUUID(),text,done:false,scheduledDate,time:'',createdDate:dateKey()}));
  if(await save([...todos,...next])){bulkInput.value='';view='week';weekStart=monday(scheduledDate);render();message.textContent=`${scheduledDate}에 ${lines.length}개 일정을 추가했어요.`;}
});
tabs.forEach(tab=>tab.addEventListener('click',()=>{view=tab.dataset.view;render();}));
$('#week-prev').addEventListener('click',()=>{weekStart=shiftDate(weekStart,-7);render();});
$('#week-next').addEventListener('click',()=>{weekStart=shiftDate(weekStart,7);render();});
$('#week-current').addEventListener('click',()=>{weekStart=monday(dateKey());render();});
if(new URLSearchParams(location.search).has('wide'))document.documentElement.classList.add('wide');
$('#open-wide').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html?wide=1')}));
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.todos&&ready&&!busy){todos=clean(changes.todos.newValue);render();}
});
function clean(items){return Array.isArray(items)?items.filter(t=>t&&typeof t.id==='string'&&typeof t.text==='string'&&t.text.trim()&&typeof t.done==='boolean').map(normalize):[];}
async function init(){
  try{
    const imports=[{key:'import_dinner_20261105_v1',id:'dinner-20261105-friend-a',text:'친구 A와 저녁식사 19시',date:'2026-11-05',time:'19:00'},{key:'import_dinner_20261104_friend_b_v1',id:'dinner-20261104-friend-b',text:'친구 B와 저녁식사 17시',date:'2026-11-04',time:'17:00'}];
    const stored=await chrome.storage.local.get(['todos',...imports.map(t=>t.key)]);
    todos=clean(stored.todos); const updates={};
    for(const entry of imports){if(!stored[entry.key]){if(!todos.some(t=>t.id===entry.id||(t.scheduledDate===entry.date&&t.text===entry.text)))todos.push({id:entry.id,text:entry.text,scheduledDate:entry.date,createdDate:entry.date,time:entry.time,done:false});updates[entry.key]=true;}}
    if(Object.keys(updates).length||JSON.stringify(todos)!==JSON.stringify(stored.todos||[]))await chrome.storage.local.set({todos,...updates});
    ready=true;resetEditor();setControls();render();
  }catch{message.textContent='목록을 불러오지 못했어요. 창을 다시 열어 주세요.';}
}
init();
setInterval(()=>{if(dateKey()!==today){weekStart=monday(dateKey());render();}},1000);
