const defaults=[['جندي',45,0,0,0],['جندي اول',45,0,0,0],['عريف',60,0,0,0],['وكيل رقيب',85,0,0,0],['رقيب',110,1,1,0],['رقيب اول',125,0,0,0],['رئيس رقباء',85,1,1,1],['ملازم',0,0,0,0]];
let rules=JSON.parse(localStorage.getItem('gta_rules_v2')||'null')||defaults.map(x=>({name:x[0],total:x[1],operations:!!x[2],department:!!x[3],saqa:!!x[4]}));
// ترقية البيانات القديمة: أضف رتبة ملازم إذا كانت غير موجودة في localStorage.
if(!rules.some(r=>r.name==="ملازم")){
  rules.push({name:"ملازم",total:0,operations:false,department:false,saqa:false});
  localStorage.setItem('gta_rules_v2',JSON.stringify(rules));
}
let soldiers=JSON.parse(localStorage.getItem('gta_soldiers_v2')||'[]');const $=id=>document.getElementById(id);
function saveData(){localStorage.setItem('gta_soldiers_v2',JSON.stringify(soldiers));}
function calc(s){
  let ci=rules.findIndex(r=>r.name===s.rank); if(ci<0) ci=0;
  let remaining=Number(s.total)||0, reached=ci, deductions=[];
  for(let i=ci;i<rules.length;i++){
    const r=rules[i];
    // ملازم لا يعتمد على المجموع العام؛ له شرط 100 سيناريو مستقل.
    if(r.name==="ملازم") break;
    if(remaining<r.total) break;
    remaining-=r.total;
    deductions.push({rank:r.name,required:r.total,remaining});
    reached=i+1;
  }

  let best=Math.min(reached,rules.length-1);
  // إذا كانت الرتبة الحالية رئيس رقباء واكتمل مجموعها المطلوب،
  // تكون الرتبة المستحقة ملازم.
  if(String(s.rank||"").trim()==="رئيس رقباء" && (Number(s.total)||0) >= (rules[ci]?.total || 100)){
    const lieutenantIndex=rules.findIndex(r=>r.name==="ملازم");
    if(lieutenantIndex>=0) best=lieutenantIndex;
  }
  const target=rules[best];
  const missing=[];

  if(target.name==="ملازم"){
    if((Number(s.recruitment)||0)<10) missing.push("التوظيف: "+(10-(Number(s.recruitment)||0)));
    if((Number(s.affairs)||0)<10) missing.push("ملفات الشؤون: "+(10-(Number(s.affairs)||0)));
    if(!s.saqa) missing.push("دورة الصاعقة");
  }else{
    if(target.name==="رئيس رقباء"){
      if(target.operations&&!s.operations) missing.push("مسؤول مركز العمليات");
      if(target.department&&!s.department) missing.push("دخول قسم/الكلية/الشؤون الداخلية");
    }else{
      if(target.operations&&!s.operations) missing.push("مسؤول مركز العمليات");
      if(target.department&&!s.department) missing.push("دخول قسم/الكلية/الشؤون الداخلية");
      if(target.saqa&&!s.saqa) missing.push("دورة الصاعقة");
    }
  }

  // عند اكتمال مجموع رئيس رقباء (85) أو أكثر، يعتبر العسكري مؤهلاً
  // حتى لو كانت شروط ملازم الإضافية ناقصة.
  const completedChiefSergeantTotal =
    s.rank==="رئيس رقباء" && (Number(s.total)||0) >= (rules[ci]?.total || 100);

  const numericalPromotion=best>ci;
  const eligible=(completedChiefSergeantTotal || numericalPromotion) && missing.length===0;

  const points=Math.floor(Math.max(0,(Number(s.total)||0)-rules[ci].total)/30);
  return {best,target,remaining,points,eligible,numericalPromotion,completedChiefSergeantTotal,conditionMissing:missing,deductions};
}
function render(){
  let q=$('search').value.trim().toLowerCase();
  soldiers.forEach(s=>{if(s.scenarios==null)s.scenarios=0;if(s.recruitment==null)s.recruitment=0;if(s.affairs==null)s.affairs=0;});
  let a=soldiers.map((s,i)=>({s,i,c:calc(s)})).filter(x=>x.s.name.toLowerCase().includes(q));
  $('body').innerHTML=a.map(x=>{
    let s=x.s,c=x.c,status;
    if(!c.numericalPromotion && !c.completedChiefSergeantTotal) status='<span class="bad">غير مؤهل</span>';
    else if(c.conditionMissing.length) status='<span class="ok">مؤهل</span><br><small class="missing">الناقص: '+c.conditionMissing.join(" • ")+'</small>';
    else status='<span class="ok">مؤهل</span>';
    return `<tr><td>${s.name}</td><td>${s.scenarios}</td><td>${s.total}</td><td>${s.rank}</td><td>${c.points}</td><td class="${c.numericalPromotion?'ok':''}">${c.target.name}</td><td>${c.remaining}</td><td><input type="checkbox" ${s.operations?'checked':''} onchange="flag(${x.i},'operations',this.checked)"></td><td><input type="checkbox" ${s.saqa?'checked':''} onchange="flag(${x.i},'saqa',this.checked)"></td><td><input type="checkbox" ${s.department?'checked':''} onchange="flag(${x.i},'department',this.checked)"></td><td><input type="number" min="0" value="${s.recruitment||0}" style="width:65px" onchange="numFlag(${x.i},'recruitment',this.value)"></td><td><input type="number" min="0" value="${s.affairs||0}" style="width:65px" onchange="numFlag(${x.i},'affairs',this.value)"></td><td>${status}</td></tr>`;
  }).join('')||'<tr><td colspan="13">لا توجد بيانات</td></tr>';
  $('total').textContent=soldiers.length;
  $('eligible').textContent=soldiers.filter(s=>calc(s).eligible).length;
  $('not').textContent=soldiers.filter(s=>!calc(s).eligible).length;
  $('points').textContent=soldiers.reduce((n,s)=>n+calc(s).points,0);
}
window.flag=(i,k,v)=>{soldiers[i][k]=v;saveData();render()};
window.numFlag=(i,k,v)=>{soldiers[i][k]=Math.max(0,Number(v)||0);saveData();render()};
$('process').onclick=()=>{
  let good=[],bad=[];
  $('input').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach((line,n)=>{
    // الجديد: @name : السيناريوهات : المجموع : الرتبة
    let m4=line.match(/^(.+?)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(.+?)\s*$/);
    // القديم: @name : المجموع : الرتبة
    let m3=line.match(/^(.+?)\s*:\s*(\d+)\s*:\s*(.+?)\s*$/);
    if(m4){
      good.push({name:m4[1].trim(),scenarios:+m4[2],total:+m4[3],rank:m4[4].trim(),operations:false,department:false,saqa:false,recruitment:0,affairs:0});
    }else if(m3){
      good.push({name:m3[1].trim(),scenarios:0,total:+m3[2],rank:m3[3].trim(),operations:false,department:false,saqa:false,recruitment:0,affairs:0});
    }else bad.push(n+1);
  });
  soldiers=good;saveData();render();
  $('msg').textContent=`تم تحليل ${good.length} سطر`+(bad.length?`، الأسطر غير المفهومة: ${bad.join(', ')}`:'');
};
$('sample').onclick=()=>{
  $('input').value='@mnykh : 100 : 541 : رئيس رقباء\n@iomar3z : 80 : 533 : رئيس رقباء\n@xyrn0 : 120 : 520 : رئيس رقباء\n@l1_0 : 70 : 480 : رقيب';
};
$('clear').onclick=()=>{$('input').value='';soldiers=[];saveData();render()};
$('search').oninput=render;
function drawRules(){$('rules').innerHTML=rules.map((r,i)=>`<div class="rule"><h3>${r.name}</h3><label>المجموع المطلوب<input type="number" data-i="${i}" data-k="total" value="${r.total}"></label><label class="check"><input type="checkbox" data-i="${i}" data-k="operations" ${r.operations?'checked':''}> مسؤول مركز العمليات</label><label class="check"><input type="checkbox" data-i="${i}" data-k="department" ${r.department?'checked':''}> قسم/كلية/شؤون</label><label class="check"><input type="checkbox" data-i="${i}" data-k="saqa" ${r.saqa?'checked':''}> دورة الصاعقة</label></div>`).join('')}
$('save').onclick=()=>{document.querySelectorAll('#rules [data-i]').forEach(e=>rules[+e.dataset.i][e.dataset.k]=e.type==='checkbox'?e.checked:+e.value);localStorage.setItem('gta_rules_v2',JSON.stringify(rules));render();alert('تم حفظ الشروط')};

function discordList(){
  return soldiers.map(s=>{
    const c=calc(s);
    let line=`${s.name} : ${s.scenarios} : ${s.total} : ${c.target.name}`;
    if(c.numericalPromotion && c.conditionMissing.length)
      line+=` - مؤهل (الناقص: ${c.conditionMissing.join("، ")})`;
    return line;
  }).join("\n");
}

$("copyDiscord").onclick=async()=>{
  const text=discordList();
  if(!text){alert("لا توجد قائمة لتصديرها");return;}
  try{
    await navigator.clipboard.writeText(text);
    alert("تم نسخ القائمة بصيغة الديسكورد");
  }catch(e){
    const ta=document.createElement("textarea");
    ta.value=text;document.body.appendChild(ta);ta.select();
    document.execCommand("copy");ta.remove();
    alert("تم نسخ القائمة بصيغة الديسكورد");
  }
};

$('export').onclick=()=>{
  const text=discordList();
  if(!text){alert("لا توجد قائمة لتصديرها");return;}
  const blob=new Blob(["\ufeff"+text],{type:"text/plain;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="قائمة_الترقيات_ديسكورد.txt";
  a.click();
  URL.revokeObjectURL(a.href);
};
drawRules();render();