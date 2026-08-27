const oldList=document.getElementById('oldList');
const newList=document.getElementById('newList');
const result=document.getElementById('result');
const accountants=document.getElementById('accountants');
const message=document.getElementById('message');
const total=document.getElementById('totalNames');
const updated=document.getElementById('updatedNames');
const added=document.getElementById('newNames');
const accountantCount=document.getElementById('accountantCount');
const warningOldList=document.getElementById('warningOldList');
const warningNewList=document.getElementById('warningNewList');
const warningTableBody=document.getElementById('warningTableBody');
const warningResult=document.getElementById('warningResult');
const warningMessage=document.getElementById('warningMessage');
const prepareWarningsBtn=document.getElementById('prepareWarningsBtn');
const applyWarningsBtn=document.getElementById('applyWarningsBtn');
function normalize(name){return name.trim().toLowerCase();}
function save(){
 localStorage.setItem('discord_old_list',oldList.value); localStorage.setItem('discord_new_list',newList.value);
 localStorage.setItem('discord_result',result.value); localStorage.setItem('discord_accountants',accountants.value);
 localStorage.setItem('warning_old_list',warningOldList.value); localStorage.setItem('warning_new_list',warningNewList.value); localStorage.setItem('warning_result',warningResult.value);
}
function show(text,type='ok'){message.textContent=text;message.className='message show '+(type==='ok'?'ok':'err');setTimeout(()=>message.className='message',4000);}
function showWarning(text,type='ok'){warningMessage.textContent=text;warningMessage.className='message show '+(type==='ok'?'ok':'err');setTimeout(()=>warningMessage.className='message',4000);}
function processLists(){
 const users=new Map(), accountantMap=new Map(); let updateCount=0,newCount=0;
 oldList.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const index=line.lastIndexOf('=');if(index>0){const name=line.slice(0,index).trim(),count=Number(line.slice(index+1).trim());if(name&&Number.isFinite(count)&&count>=0)users.set(normalize(name),{name,count});}});
 accountants.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(name=>accountantMap.set(normalize(name),name));
 newList.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(name=>{const key=normalize(name);if(users.has(key)){const user=users.get(key);user.count++;updateCount++;if(user.count===3){accountantMap.set(key,user.name);users.delete(key);}}else if(!accountantMap.has(key)){users.set(key,{name,count:1});newCount++;}});
 result.value=[...users.values()].map(u=>`${u.name} =${u.count}`).join('\n'); accountants.value=[...accountantMap.values()].join('\n');
 newList.value=newList.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).filter(name=>!accountantMap.has(normalize(name))).join('\n');
 total.textContent=users.size;updated.textContent=updateCount;added.textContent=newCount;accountantCount.textContent=accountantMap.size;save();
 show([...accountantMap.values()].length?`تمت المعالجة. تم نقل ${accountantMap.size} اسم إلى المحاسبين.`:'تمت المعالجة بنجاح.');
}
async function copyText(text,emptyMessage){if(!text.trim()){show(emptyMessage,'err');return;}try{await navigator.clipboard.writeText(text);}catch{const temp=document.createElement('textarea');temp.value=text;document.body.appendChild(temp);temp.select();document.execCommand('copy');temp.remove();}show('تم النسخ بنجاح ✅');}
async function copyWarningText(){if(!warningResult.value.trim()){showWarning('لا توجد نتيجة في جرد التحاذير لنسخها.','err');return;}try{await navigator.clipboard.writeText(warningResult.value);}catch{const temp=document.createElement('textarea');temp.value=warningResult.value;document.body.appendChild(temp);temp.select();document.execCommand('copy');temp.remove();}showWarning('تم نسخ جرد التحاذير بنجاح ✅');}
function clearAll(){if(!confirm('هل أنت متأكد من مسح جميع البيانات؟'))return;[oldList,newList,result,accountants,warningOldList,warningNewList,warningResult].forEach(x=>x.value='');[total,updated,added,accountantCount].forEach(x=>x.textContent='0');warningTableBody.innerHTML='<tr><td colspan="5" class="empty-row">أضف أسماء جديدة ثم اضغط «توزيع الأسماء في جدول».</td></tr>';applyWarningsBtn.disabled=true;['discord_old_list','discord_new_list','discord_result','discord_accountants','warning_old_list','warning_new_list','warning_result'].forEach(k=>localStorage.removeItem(k));show('تم مسح جميع البيانات.');}
function getWarningNames(){const seen=new Set(),names=[];warningNewList.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(name=>{const key=normalize(name);if(!seen.has(key)){seen.add(key);names.push(name);}});return names;}
function prepareWarnings(){const names=getWarningNames();if(!names.length){warningTableBody.innerHTML='<tr><td colspan="5" class="empty-row">لم تتم إضافة أي أسماء جديدة.</td></tr>';applyWarningsBtn.disabled=true;showWarning('أضف اسماً واحداً على الأقل ثم أعد المحاولة.','err');return;}warningTableBody.innerHTML='';names.forEach((name,index)=>{const row=document.createElement('tr');row.dataset.name=name;row.innerHTML=`<td class="name-cell">${escapeHtml(name)}</td><td>${warningCheckbox(index,3,'شفهي')}</td><td>${warningCheckbox(index,5,'الأول')}</td><td>${warningCheckbox(index,7,'الثاني')}</td><td>${warningCheckbox(index,10,'الثالث')}</td>`;warningTableBody.appendChild(row);});applyWarningsBtn.disabled=false;showWarning(`تم توزيع ${names.length} اسم في الجدول. اختر تحذيراً لكل اسم.`);}
function warningCheckbox(index,value,label){return `<label class="warning-choice"><input type="checkbox" name="warning_${index}_${value}" value="${value}"><span class="choice-box"><span class="choice-label">${label}</span><small>+${value}</small></span></label>`;}
function parseWarningList(text){const users=new Map();text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const index=line.lastIndexOf('=');if(index>0){const name=line.slice(0,index).trim(),value=Number(line.slice(index+1).trim());if(name&&Number.isFinite(value))users.set(normalize(name),{name,value});}});return users;}
function applyWarnings(){const rows=[...warningTableBody.querySelectorAll('tr[data-name]')];if(!rows.length){showWarning('وزّع الأسماء في الجدول أولاً.','err');return;}const users=parseWarningList(warningOldList.value);let updatedCount=0,addedCount=0,skippedCount=0;rows.forEach(row=>{const selected=[...row.querySelectorAll('input[type="checkbox"]:checked')];if(!selected.length){skippedCount++;row.classList.add('missing-choice');return;}row.classList.remove('missing-choice');const name=row.dataset.name,key=normalize(name),value=selected.reduce((sum,input)=>sum+Number(input.value),0);if(users.has(key)){users.get(key).value+=value;updatedCount++;}else{users.set(key,{name,value});addedCount++;}});if(skippedCount){showWarning(`اختر نوع التحذير لكل الأسماء أولاً. المتبقي: ${skippedCount}.`,'err');return;}// خصم نقطة واحدة من كل اسم بعد إتمام معالجة جميع التحاذيرات، بحد أدنى صفر
users.forEach(user=>{user.value=Math.max(0,user.value-1);});
warningResult.value=[...users.values()].map(u=>`${u.name} =${u.value}`).join('\n');warningOldList.value=warningResult.value;warningNewList.value='';warningTableBody.innerHTML='<tr><td colspan="5" class="empty-row">تمت إضافة التحاذيرات بنجاح. أضف أسماء جديدة للدفعة التالية.</td></tr>';applyWarningsBtn.disabled=true;save();showWarning(`تم تحديث ${updatedCount} اسم وإضافة ${addedCount} اسم جديد بنجاح.`);}
function escapeHtml(value){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
document.getElementById('processBtn').onclick=processLists;document.getElementById('copyBtn').onclick=()=>copyText(result.value,'لا توجد نتيجة لنسخها.');document.getElementById('copyAccountantsBtn').onclick=()=>copyText(accountants.value,'لا توجد أسماء في المحاسبين.');document.getElementById('clearBtn').onclick=clearAll;prepareWarningsBtn.onclick=prepareWarnings;applyWarningsBtn.onclick=applyWarnings;document.getElementById('copyWarningsBtn').onclick=copyWarningText;
[oldList,newList,warningOldList,warningNewList].forEach(x=>x.oninput=save);
oldList.value=localStorage.getItem('discord_old_list')||'';newList.value=localStorage.getItem('discord_new_list')||'';result.value=localStorage.getItem('discord_result')||'';accountants.value=localStorage.getItem('discord_accountants')||'';warningOldList.value=localStorage.getItem('warning_old_list')||'';warningNewList.value=localStorage.getItem('warning_new_list')||'';warningResult.value=localStorage.getItem('warning_result')||'';accountantCount.textContent=accountants.value.split(/\r?\n/).filter(Boolean).length;
