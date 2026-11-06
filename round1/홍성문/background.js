"use strict";
// Serialize popup requests and alarm deliveries to avoid lost storage updates.
let queue=Promise.resolve();
function enqueue(job){const next=queue.then(job);queue=next.catch(()=>{});return next;}
const prefix="mood:";
async function entries(){return (await chrome.storage.local.get("reminders")).reminders||[];}
async function notify(item){await chrome.notifications.create(item.id,{type:"basic",iconUrl:"icon.png",title:"무드 브라우저 알람",message:item.title+(item.when<Date.now()-60000?" (놓친 알람)":""),priority:2});}
async function deliver(id){const all=await entries(),item=all.find(a=>a.id===id);if(!item)return;await notify(item);await chrome.storage.local.set({reminders:all.filter(a=>a.id!==id)});await chrome.alarms.clear(id);}
async function restore(){for(const item of await entries()){if(item.when<=Date.now())await deliver(item.id);else await chrome.alarms.create(item.id,{when:item.when});}}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name.startsWith(prefix))enqueue(()=>deliver(alarm.name)).catch(console.error);});
chrome.runtime.onStartup.addListener(()=>enqueue(restore).catch(console.error));
chrome.runtime.onInstalled.addListener(()=>enqueue(restore).catch(console.error));
chrome.runtime.onMessage.addListener((message,sender,respond)=>{if(sender.id!==chrome.runtime.id||sender.tab)return false;enqueue(async()=>{if(message.type==="list")return {alarms:await entries()};if(message.type==="add"){if(typeof message.title!=="string"||!message.title.trim()||!Number.isFinite(message.when)||message.when<=Date.now())throw Error("내용과 미래 시간을 입력해주세요.");const all=await entries(),item={id:prefix+crypto.randomUUID(),title:message.title.trim().slice(0,100),when:message.when};await chrome.storage.local.set({reminders:[...all,item]});try{await chrome.alarms.create(item.id,{when:item.when});}catch(error){await chrome.storage.local.set({reminders:all});throw error;}return {};}if(message.type==="remove"){await chrome.storage.local.set({reminders:(await entries()).filter(a=>a.id!==message.id)});await chrome.alarms.clear(message.id);return {};}throw Error("알 수 없는 요청");}).then(data=>respond({ok:true,...data}),()=>respond({ok:false,error:"처리하지 못했어요. 다시 시도해주세요."}));return true;});
