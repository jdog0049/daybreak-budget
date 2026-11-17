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
  updatePaydayField();
  get('back').hidden=!index;
  get('next').textContent=index===3?'Create my profile':'Continue';
}
function updatePaydayField(){
  const required=['26','52'].includes(get('frequency').value);
  get('paydayField').hidden=!required;
  get('payday').required=required;
  get('payday').disabled=!required||step!==0;
}
get('frequency').onchange=updatePaydayField;
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
const dayMs=86400000;
const shortDate=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
function scheduledPaydays(month,anchor,interval){
  const start=Date.parse(month+'-01T00:00:00Z');
  const next=new Date(start);
  next.setUTCMonth(next.getUTCMonth()+1);
  const payday=Date.parse(anchor+'T00:00:00Z');
  if(!Number.isFinite(payday))return [];
  const cycle=interval*dayMs;
  const first=payday+Math.ceil((start-payday)/cycle)*cycle;
  const dates=[];
  for(let date=first;date<next.getTime();date+=cycle)dates.push(date);
  return dates;
}
function collect(month=currentMonth()){
  const frequency=value('frequency');
  const interval=frequency===26?14:frequency===52?7:0;
  const dates=interval?scheduledPaydays(month,get('payday').value,interval):[];
  const monthly=interval?dates.length:frequency/12;
  const contributions=[['401(k)',value('retirement')*monthly],['HSA',value('hsa')*monthly],['Other deductions',value('other')*monthly]];
  const gross=get('basis').value==='gross';
  const income=Math.round((value('pay')*monthly-(gross?sum(contributions)+value('tax')*monthly:0))*100)/100;
  const bills=[...categories.map((name,i)=>[name,value('bill'+i)]),...rows('extras')].filter(item=>item[1]>0);
  const goals=rows('goals');
  return {income,bills,goals,contributions,paycheckCount:monthly,paydays:dates,profile:(get('name').value.trim()||'My budget')+' · '+get('state').value};
}
const storageKey='daybreak-budget-v1';
function readSaved(){
  try { return JSON.parse(localStorage.getItem(storageKey))||{}; }
  catch { return {}; }
}
let saved=readSaved();
let history=new Map(saved.history||[]);
let expenses=new Map(saved.expenses||[]);
function snapshot(){
  return {
    fields:Object.fromEntries(['name','pay','frequency','basis','state','retirement','hsa','other','tax','payday']
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
  saved={draft:snapshot(),history:[...history],expenses:[...expenses]};
  try {localStorage.setItem(storageKey,JSON.stringify(saved));}
  catch {get('recordMessage').textContent='Browser storage is unavailable. Changes will be lost when you close this page.';}
}
const formatter=new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
const monthLabel=key=>formatter.format(new Date(key+'-01T00:00:00Z'));
const totals=budget=>[budget.income,sum(budget.bills),sum(budget.goals),budget.income-sum(budget.bills)-sum(budget.goals)];
const today=new Date();
function currentMonth(date=new Date()){
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
}
get('recordMonth').value=currentMonth();
const palette=['#f7bca9','#a9d3f4','#cbb9eb','#a8dccb','#f5dda2','#f0bad6','#b5c2ea','#cfe0a5'];
let sampleMode=false;
function charts(budget,key){
  const expense=sum(budget.bills);
  const stops=[];
  const legend=get('pieLegend');
  legend.replaceChildren();
  let start=0;
  budget.bills.forEach(([name,amount,isExtra],index)=>{
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
    if(isExtra){
      const details=document.createElement('details');
      const summary=document.createElement('summary');
      summary.className='line expense-drilldown';
      label.append(' ▾');
      summary.append(label,number);
      details.append(summary);
      for(const [subject,cents] of budget.extraByMerchant){
        const line=document.createElement('div');
        line.className='line extra-merchant';
        const merchant=document.createElement('span');
        const price=document.createElement('strong');
        merchant.textContent=subject;
        price.textContent=money(cents/100);
        line.append(merchant,price);
        details.append(line);
      }
      legend.append(details);
    }else{
      row.append(label,number);
      legend.append(row);
    }
  });
  if(!expense)legend.textContent='Add expenses to see a category breakdown.';
  get('pie').hidden=!expense;
  get('pie').style.background=budget.bills.length===1?palette[0]:expense?'conic-gradient('+stops.join(',')+')':'none';
  get('pieMonth').textContent=key?monthLabel(key):'Current budget';
}
function goalKey(name){
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function matchGoal(subject,goals){
  const key=goalKey(subject);
  const exact=goals.filter(([name])=>goalKey(name)===key);
  if(exact.length)return exact.length===1?exact[0]:null;
  const words=text=>goalKey(text).split(' ').filter(word=>word&&!['my','the','a','savings','saving','fund','goal'].includes(word));
  const requested=words(subject);
  if(!requested.length)return null;
  const matches=goals.filter(([name])=>{
    const tokens=words(name);
    return requested.every(word=>tokens.includes(word));
  });
  return matches.length===1?matches[0]:null;
}
function monthGoals(budget,month){
  const goals=new Map(budget.goals.map(row=>[goalKey(row[0]),[...row]]));
  for(const entry of expenses.get(month)||[]){
    if(!entry.goal)continue;
    const key=goalKey(entry.goal);
    const current=goals.get(key)||[entry.goal,0,entry.target];
    current[1]=(Math.round(current[1]*100)+entry.cents)/100;
    goals.set(key,current);
  }
  return [...goals.values()];
}
function cumulativeGoals(budget,month){
  const goalTotals=new Map();
  const months=new Set([...history.keys(),...expenses.keys(),month]);
  for(const key of [...months].sort()){
    if(key>month)break;
    const baseline=key===month?budget:history.get(key)||{goals:[]};
    for(const [name,amount,target] of monthGoals(baseline,key)){
      const normalized=goalKey(name);
      const previous=goalTotals.get(normalized);
      goalTotals.set(normalized,[name,(Math.round((previous?.[1]||0)*100)+Math.round(amount*100))/100,target??previous?.[2]??0]);
    }
  }
  return goalTotals;
}
function savingsText(amount,target){
  return money(amount)+' saved'+(target?' of '+money(target)+' · '+Math.round(100*amount/target)+'%':' · No target set');
}
function renderSavings(goalTotals,month){
  const progress=get('goalProgress');
  progress.replaceChildren();
  get('savingsNote').textContent='Cumulative through '+monthLabel(month);
  if(!goalTotals.size)progress.textContent='Add a goal to start tracking your savings.';
  for(const [name,amount,target] of goalTotals.values()){
    const row=document.createElement('div');
    row.className='pig-goal';
    const pig=get('pigTemplate').content.firstElementChild.cloneNode(true);
    const percent=target?Math.min(100,100*amount/target):0;
    pig.style.setProperty('--pig-fill',percent+'%');
    const text=document.createElement('div');
    const title=document.createElement('strong');
    title.textContent=name;
    const detail=document.createElement('div');
    detail.textContent=savingsText(amount,target);
    text.append(title,detail);
    row.append(pig,text);
    progress.append(row);
  }
}
function celebrateSavings(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const burst=document.createElement('div');
  burst.className='money-confetti';
  burst.setAttribute('aria-hidden','true');
  const symbols=['💵','🪙','💸','✨'];
  for(let i=0;i<24;i++){
    const piece=document.createElement('span');
    piece.textContent=symbols[i%symbols.length];
    piece.style.setProperty('--left',Math.random()*95+'%');
    piece.style.setProperty('--drift',(Math.random()*180-90)+'px');
    piece.style.setProperty('--spin',(Math.random()*540-270)+'deg');
    piece.style.animationDelay=Math.random()*.4+'s';
    burst.append(piece);
  }
  document.body.append(burst);
  setTimeout(()=>burst.remove(),2200);
}
function refreshHistory(key){
  const select=get('viewMonth');
  select.replaceChildren(new Option('Current budget · '+monthLabel(currentMonth()),''));
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
    totals(monthBudget(history.get(month),month)).forEach(value=>tr.insertCell().textContent=money(value));
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
  history.set(key,collect(key));
  get('recordMessage').textContent=monthLabel(key)+(exists?' updated with the current budget.':' recorded.');
  persist();
  render(key);
};
function parseExpense(message){
  const amountPattern=/\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])/g;
  const matches=[...message.matchAll(amountPattern)];
  if(matches.length!==1)return null;
  const [full,number]=matches[0];
  const subject=message.slice(matches[0].index+full.length).match(/^\s+(?:at|on|for|into|to|in)\s+(.+?)\s*[.!?]*$/i)?.[1]?.trim();
  const cents=Math.round(Number(number.replaceAll(',',''))*100);
  if(!subject||!/[\p{L}\p{N}]/u.test(subject)||!Number.isSafeInteger(cents)||cents<=0||cents>10000000000)return null;
  const savings=/\b(?:put|added|saved|deposited|contributed|transferred|set aside)\s*$/i.test(message.slice(0,matches[0].index))
    || /^\s+into\s+/i.test(message.slice(matches[0].index+full.length));
  return {subject,cents,savings};
}
function withExpenses(budget,month){
  const categoryUsage=new Map();
  for(const [name,amount] of budget.bills){
    const key=name.trim().toLowerCase();
    const usage=categoryUsage.get(key)||{name,limit:0,spent:0};
    usage.limit+=Math.round(amount*100);
    categoryUsage.set(key,usage);
  }
  const extraByMerchant=new Map();
  const assignments=new Map();
  let extra=0;
  for(const entry of expenses.get(month)||[]){
    if(entry.goal)continue;
    const subject=entry.subject.toLowerCase();
    const usage=categoryUsage.get(subject)||categoryUsage.get(subject.split(/\s+at\s+/)[0]);
    if(usage){
      usage.spent+=entry.cents;
      assignments.set(entry.id,usage);
    }else{
      const merchant=extraByMerchant.get(subject)||[entry.subject,0];
      merchant[1]+=entry.cents;
      extraByMerchant.set(subject,merchant);
      extra+=entry.cents;
    }
  }
  // Planned spending already reserves each category's full amount.
  const bills=[...categoryUsage.values()].map(({name,limit,spent})=>[name,Math.max(limit,spent)/100]);
  if(extra)bills.push(['Extra',extra/100,true]);
  return {...budget,bills,categoryUsage,assignments,extraByMerchant:extraByMerchant.values()};
}
function monthBudget(budget,month){
  return {...withExpenses(budget,month),goals:monthGoals(budget,month)};
}
function usageText({limit,spent}){
  const difference=limit-spent;
  const balance=difference>=0?money(difference/100)+' left':money(-difference/100)+' over budget';
  return money(spent/100)+' of '+money(limit/100)+' used ('+Math.round(100*spent/limit)+'%) · '+balance;
}
function renderExpenses(month,key,budget,goalTotals){
  const entries=expenses.get(month)||[];
  const list=get('expenseList');
  list.replaceChildren();
  get('expenseHint').textContent=monthLabel(month)+' · Try “I spent $60 on gas” or “I put $500 into my apartment fund.”';
  const utilization=get('categoryUtilization');
  utilization.replaceChildren();
  for(const usage of budget.categoryUsage.values()){
    if(!usage.spent)continue;
    const item=document.createElement('div');
    item.className='goal-row';
    const title=document.createElement('strong');
    title.textContent=usage.name;
    const detail=document.createElement('div');
    detail.textContent=usageText(usage);
    const bar=document.createElement('progress');
    bar.className='progress';
    bar.value=Math.min(usage.spent,usage.limit);
    bar.max=usage.limit;
    bar.setAttribute('aria-label',usage.name+' budget used');
    item.append(title,detail,bar);
    utilization.append(item);
  }
  utilization.hidden=!utilization.childElementCount;
  for(const entry of [...entries].reverse()){
    const row=document.createElement('div');
    row.className='line';
    const label=document.createElement('span');
    const category=budget.assignments.get(entry.id)?.name||'Extra';
    label.textContent=entry.goal?'Saved '+money(entry.cents/100)+' · '+entry.goal
      :entry.subject+' · '+money(entry.cents/100)+(entry.subject.toLowerCase()===category.toLowerCase()?'':' · '+category);
    const remove=document.createElement('button');
    remove.type='button';
    remove.className='secondary';
    remove.textContent='Remove';
    remove.setAttribute('aria-label','Remove '+(entry.goal?entry.goal+' contribution':entry.subject+' expense'));
    remove.onclick=()=>{
      expenses.set(month,entries.filter(item=>item.id!==entry.id));
      persist();
      render(key,false);
      get('expenseStatus').textContent=entry.goal?'Removed contribution to '+entry.goal+'.':'Removed '+entry.subject+'.';
      get('expenseText').focus();
    };
    row.append(label,remove);
    list.append(row);
  }
  get('expenseForm').onsubmit=event=>{
    event.preventDefault();
    if(!key&&month!==currentMonth()){
      render('',false);
      get('expenseStatus').textContent='The calendar month changed. Submit again to log the expense in '+monthLabel(currentMonth())+'.';
      return;
    }
    const input=get('expenseText');
    const expense=parseExpense(input.value);
    if(!expense){
      get('expenseStatus').textContent='Use one dollar amount and a merchant or description, like “I just spent $25 at Starbucks.”';
      return;
    }
    const entry={subject:expense.subject,cents:expense.cents,id:crypto.randomUUID()};
    if(expense.savings){
      const goal=matchGoal(expense.subject,[...goalTotals.values()]);
      if(!goal){
        get('expenseStatus').textContent='Use an existing savings goal name. If two goals sound alike, type the full name from Savings progress.';
        return;
      }
      [entry.goal,,entry.target]=goal;
    }
    expenses.set(month,[...entries,entry]);
    input.value='';
    persist();
    const updated=render(key,false);
    if(entry.goal){
      const [name,amount,target]=updated.goalTotals.get(goalKey(entry.goal));
      get('expenseStatus').textContent='Added '+money(entry.cents/100)+' to '+name+'. '+savingsText(amount,target)+'.';
      celebrateSavings();
      input.focus();
      return;
    }
    const usage=updated.assignments.get(entry.id);
    get('expenseStatus').textContent='Logged '+money(expense.cents/100)+' for '+expense.subject+'.'
      +(usage?' '+usage.name+': '+usageText(usage)+'.':' Added to Extra.');
    input.focus();
  };
}
function render(key='',focus=true){
  insightRequest?.abort();
  get('ai').disabled=false;
  get('aiResult').textContent='';
  const month=key||currentMonth();
  const baseline=history.get(key)||collect(month);
  const goalTotals=cumulativeGoals(baseline,month);
  const budget=monthBudget(baseline,month);
  budget.goalTotals=goalTotals;
  get('ai').onclick=()=>requestInsight(budget);
  get('expenseStatus').textContent='';
  renderExpenses(month,key,budget,goalTotals);
  const {income,bills,goals,contributions}=budget;
  refreshHistory(key);
  charts(budget,key);
  renderSavings(goalTotals,month);
  const spent=sum(bills),saved=sum(goals),planned=spent+saved;
  const left=Math.round((income-planned)*100)/100;
  get('profile').textContent=budget.profile||collect().profile;
  const count=budget.paycheckCount;
  const schedule=count===undefined?'Saved budget snapshot':count+' scheduled '+(count===1?'paycheck':'paychecks');
  const dates=budget.paydays?.length?' · '+budget.paydays.map(date=>shortDate.format(date)).join(', '):'';
  get('summary').textContent=monthLabel(month)+' · '+schedule+dates;
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
  get('insight').textContent=!planned?'Enter recurring expenses or savings goals to see how much of your pay they use.':left<0?'Your bills and goals exceed take-home pay by '+money(-left)+' a month.'+next:left<income*.1?'You have '+money(left)+' left for irregular expenses each month.'+next:'Your listed bills and goals fit within your scheduled pay, with '+money(left)+' left for irregular expenses or additional savings.';
  get('setup').hidden=true;
  get('result').hidden=false;
  if(focus)get('result').focus();
  return budget;
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
    expenses=new Map(saved.expenses||[]);
    restore(saved.draft);
    get('recordMessage').textContent='';
    openSavedBudget();
    return;
  }
  get('demo').textContent='Exit sample dashboard';
  history=new Map();
  expenses=new Map();
  const sample={name:'Sample budget',pay:1880,frequency:26,payday:'2026-11-13',state:'Florida',basis:'net',retirement:95,hsa:25,other:0,tax:0};
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
    const budget=collect(key);
    budget.bills=budget.bills.map(([name,amount])=>[name,amount+(name==='Groceries'?offset*18:name==='Dining out'?-offset*22:0)]);
    budget.goals=budget.goals.map(([name,amount,target])=>[name,amount-offset*20,target]);
    history.set(key,budget);
  }
  get('recordMessage').textContent='';
  render([...history.keys()][0]);
};
showStep(0);

function openSavedBudget(){
  if(saved.draft&&(!['26','52'].includes(get('frequency').value)||get('payday').value))render();
  else {
    get('edit').click();
    if(saved.draft)get('payday').focus();
  }
}
if(saved.draft){restore(saved.draft);openSavedBudget();}
let displayedMonth=currentMonth();
document.addEventListener('visibilitychange',()=>{
  if(document.hidden||displayedMonth===currentMonth())return;
  displayedMonth=currentMonth();
  if(!get('result').hidden&&!get('viewMonth').value)render('',false);
});
