"use strict";
const $ = s => document.querySelector(s);
const status = text => { $("#status").textContent = text; };
let settings = {weather:"off",intensity:"medium",paw:"off"};
async function request(type, data={}) { const result=await chrome.runtime.sendMessage({type,...data}); if(!result?.ok) throw Error(result?.error||"요청 실패"); return result; }
async function refreshAlarms(){const {alarms}=await request("list");const ul=$("#alarms");ul.replaceChildren();if(!alarms.length){const li=document.createElement("li");li.textContent="예약된 알람이 없어요.";ul.append(li);}for(const alarm of alarms){const li=document.createElement("li"),text=document.createElement("span"),date=document.createElement("small"),remove=document.createElement("button");text.textContent=alarm.title;date.textContent=new Date(alarm.when).toLocaleString("ko-KR");text.append(date);remove.textContent="삭제";remove.type="button";remove.setAttribute("aria-label",`${alarm.title} 알람 삭제`);remove.onclick=async()=>{try{await request("remove",{id:alarm.id});await refreshAlarms();}catch{status("알람을 삭제하지 못했어요.");}};li.append(text,remove);ul.append(li);}}
async function init(){try{const data=await chrome.storage.local.get(["settings","memo"]);settings={...settings,...data.settings};for(const key of ["weather","intensity","paw"]){$("#"+key).value=settings[key];$("#"+key).addEventListener("change",async e=>{settings[key]=e.target.value;try{await chrome.storage.local.set({settings});status("효과 설정을 저장했어요.");}catch{status("설정을 저장하지 못했어요.");}});}$("#memo").value=data.memo||"";await refreshAlarms();}catch{status("정보를 불러오지 못했어요. 창을 다시 열어주세요.");}}
// Save each edit and consume a standalone secret-command line.
let memoQueue=Promise.resolve(), openingGame=false;
function saveMemo(memo){
  $("#memo-status").textContent="저장 중…";
  memoQueue=memoQueue.catch(()=>{}).then(()=>chrome.storage.local.set({memo}));
  memoQueue.then(()=>{$("#memo-status").textContent="자동 저장됨";},()=>{$("#memo-status").textContent="저장 실패 · 다시 입력해주세요";});
  return memoQueue;
}
async function handleMemo(event){
  if(event.isComposing)return;
  const lines=$("#memo").value.split("\n");
  const index=lines.findIndex(line=>line.trim().toLowerCase()==="/doom");
  if(index<0||openingGame){saveMemo($("#memo").value);return;}
  openingGame=true;
  lines.splice(index,1);
  $("#memo").value=lines.join("\n");
  try{
    await saveMemo($("#memo").value);
    await chrome.tabs.create({url:chrome.runtime.getURL("game.html")});
    window.close();
  }catch{status("게임을 열지 못했어요. 메모장에 /doom을 다시 입력해주세요.");}
  finally{openingGame=false;}
}
$("#memo").addEventListener("input",handleMemo);
$("#memo").addEventListener("compositionend",handleMemo);
$("#alarm-form").addEventListener("submit",async e=>{e.preventDefault();const title=$("#alarm-title").value.trim(),when=new Date($("#alarm-time").value).getTime();if(!title||!Number.isFinite(when)||when<=Date.now()){status("내용과 미래 시간을 입력해주세요.");return;}const button=e.submitter;button.disabled=true;try{await request("add",{title,when});e.target.reset();await refreshAlarms();status("알람을 예약했어요.");}catch(error){status(error.message);}finally{button.disabled=false;}});
init();
