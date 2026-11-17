const get=id=>document.getElementById(id);
const steps=[...document.querySelectorAll('.step')];
const states='Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming';
states.split('|').forEach(state=>get('state').add(new Option(state,state)));
const categories=['Rent / mortgage','Car payment','Groceries','Gas','Utilities','Insurance','Subscriptions','Dining out'];
categories.forEach((name,index)=>{
  const label=document.createElement('label');
  label.textContent=name+' ($)';
  const input=document.createElement('input');
  Object.assign(input,{type:'number',min:'0',step:'.01',placeholder:'0',id:'bill'+index});
  label.append(input);
  get('bills').append(label);
});
function addRow(container,title,amount,targetAmount=""){
  const row=document.createElement('div');
  row.className='row';
  row.innerHTML='<label>Category name<input maxlength="48"></label><label>Monthly amount ($)<input type="number" min="0" step=".01" placeholder="0"></label><button type="button" class="secondary" style="flex:0;min-width:auto">Remove</button>';
  const [name,value]=row.querySelectorAll('input');
  if(container==='goals'){
    value.parentElement.childNodes[0].textContent='Saved this month ($)';
    const target=document.createElement('label');
    target.innerHTML='Goal target ($)<input type="number" min="0" step=".01" placeholder="Optional">';
    target.querySelector('input').value=targetAmount;
    row.insertBefore(target,row.querySelector('button'));
  }
  name.placeholder=container==='goals'?'Trip or long-term goal':'Internet or other bill';
  name.required=true;
  name.value=title;
  value.value=amount;
  row.querySelector('button').onclick=()=>row.remove();
  get(container).append(row);
}
get('addBill').onclick=()=>addRow('extras','','');
get('addGoal').onclick=()=>addRow('goals','','');
let step=0;
const value=id=>Number(get(id).value)||0;
function showStep(index){
  step=index;
  const gross=get('basis').value==='gross';
  get('taxField').hidden=!gross;
  get('tax').required=gross;
  get('tax').disabled=!gross;
  get('deductionNote').textContent=gross?'Use the total withholding from your pay stub. Select your state for your profile.':'Your paycheck already reflects withholding. Contributions are shown separately on your profile.';
  steps.forEach((part,i)=>{
    part.hidden=i!==index;
    part.querySelectorAll('input,select').forEach(el=>el.disabled=i!==index||(el.id==='tax'&&!gross));
    const badge=document.querySelectorAll('.steps span')[i];
    badge.classList.toggle('active',i===index);
    if(i===index)badge.setAttribute('aria-current','step');else badge.removeAttribute('aria-current');
  });
  get('back').hidden=!index;
  get('next').textContent=index===3?'Create my profile':'Continue';
}
get('back').onclick=()=>showStep(step-1);
get('form').onsubmit=e=>{
  e.preventDefault();
  if(step===1&&get('basis').value==='gross'){
    const tax=get('tax');
    if(value('tax')+value('retirement')+value('hsa')+value('other')>=value('pay')){
      tax.setCustomValidity('Total deductions must be less than gross pay.');
      tax.reportValidity();
      tax.setCustomValidity('');
      return;
    }
  }
  if(step<3)showStep(step+1);else {persist();render();}
};
const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const money=n=>dollars.format(n);
const sum=list=>list.reduce((total,item)=>total+item[1],0);
const rows=id=>[...get(id).children].map(row=>{
  const [name,amount,target]=row.querySelectorAll('input');
  return [name.value.trim()||'Other',Number(amount.value)||0,Number(target?.value)||0];
});
function list(id,items,empty){
  const target=get(id);
  target.replaceChildren();
  if(!items.length)target.textContent=empty;
  items.forEach(([name,amount])=>{
    const row=document.createElement('div');
    row.className='line';
    const label=document.createElement('span');
    label.textContent=name;
    const number=document.createElement('strong');
    number.textContent=money(amount);
    row.append(label,number);
    target.append(row);
  });
}
function collect(){
  const monthly=Number(get('frequency').value)/12;
  const contributions=[['401(k)',value('retirement')*monthly],['HSA',value('hsa')*monthly],['Other deductions',value('other')*monthly]];
  const gross=get('basis').value==='gross';
  const income=Math.round((value('pay')*monthly-(gross?sum(contributions)+value('tax')*monthly:0))*100)/100;
  const bills=[...categories.map((name,i)=>[name,value('bill'+i)]),...rows('extras')].filter(item=>item[1]>0);
  const goals=rows('goals');
  return {income,bills,goals,contributions,profile:(get('name').value.trim()||'My budget')+' · '+get('state').value};
}
const storageKey='daybreak-budget-v1';
function readSaved(){
  try { return JSON.parse(localStorage.getItem(storageKey))||{}; }
  catch { return {}; }
}
let saved=readSaved();
let history=new Map(saved.history||[]);
function snapshot(){
  return {
    fields:Object.fromEntries(['name','pay','frequency','basis','state','retirement','hsa','other','tax']
      .map(id=>[id,get(id).value])),
    bills:categories.map((_,index)=>get('bill'+index).value),
    extras:rows('extras'),
    goals:rows('goals')
  };
}
function restore(data){
  if(!data){get('form').reset();}
  else {
    Object.entries(data.fields).forEach(([id,amount])=>get(id).value=amount);
    data.bills.forEach((amount,index)=>get('bill'+index).value=amount);
  }
  for(const container of ['extras','goals']){
    get(container).replaceChildren();
    for(const row of data?.[container]||[])addRow(container,...row);
  }
}
function persist(){
  if(sampleMode)return;
  saved={draft:snapshot(),history:[...history]};
  try {localStorage.setItem(storageKey,JSON.stringify(saved));}
  catch {get('recordMessage').textContent='Browser storage is unavailable. Changes will be lost when you close this page.';}
}
const formatter=new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
const monthLabel=key=>formatter.format(new Date(key+'-01T00:00:00Z'));
const totals=budget=>[budget.income,sum(budget.bills),sum(budget.goals),budget.income-sum(budget.bills)-sum(budget.goals)];
const today=new Date();
get('recordMonth').value=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
const palette=['#c76d54','#598ab7','#8070a8','#4f968b','#ba8648','#b96f90','#75849a','#8d9255'];
let sampleMode=false;
function charts(budget,key){
  const expense=sum(budget.bills);
  const stops=[];
  const legend=get('pieLegend');
  legend.replaceChildren();
  let start=0;
  budget.bills.forEach(([name,amount],index)=>{
    const color=palette[index%palette.length];
    const end=start+100*amount/expense;
    stops.push(color+' '+start+'% '+end+'%');
    start=end;
    const row=document.createElement('div');
    row.className='line';
    const label=document.createElement('span');
    const dot=document.createElement('i');
    dot.className='dot';
    dot.style.background=color;
    label.append(dot,name);
    const number=document.createElement('strong');
    number.textContent=money(amount)+' · '+Math.round(100*amount/expense)+'%';
    row.append(label,number);
    legend.append(row);
  });
  if(!expense)legend.textContent='Add expenses to see a category breakdown.';
  get('pie').hidden=!expense;
  get('pie').style.background=budget.bills.length===1?palette[0]:expense?'conic-gradient('+stops.join(',')+')':'none';
  get('pieMonth').textContent=key?monthLabel(key):'Current budget';
  const goalTotals=new Map();
  const budgets=[...history].sort(([a],[b])=>a.localeCompare(b))
    .filter(([month])=>!key||month<=key).map(([,entry])=>entry);
  if(!key&&!budgets.length)budgets.push(budget);
  for(const entry of budgets){
    for(const [name,amount,target] of entry.goals){
      const normalized=name.toLowerCase();
      const previous=goalTotals.get(normalized);
      goalTotals.set(normalized,[name,(previous?.[1]||0)+amount,target||previous?.[2]||0]);
    }
  }
  const progress=get('goalProgress');
  progress.replaceChildren();
  get('savingsNote').textContent=key?'Cumulative through '+monthLabel(key):history.size?'Cumulative across recorded months':'Current budget only';
  if(!goalTotals.size)progress.textContent='Add a goal to start tracking your savings.';
  for(const [name,amount,target] of goalTotals.values()){
    const row=document.createElement('div');
    row.className='goal-row';
    const title=document.createElement('strong');
    title.textContent=name;
    const detail=document.createElement('div');
    detail.textContent=money(amount)+' saved'+(target?' of '+money(target)+' · '+Math.round(100*amount/target)+'%':'');
    row.append(title,detail);
    if(target){
      const bar=document.createElement('progress');
      bar.className='progress';
      bar.max=target;
      bar.value=Math.min(amount,target);
      bar.setAttribute('aria-label',name+' savings progress');
      row.append(bar);
    }
    progress.append(row);
  }
}
function refreshHistory(key){
  const select=get('viewMonth');
  select.replaceChildren(new Option('Current budget',''));
  const table=get('history');
  table.replaceChildren();
  const months=[...history.keys()].sort().reverse();
  for(const month of months){
    select.add(new Option(monthLabel(month),month));
    const tr=table.insertRow();
    tr.classList.toggle('selected',month===key);
    const button=document.createElement('button');
    button.type='button';
    button.className='secondary';
    button.textContent=monthLabel(month);
    button.onclick=()=>render(month);
    tr.insertCell().append(button);
    totals(history.get(month)).forEach(value=>tr.insertCell().textContent=money(value));
  }
  if(!months.length){
    const cell=table.insertRow().insertCell();
    cell.colSpan=5;
    cell.textContent='No months recorded yet.';
  }
  select.value=key;
  get('historyNote').textContent=sampleMode?'Sample history · Select a month to explore its dashboard.':'Select a recorded month to explore its dashboard.';
}
get('viewMonth').onchange=e=>render(e.target.value);
get('record').onclick=()=>{
  const key=get('recordMonth').value;
  if(!/^\d{4}-\d{2}$/.test(key)){
    get('recordMessage').textContent='Choose a month to record.';
    return;
  }
  const exists=history.has(key);
  history.set(key,collect());
  get('recordMessage').textContent=monthLabel(key)+(exists?' updated with the current budget.':' recorded.');
  persist();
  render(key);
};
function render(key=''){
  insightRequest?.abort();
  get('ai').disabled=false;
  get('aiResult').textContent='';
  get('ai').onclick=()=>requestInsight(history.get(key)||collect());
  const budget=history.get(key)||collect();
  const {income,bills,goals,contributions}=budget;
  refreshHistory(key);
  charts(budget,key);
  const spent=sum(bills),saved=sum(goals),planned=spent+saved;
  const left=Math.round((income-planned)*100)/100;
  get('profile').textContent=budget.profile||collect().profile;
  get('summary').textContent=key?'Recorded budget for '+monthLabel(key)+'.':'Average monthly amounts based on '+get('frequency').selectedOptions[0].textContent.toLowerCase()+' pay.';
  get('income').textContent=money(income);
  get('planned').textContent=money(planned);
  get('left').textContent=money(left);
  get('left').classList.toggle('negative',left<0);
  const barTotal=Math.max(income,planned,1);
  get('billBar').style.width=spent/barTotal*100+'%';
  get('goalBar').style.width=saved/barTotal*100+'%';
  list('breakdown',bills.length?[...bills,['Savings goals',saved]]:saved?[['Savings goals',saved]]:[],'No monthly amounts entered.');
  list('goalList',goals,'No savings goals added.');
  list('contributions',contributions.filter(item=>item[1]>0),'No contributions entered.');
  const flexible=bills.filter(([name])=>['Groceries','Gas','Subscriptions','Dining out'].includes(name)).sort((a,b)=>b[1]-a[1])[0];
  get('status').textContent=!planned?'Add your monthly expenses':left<0?'Your plan is over budget':left<income*.1?'Your plan has a small cushion':'Your plan has room left';
  const next=flexible?' Review '+flexible[0].toLowerCase()+' ('+money(flexible[1])+'/month) for any realistic reductions.':' Review recurring bills and check whether any goal amounts can be adjusted.';
  get('insight').textContent=!planned?'Enter recurring expenses or savings goals to see how much of your pay they use.':left<0?'Your bills and goals exceed take-home pay by '+money(-left)+' a month.'+next:left<income*.1?'You have '+money(left)+' left for irregular expenses each month.'+next:'Your listed bills and goals fit within your average monthly pay, with '+money(left)+' left for irregular expenses or additional savings.';
  get('setup').hidden=true;
  get('result').hidden=false;
  get('result').focus();
}
get('edit').onclick=()=>{
  get('result').hidden=true;
  get('setup').hidden=false;
  showStep(0);
  get('name').focus();
};
let insightRequest;
async function requestInsight(budget){
  const controller=new AbortController();
  insightRequest=controller;
  const target=get('aiResult');
  const button=get('ai');
  target.textContent='Reviewing this budget…';
  button.disabled=true;
  const [income,expenses,savedAmount,left]=totals(budget);
  try {
    const response=await fetch('/api/insight',{
      method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
      body:JSON.stringify({income,expenses,saved:savedAmount,left,
        categories:budget.bills.filter(([name])=>categories.includes(name)).slice(0,8)})
    });
    if(!response.ok)throw new Error();
    const {insight}=await response.json();
    if(!controller.signal.aborted)target.textContent=insight;
  } catch {
    if(!controller.signal.aborted)target.textContent='AI suggestions are unavailable right now. The budget check above still uses your figures.';
  } finally {if(insightRequest===controller)button.disabled=false;}
}
get('demo').onclick=()=>{
  if(sampleMode){
    sampleMode=false;
    get('demo').textContent='Try sample dashboard';
    history=new Map(saved.history||[]);
    restore(saved.draft);
    get('recordMessage').textContent='';
    if(saved.draft)render();
    else get('edit').click();
    return;
  }
  get('demo').textContent='Exit sample dashboard';
  history=new Map();
  const sample={name:'Sample budget',pay:1880,frequency:26,state:'Florida',basis:'net',retirement:95,hsa:25,other:0,tax:0};
  Object.entries(sample).forEach(([id,amount])=>get(id).value=amount);
  [1950,0,310,100,120,60,35,200].forEach((amount,index)=>get('bill'+index).value=amount);
  get('extras').replaceChildren();
  get('goals').replaceChildren();
  addRow('goals','Emergency fund',250,2000);
  addRow('goals','Weekend trip',140,700);
  sampleMode=true;
  history.clear();
  for(let offset=0;offset<4;offset++){
    const date=new Date(today.getFullYear(),today.getMonth()-offset,1);
    const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
    const budget=collect();
    budget.bills=budget.bills.map(([name,amount])=>[name,amount+(name==='Groceries'?offset*18:name==='Dining out'?-offset*22:0)]);
    budget.goals=budget.goals.map(([name,amount,target])=>[name,amount-offset*20,target]);
    history.set(key,budget);
  }
  get('recordMessage').textContent='';
  render([...history.keys()][0]);
};
showStep(0);

if(saved.draft){restore(saved.draft);render();}
