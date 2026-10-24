/* Daftar Arabisch: de app zelf (station, oefenen, nakijken, toetsenbord, opslag).
   De lesstof komt uit content/content.json en wordt door js/boot.js geladen. */
(function(){
'use strict';

var CONTENT=window.DAFTAR_CONTENT,L=window.DaftarLogic;
var F='َ',D='ُ',K='ِ',S='ْ',SH='ّ',FT='ً',DT='ٌ',KT='ٍ';

var STOF={
  w:{t:'Woorden',full:'Woorden',src:CONTENT.woorden,unit:['woord','woorden'],doel:'Doel: woordenschat. Losse woorden staan in de grondvorm op -un, ook als het boek ze in een leesoefening met een andere tanween afdrukt.',
     empty:'Hier komen de woordenlijsten uit jouw boeken en lessen.',
     need:['De woorden per les, Arabisch met klinkertekens en de betekenis','Uit welk boek en welke les ze komen']},
  p:{t:'Voornaamwoorden',full:'Persoonlijke voornaamwoorden',src:CONTENT.vnw,unit:['kaart','kaarten'],doel:'Doel: voornaamwoorden herkennen en gebruiken: persoonlijk, aangehecht en aanwijzend.',
     empty:'In dit boek staan geen voornaamwoorden.',
     need:['De voornaamwoorden met hun betekenis','De indeling die jouw boek gebruikt, bijvoorbeeld persoon, getal en geslacht','De bron: boek en bladzijde of les']},
  s:{t:'Ṣarf',full:'Ṣarf: woordvormen',src:CONTENT.werkw,unit:['kaart','kaarten'],doel:'Doel: woordvormen. Boek 1 geeft werkwoorden in de hij-vorm van de verleden tijd (als woordenschat). Boek 2 geeft de meervoudsvormen bij het enkelvoud. Boek 3 geeft de vervoeging in de verleden en tegenwoordige tijd, de gebiedende wijs, alle werkwoorden in beide tijden, de vergrotende trap en meervouden.',
     empty:'Hier komen de werkwoorden en vervoegingstabellen uit jouw boeken.',
     need:['De werkwoorden met hun betekenis','Een vervoegingstabel: de tijd en de vorm per persoon','De bron: boek en bladzijde of les']},
  n:{t:'Naḥw',full:'Naḥw: grammatica',soort:'grammatica',doel:'Doel: grammatica. Regels over woorden en zinnen, elk met de bladzijde uit het boek.'},
  k:{t:'Klank',full:'Klank en schrift',soort:'klank',doel:'Doel: klank. Uitspraak, klinkertekens en letters die op elkaar lijken. Dit is geen grammatica.'}
};
var BOOKS=['Boek 1','Boek 2','Boek 3','Aantekeningen'],LOADED=['Boek 1','Boek 2','Boek 3','Aantekeningen'];
var VORM={review:'Herhalen',quiz:'Toets',list:'Lijst'},NIV={beg:'Beginner',adv:'Gevorderd'},KIJK={now:'Direct nakijken',later:'Achteraf nakijken'};
var RICHT={an:'Arabisch → Nederlands',na:'Nederlands → Arabisch'};

/* ---------- opslag ---------- */
var KEY='daftar-v1';
/* standaardinstellingen; aan te passen via Instellingen (alleen als Admin) */
var SET0={need:2,kort:10,autoSec:2,autoFlow:true,perDay:10,lock:'beg',arz:'m',theme:'auto'};
function cfg(k){var v=state&&state.set?state.set[k]:undefined;return v===undefined?SET0[k]:v;}
function today(){var d=new Date();return Math.floor((d.getTime()-d.getTimezoneOffset()*60000)/864e5);}
function pr(){return state.mode==='admin'?state.adm:state;}
/* score per dag: aantal antwoorden en aantal goed */
function accRec(ok){var p=pr(),t=today(),a=p.acc[t]||(p.acc[t]={n:0,ok:0});a.n++;if(ok) a.ok++;}
var state;
try{state=L.normalize(JSON.parse(localStorage.getItem(KEY)));}catch(e){state=L.fresh();}

var ref=null,syncing=false,again=false,timer=null;
/* de laatst opgeslagen versie: save() vergelijkt daarmee om per item een tijdstempel te zetten (zie js/logic.js) */
var snap=L.clone(state);
function setSync(kind){
  var el=document.getElementById('sync');
  el.className='sync '+kind;
  el.textContent=kind==='cloud'?'Opgeslagen op al je apparaten':'Opgeslagen op dit apparaat';
}
function localSave(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
/* cache voor afgeleide lesstof (kaarten, regels, lijnen, ids per level): alleen gegevens die niet van de voortgang
   afhangen. Wordt leeggemaakt bij elke render(), save() en adopt(), zodat hij nooit verouderd is. */
var memo={};
function cached(key,fn){return Object.prototype.hasOwnProperty.call(memo,key)?memo[key]:(memo[key]=fn());}
function save(){
  memo={};
  state.updated=Date.now();
  var ks=Object.keys(pr().days);
  if(ks.length>400){ks.sort(function(a,b){return a-b;}).slice(0,ks.length-400).forEach(function(k){delete pr().days[k];});}
  L.stampChanges(state,snap,state.updated);snap=L.clone(state);
  localSave();
  if(ref){clearTimeout(timer);timer=setTimeout(sync,1200);}
}
/* een samengevoegde versie overnemen; tijdens een toetsronde wordt niet opnieuw getekend, zodat de ronde doorloopt */
function adopt(m){
  var changed=L.sig(m)!==L.sig(state);
  state=m;memo={};snap=L.clone(state);localSave();
  if(changed&&ui.screen!=='run') render();
}
/* synchroniseren: de server ophalen, samenvoegen met wat hier staat en terugzetten als de server iets mist.
   Zo gaat een sessie zonder internet niet verloren, en overschrijft dit apparaat het andere niet. */
function sync(){
  if(!ref) return Promise.resolve();
  if(syncing){again=true;return Promise.resolve();}
  syncing=true;
  return ref.get().then(function(got){
    var remote=got.exists?L.normalize(L.clone(got.data()||{})):null;
    if(remote) adopt(L.merge(state,remote));
    if(remote?L.sig(state)===L.sig(remote):!state.updated){setSync('cloud');return;}
    return ref.set(L.clone(state)).then(function(){setSync('cloud');});
  }).catch(function(e){
    setSync('local');
    if(e&&e.code!=='unavailable'&&e.code!=='resource_exhausted') ref=null;
  }).then(function(){syncing=false;if(again){again=false;sync();}});
}
function connect(){
  /* eigen app: voortgang via Supabase (js/boot.js levert window.DAFTAR_STORE met get en set) */
  if(window.DAFTAR_STORE){
    ref=window.DAFTAR_STORE;
    sync();
    return;
  }
  if(!window.claude||!window.claude.use){setSync('local');return;}
  Promise.all([window.claude.use('user'),window.claude.use('db')]).then(function(r){
    if(!r[0]||!r[1]){setSync('local');return;}
    return r[0].id().then(function(id){
      if(!id){setSync('local');return;}
      ref=r[1].doc('data/users/'+id+'/daftar');
      return sync();
    });
  }).catch(function(){ref=null;setSync('local');});
}
/* opnieuw proberen zodra het apparaat weer online is of de app weer in beeld komt */
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible') sync();});
window.addEventListener('online',function(){sync();});

/* ---------- hulpjes ---------- */
function h(tag,attrs){
  var e=document.createElement(tag),k,v,i;
  if(attrs) for(k in attrs){
    v=attrs[k];
    if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k.slice(0,2)==='on') e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  var kids=[].concat.apply([],Array.prototype.slice.call(arguments,2));
  for(i=0;i<kids.length;i++){
    if(kids[i]==null||kids[i]===false) continue;
    e.appendChild(kids[i].nodeType?kids[i]:document.createTextNode(String(kids[i])));
  }
  return e;
}
function ar(t,cls,tag){return h(tag||'span',{class:'ar'+(cls?' '+cls:''),lang:'ar',dir:'rtl'},t);}
function P(){return h.apply(null,['p',null].concat(Array.prototype.slice.call(arguments)));}
function okB(t){return h('b',{class:'ok'},t);}
function noB(t){return h('b',{class:'no'},t);}
function lbl(t){return h('span',{class:'lbl'},t);}
function lg(t){return t&&t.length>26?' long':'';}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function uniq(a){var o=[],seen={};a.forEach(function(x){var k=typeof x+':'+x;if(!seen[k]){seen[k]=1;o.push(x);}});return o;}
function bump(){var t=today();pr().days[t]=(pr().days[t]||0)+1;}
function streak(){
  var t=today(),n=0;
  if(!pr().days[t]) t--;
  while(pr().days[t]){n++;t--;}
  return n;
}
function emptyPanel(title,text,need){
  return h('section',{class:'panel empty'},
    h('h2',null,title),
    h('p',{class:'muted'},text),
    h('p',{class:'small'},'Stuur in de chat met Claude:'),
    h('ul',{class:'small muted'},need.map(function(n){return h('li',null,n);})));
}

/* ---------- Arabisch vergelijken: de logica staat in js/logic.js, hier wordt er tekst van gemaakt ---------- */
var MARK=L.MARK,MARKNAME=L.MARKNAME,norm=L.norm;
function explainNodes(e){
  if(e.kind==='empty') return [P('Je hebt niets ingevuld.')];
  if(e.kind==='letters') return [P('De letters kloppen niet. Jij typte de letters ',ar(e.have),' en het moeten de letters ',ar(e.want),' zijn.')];
  var out=[P('De letters kloppen, maar de klinkertekens niet.')];
  e.diffs.forEach(function(d){out.push(P('Op de ',ar(d.letter),' (letter '+d.pos+') staat bij jou '+d.have+'. Het moet '+d.want+' zijn.'));});
  if(e.more) out.push(P('En nog '+e.more+' klinkertekens wijken af.'));
  return out;
}
function explain(v,t){return explainNodes(L.explain(v,t));}

/* ---------- Arabisch toetsenbord, standaardindeling (Arabic 101) ---------- */
var ROWS=[['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight'],
          ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'],
          ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash']];
var CODE={Backquote:'ذ',KeyQ:'ض',KeyW:'ص',KeyE:'ث',KeyR:'ق',KeyT:'ف',KeyY:'غ',KeyU:'ع',KeyI:'ه',KeyO:'خ',KeyP:'ح',BracketLeft:'ج',BracketRight:'د',
  KeyA:'ش',KeyS:'س',KeyD:'ي',KeyF:'ب',KeyG:'ل',KeyH:'ا',KeyJ:'ت',KeyK:'ن',KeyL:'م',Semicolon:'ك',Quote:'ط',
  KeyZ:'ئ',KeyX:'ء',KeyC:'ؤ',KeyV:'ر',KeyB:'لا',KeyN:'ى',KeyM:'ة',Comma:'و',Period:'ز',Slash:'ظ'};
var CODE_S={Backquote:SH,KeyQ:F,KeyW:FT,KeyE:D,KeyR:DT,KeyT:'لإ',KeyY:'إ',KeyU:'‘',KeyI:'÷',KeyO:'×',KeyP:'؛',BracketLeft:'<',BracketRight:'>',
  KeyA:K,KeyS:KT,KeyD:']',KeyF:'[',KeyG:'لأ',KeyH:'أ',KeyJ:'ـ',KeyK:'،',KeyL:'/',Semicolon:':',Quote:'"',
  KeyZ:'~',KeyX:S,KeyC:'}',KeyV:'{',KeyB:'لآ',KeyN:'آ',KeyM:'’',Comma:',',Period:'.',Slash:'؟'};
function ins(input,t){
  var v=input.value,a=input.selectionStart,b=input.selectionEnd;
  if(a==null||b==null){a=b=v.length;}
  input.value=v.slice(0,a)+t+v.slice(b);
  var p=a+t.length;
  try{input.focus();input.setSelectionRange(p,p);}catch(e){}
}
function bksp(input){
  var v=input.value,a=input.selectionStart,b=input.selectionEnd;
  if(a==null||b==null){a=b=v.length;}
  if(a===b){if(a===0) return;a--;}
  input.value=v.slice(0,a)+v.slice(b);
  try{input.focus();input.setSelectionRange(a,a);}catch(e){}
}
function keyboard(input){
  var shift=false,wrap=h('div',{class:'kb','aria-label':'Arabisch toetsenbord'});
  function key(label,fn,cls){
    var b=h('button',{type:'button',class:'key'+(cls?' '+cls:''),tabindex:'-1'},label);
    b.addEventListener('mousedown',function(e){e.preventDefault();});
    b.addEventListener('click',fn);
    return b;
  }
  function tk(t){
    var mark=t.length===1&&MARK.test(t);
    var b=key(mark?'ـ'+t:t,function(){ins(input,t);if(shift){shift=false;draw();}},mark?'mk':'');
    if(mark) b.setAttribute('aria-label',MARKNAME[t]);
    return b;
  }
  function draw(){
    wrap.textContent='';
    wrap.appendChild(h('div',{class:'krow'},['ذ',F,FT,D,DT,K,KT,S,SH].map(tk)));
    ROWS.forEach(function(row){wrap.appendChild(h('div',{class:'krow'},row.map(function(c){return tk((shift?CODE_S:CODE)[c]);})));});
    wrap.appendChild(h('div',{class:'krow'},
      key('Shift',function(){shift=!shift;draw();},'wide'+(shift?' on':'')),
      key('spatie',function(){ins(input,' ');},'space'),
      key('⌫',function(){bksp(input);},'wide')));
  }
  draw();
  return wrap;
}
function typeBox(label,onSubmit){
  var input=h('input',{type:'text',class:'arin',id:'answer',dir:'rtl',lang:'ar',autocomplete:'off',autocapitalize:'off',autocorrect:'off',spellcheck:'false','aria-label':'Jouw antwoord in het Arabisch'});
  var pad=h('div',{class:'kbslot'}),hint=h('p',{class:'small muted'});
  var sw=h('button',{class:'btn sm ghost',type:'button',id:'kb-switch'});
  /* 'app' = het toetsenbord in de pagina; 'own' = het toetsenbord van het apparaat zelf */
  function apply(){
    var own=state.kb==='own';
    input.setAttribute('inputmode',own?'text':'none');
    pad.textContent='';
    if(!own) pad.appendChild(keyboard(input));
    hint.textContent=own?'Zet het toetsenbord van je apparaat op Arabisch om met tashkeel te typen.':'';
    sw.textContent=own?'Toetsenbord van de app gebruiken':'Eigen toetsenbord gebruiken';
  }
  sw.addEventListener('click',function(){
    state.kb=state.kb==='own'?'app':'own';save();apply();
    try{input.blur();input.focus();}catch(e){}
  });
  input.addEventListener('keydown',function(ev){
    if(ev.key==='Enter'){ev.preventDefault();onSubmit(input.value);return;}
    if(state.kb==='own'||ev.ctrlKey||ev.metaKey||ev.altKey) return;
    var k=(ev.shiftKey?CODE_S:CODE)[ev.code];
    if(k){ev.preventDefault();ins(input,k);}
  });
  apply();
  setTimeout(function(){try{input.focus();}catch(e){}},0);
  return h('div',{class:'typebox'},input,hint,pad,
    h('div',{class:'row spread'},
      h('button',{class:'btn primary',type:'button',onclick:function(){onSubmit(input.value);}},label),sw));
}

function typeBoxNl(label,onSubmit){
  var input=h('input',{type:'text',id:'answer',lang:'nl',autocomplete:'off',autocapitalize:'off',spellcheck:'false',placeholder:'Typ de betekenis','aria-label':'Jouw antwoord in het Nederlands'});
  input.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();onSubmit(input.value);}});
  setTimeout(function(){try{input.focus();}catch(e){}},0);
  return h('div',{class:'typebox'},input,
    h('div',{class:'row'},h('button',{class:'btn primary',type:'button',onclick:function(){onSubmit(input.value);}},label)));
}
function shown(kind,v){
  v=String(v||'').trim();
  if(!v) return '(niets ingevuld)';
  return kind==='nl'?'‘'+v+'’':ar(v,'big');
}

/* ---------- stof, boeken en delen ---------- */
function cardItems(stof){return cached('kaarten:'+stof,function(){return cardItemsNu(stof);});}
function cardItemsNu(stof){
  var out=[],id,w;
  var ed=state.ed||{};
  STOF[stof].src.forEach(function(x){
    var e=ed[x.id],y={id:x.id,ar:x.ar,nl:x.nl,boek:x.boek,deel:x.deel,bron:x.bron||'',noot:x.noot||'',en:x.en||'',q:x.q||'',own:false};
    if(e){if(e.del) return;EDF.forEach(function(k){if(e[k]!=null) y[k]=e[k];});y.edited=true;}
    out.push(y);
  });
  for(id in ed){w=ed[id];if(w.nieuw&&w.cat===stof&&!w.del) out.push({id:id,ar:w.ar,nl:w.nl,boek:w.boek,deel:w.deel,bron:w.bron||'',noot:w.noot||'',en:'',q:'',own:false,edited:true,nieuw:true});}
  for(id in state.words){w=state.words[id];if(w.cat===stof) out.push({id:id,ar:w.ar,nl:w.nl,boek:'Eigen',deel:w.les||'Zonder les',bron:'',noot:'',en:'',q:'',own:true});}
  return out;
}
function rb(r){return r.boek||'Boek 1';}
function isR(stof){return !!STOF[stof].soort;}
/* velden die Admin kan aanpassen */
var EDF=['ar','nl','bron','noot'],EDR=['titel','tekst','bron'];
function ruleOv(r){var e=state.ed&&state.ed[r.id],o;if(!e) return r;o={};for(var k in r) o[k]=r[k];EDR.forEach(function(k){if(e[k]!=null) o[k]=e[k];});o.edited=true;return o;}
function rules(stof){return cached('regels:'+stof,function(){return CONTENT.regels.filter(function(r){return r.soort===STOF[stof].soort;}).map(ruleOv);});}
/* vragen per regel, als object: regel-id → [vraag-ids] (in de volgorde van de lesstof) */
function vragenPerRegel(){return cached('vpr',function(){var o={};CONTENT.vragen.forEach(function(q){(o[q.regel]||(o[q.regel]=[])).push(q);});return o;});}
function vragenVan(regelIds){var v=vragenPerRegel(),set={},out=[];regelIds.forEach(function(id){set[id]=1;});CONTENT.vragen.forEach(function(q){if(set[q.regel]) out.push(q);});return out;}
function qCount(stof){var v=vragenPerRegel();return rules(stof).reduce(function(a,r){return a+(v[r.id]||[]).length;},0);}
function booksFor(stof){
  if(isR(stof)) return uniq(rules(stof).map(rb));
  return uniq(cardItems(stof).map(function(x){return x.boek;}));
}
function partsFor(stof,boek){
  if(isR(stof)) return rules(stof).filter(function(r){return rb(r)===boek;}).map(function(r){
    return [r.id,r.titel,(vragenPerRegel()[r.id]||[]).length];});
  var out=[],n={};
  cardItems(stof).forEach(function(x){if(x.boek!==boek) return;if(n[x.deel]==null){out.push(x.deel);n[x.deel]=0;}n[x.deel]++;});
  return out.map(function(d){return [d,d,n[d]];});
}
function fixRoute(){
  var r=state.route,books,parts;
  if(!STOF[r.stof]) r.stof='w';
  books=booksFor(r.stof);
  if(books.indexOf(r.boek)<0) r.boek=books[0]||null;
  parts=r.boek?partsFor(r.stof,r.boek):[];
  if(r.deel!=='all'&&!parts.some(function(p){return p[0]===r.deel;})) r.deel='all';
  if(!VORM[r.vorm]||(isR(r.stof)&&r.vorm==='review')) r.vorm=isR(r.stof)?'quiz':'review';
  if(!RICHT[r.richt]) r.richt=r.niv==='adv'?'na':'an';
  if(!NIV[r.niv]) r.niv='beg';
  if(!KIJK[r.kijk]) r.kijk='now';
  if(r.len!=='heel') r.len='kort';
  return r;
}
function pool(){
  var r=state.route;
  if(isR(r.stof)){
    var ids=rules(r.stof).filter(function(x){return rb(x)===r.boek&&(r.deel==='all'||x.id===r.deel);}).map(function(x){return x.id;});
    return vragenVan(ids);
  }
  return cardItems(r.stof).filter(function(x){return x.boek===r.boek&&(r.deel==='all'||x.deel===r.deel);});
}
function routeText(){
  var r=state.route,out=[STOF[r.stof].t],p;
  if(r.boek){
    p=curLevel();
    out.push(p?lvName(p)+(p.eind?'':' '+p.titel):r.boek);
  }
  if(r.vorm!=='list'){if(!isR(r.stof)) out.push(RICHT[r.richt]);out.push(NIV[r.niv]);}
  out.push(r.vorm==='list'&&isR(r.stof)?'Regels':VORM[r.vorm]);
  if(r.vorm==='quiz'){out.push(r.len==='heel'?'Hele level':'Korte ronde');out.push(KIJK[r.kijk]);}
  return out.join('  ›  ');
}

/* ---------- levels: per categorie een opbouwende lijn, in de volgorde van de boeken ---------- */
/* een level is één deel (of regel) uit een boek; per boek volgt een eindstation met alles door elkaar.
   Elk level heeft twee niveaus: Beginner en Gevorderd. Een niveau is gehaald als elk woord of elke vraag van het level
   beheerst is: cfg('need') keer achter elkaar goed in een toets op dat niveau. Een fout zet de teller terug op nul. */
function bare(t){return String(t).replace(/^\d+\s+/,'');}
function lines(stof){return cached('lijnen:'+stof,function(){return linesNu(stof);});}
function linesNu(stof){
  var groups=[],nr=0,books=booksFor(stof);
  uniq(BOOKS.concat(books)).forEach(function(b){
    if(books.indexOf(b)<0) return;
    var parts=partsFor(stof,b),eigen=b==='Eigen',all=0;
    var bn=b==='Aantekeningen'?'A':(b.match(/\d+/)||[''])[0];
    var lv=parts.map(function(p,i){all+=p[2];return {stof:stof,boek:b,deel:p[0],titel:bare(p[1]),n:p[2],nr:eigen?null:++nr,code:eigen?null:bn+'.'+(i+1)};});
    if(parts.length>1) lv.push({stof:stof,boek:b,deel:'all',titel:'Eindstation: alles van '+(eigen?'je eigen woorden':b),n:all,nr:null,eind:true});
    groups.push({boek:b,label:eigen?'Zelf toegevoegd':b,levels:lv});
  });
  return groups;
}
function flat(groups){return [].concat.apply([],groups.map(function(g){return g.levels;}));}
function levelIds(l){return cached('ids:'+l.stof+'|'+l.boek+'|'+l.deel,function(){
  if(isR(l.stof)){
    var ids=rules(l.stof).filter(function(x){return rb(x)===l.boek&&(l.deel==='all'||x.id===l.deel);}).map(function(x){return x.id;});
    return vragenVan(ids).map(function(q){return q.id;});
  }
  return cardItems(l.stof).filter(function(x){return x.boek===l.boek&&(l.deel==='all'||x.deel===l.deel);}).map(function(x){return x.id;});
});}
/* Gevorderd telt ook voor Beginner: wie het zelf kan typen, herkent het ook */
function streakOf(niv,id){var v=pr().m[niv][id]||0;return niv==='beg'?Math.max(v,pr().m.adv[id]||0):v;}
function half(l,niv){return levelIds(l).filter(function(id){var k=streakOf(niv,id);return k>0&&k<cfg('need');}).length;}
function known(l,niv){return levelIds(l).filter(function(id){return streakOf(niv,id)>=cfg('need');}).length;}
function passed(l,niv){var n=levelIds(l).length;return n>0&&known(l,niv)===n;}
function progText(l,niv){return NIV[niv]+': '+pctOf(l,niv)+'% ('+known(l,niv)+' beheerst, '+half(l,niv)+' halverwege, van '+levelIds(l).length+')';}
/* volgorde voor een toetsronde: eerst wat nog het minst beheerst is */
function weakFirst(list,niv,id){return shuffle(list).sort(function(a,b){return streakOf(niv,id(a))-streakOf(niv,id(b));});}
/* telt een antwoord mee voor beheersing; q.prev bewaart de stand van voor de vraag, voor 'Toch goed rekenen' */
function mark(q,ok){
  if(!q.mid) return;
  var m=pr().m[state.route.niv];
  if(q.prev==null) q.prev=m[q.mid]||0;
  m[q.mid]=ok?q.prev+1:0;
}
/* de volgende halte: eerst elk level op Beginner halen, daarna op Gevorderd */
function nextStop(stof){
  var all=flat(lines(stof)).filter(function(l){return l.nr!=null;}),i;
  for(i=0;i<all.length;i++) if(!passed(all[i],'beg')) return {l:all[i],niv:'beg'};
  for(i=0;i<all.length;i++) if(!passed(all[i],'adv')) return {l:all[i],niv:'adv'};
  return null;
}
/* Gebruiker: een level gaat open als het vorige level op Beginner gehaald is;
   een eindstation als alle levels van dat boek op Beginner gehaald zijn. Admin: alles open. */
function admin(){return state.mode==='admin';}
function lockOf(l){
  var nv=cfg('lock');
  if(admin()||nv==='open'||(l.nr==null&&!l.eind)) return null;
  var all=flat(lines(l.stof)).filter(function(x){return x.nr!=null;}),i,open;
  if(l.eind){
    open=all.filter(function(x){return x.boek===l.boek&&!passed(x,nv);});
    return open.length?'Op slot: haal eerst alle levels van '+l.boek+' op '+NIV[nv]+'.':null;
  }
  for(i=0;i<all.length;i++) if(all[i].boek===l.boek&&all[i].deel===l.deel) break;
  if(i===0||i>=all.length||passed(all[i-1],nv)) return null;
  return 'Op slot: haal eerst '+lvName(all[i-1])+' op '+NIV[nv]+'.';
}
function unitText(stof,n){return isR(stof)?n+(n===1?' vraag':' vragen'):n+' '+STOF[stof].unit[n===1?0:1];}
function lvName(l){return l.code?'Level '+l.code:l.eind?'Eindstation '+(l.boek==='Eigen'?'eigen woorden':l.boek):'Eigen woorden';}
/* elk woord telt per keer goed (tot cfg('need')) mee: 1 keer goed is halverwege */
function points(l,niv){return levelIds(l).reduce(function(a,id){return a+Math.min(cfg('need'),streakOf(niv,id));},0);}
function pctOf(l,niv){var p=points(l,niv),n=cfg('need')*levelIds(l).length;return p>=n&&n?100:Math.floor(p*100/Math.max(1,n));}
function pctAll(l){return Math.floor((pctOf(l,'beg')+pctOf(l,'adv'))/2);}
function bar(p,cls){return h('span',{class:'bar'+(cls?' '+cls:''),role:'progressbar','aria-valuenow':String(p),'aria-valuemin':'0','aria-valuemax':'100'},h('i',{style:'width:'+p+'%'}));}
/* voortgang per niveau: label, balk en percentage */
function progRow(l,niv){
  var k=known(l,niv),n=levelIds(l).length,p=pctOf(l,niv);
  return h('div',{class:'prog'},
    h('span',{class:'pl'},NIV[niv]),bar(p,niv),
    h('span',{class:'pv'},h('b',null,p+'%'),' '+k+' van '+n+(half(l,niv)?' · '+half(l,niv)+' halverwege':'')));
}
function curLevel(){
  var r=state.route;
  return flat(lines(r.stof)).filter(function(l){return l.boek===r.boek&&l.deel===r.deel;})[0]||null;
}

/* ---------- ui ---------- */
var ui={screen:state.updated?'line':'home',run:null,queue:null,shown:false,typed:null,del:null};
var view=document.getElementById('view');
function render(){
  memo={};
  stopTimer();
  var de=document.documentElement;
  de.setAttribute('data-ar',cfg('arz'));
  if(cfg('theme')==='auto') de.removeAttribute('data-theme'); else de.setAttribute('data-theme',cfg('theme'));
  var sb=document.getElementById('settings');
  if(sb) sb.hidden=!admin();
  if(ui.screen==='settings'&&!admin()) ui.screen='line';
  view.textContent='';
  fixRoute();
  var mb=document.getElementById('mode');
  if(mb){mb.textContent=(admin()?'Admin':'Gebruiker');mb.setAttribute('aria-pressed',String(admin()));}
  if(admin()) view.appendChild(h('div',{class:'admbar'},
    h('span',null,h('b',null,'Admin: '),'alles is open en wat je oefent telt niet mee voor je eigen voortgang.'),
    h('button',{class:'btn sm',type:'button',onclick:function(){
      if(ui.wis){state.adm=L.admNorm();ui.wis=false;save();}else ui.wis=true;
      render();
    }},ui.wis?'Zeker wissen?':'Admin-voortgang wissen')));
  ({home:vHome,line:vLine,level:vLevel,map:vMap,settings:vSettings,progress:vProgress,run:vSession}[ui.screen]||vHome)();
}
/* aftellen op een knop; elke nieuwe weergave stopt een lopende aftelling */
function stopTimer(){if(ui.timer){clearInterval(ui.timer);ui.timer=null;}}
function countdown(btn,secs,label,fn){
  var n=secs;stopTimer();btn.textContent=label+' ('+n+')';
  ui.timer=setInterval(function(){n--;if(n<=0){stopTimer();fn();}else btn.textContent=label+' ('+n+')';},1000);
}
/* na het halen van een level: het eerstvolgende level dat op hetzelfde niveau nog niet gehaald is */
function nextAfter(l,niv){
  var all=flat(lines(l.stof)).filter(function(x){return x.nr!=null;}),i,j;
  for(i=all.length-1;i>=0;i--) if(all[i].boek===l.boek&&(l.eind||all[i].deel===l.deel)) break;
  if(i>=0) for(j=i+1;j<all.length;j++) if(!passed(all[j],niv)&&!lockOf(all[j])) return {l:all[j],niv:niv};
  return nextStop(l.stof);
}
/* direct vertrekken naar een level met de laatst gekozen instellingen (een toets als er Lijst stond) */
function departTo(l,niv){
  var r=state.route;
  if(lockOf(l)) return;
  r.stof=l.stof;r.boek=l.boek;r.deel=l.deel;r.niv=niv||r.niv;
  if(r.vorm==='list') r.vorm='quiz';
  fixRoute();save();depart();
}
function go(screen){ui.screen=screen;render();window.scrollTo(0,0);}
function depart(){ui.screen='run';ui.run=null;ui.queue=null;ui.shown=false;ui.typed=null;ui.del=null;render();window.scrollTo(0,0);}
function toStation(){go('level');}
function openLevel(l,niv){
  var r=state.route;
  if(lockOf(l)) return;
  r.stof=l.stof;r.boek=l.boek;r.deel=l.deel;
  if(niv) r.niv=niv;
  fixRoute();save();go('level');
}
function back(label,screen){
  return h('div',{class:'row'},h('button',{class:'btn sm',type:'button',id:'back',onclick:function(){go(screen);}},'← '+label));
}

/* ---------- het station ---------- */
function stop(n,name,opts,cur,on,note,cls){
  var off=!opts.length||opts.every(function(o){return o[3];});
  return h('section',{class:'stop'+(off?' off':'')+(cls?' '+cls:'')},
    h('div',{class:'rail'},h('span',{class:'node'},String(n))),
    h('div',{class:'halt'},
      h('h3',null,name),
      opts.length?h('div',{class:'sporen'},opts.map(function(o){
        return h('button',{class:'spoor',type:'button','aria-pressed':String(!o[3]&&o[0]===cur),disabled:!!o[3],onclick:function(){on(o[0]);}},
          h('b',null,o[1]),o[2]!=null&&o[2]!==''?h('small',null,String(o[2])):null);
      })):null,
      note?h('p',{class:'small muted'},note):null));
}
function setRoute(k){return function(v){state.route[k]=v;fixRoute();save();render();};}

/* 1. kies een lijn (categorie) */
function vHome(){
  var t=today(),ready=0,left=newLeft(),nw=0;
  ['w','p','s'].forEach(function(k){cardItems(k).forEach(function(x){var s=pr().srs[x.id];if(!s) nw++;else if(s.due<=t) ready++;});});
  ready+=Math.min(nw,left);
  view.appendChild(h('section',{class:'panel'},
    h('div',{class:'row spread'},h('h2',null,'Kies je lijn'),h('button',{class:'btn sm',type:'button',onclick:function(){go('progress');}},'Voortgang')),
    h('div',{class:'stats'},
      h('div',{class:'stat'},h('b',null,ready),h('span',null,'kaarten klaar voor herhaling')),
      h('div',{class:'stat'},h('b',null,pr().days[t]||0),h('span',null,'geoefend vandaag')),
      h('div',{class:'stat'},h('b',null,streak()),h('span',null,'dagen op rij')))));
  view.appendChild(h('div',{class:'lijnen'},['w','p','s','n','k'].map(function(k){
    var lv=flat(lines(k)).filter(function(l){return l.nr!=null;});
    var b=lv.filter(function(l){return passed(l,'beg');}).length,a=lv.filter(function(l){return passed(l,'adv');}).length;
    var total=isR(k)?qCount(k):cardItems(k).length,nx=nextStop(k);
    var kn=0,all=0;lv.forEach(function(l){kn+=points(l,'beg')+points(l,'adv');all+=2*cfg('need')*levelIds(l).length;});
    var p=Math.round(kn*100/Math.max(1,all));
    return h('button',{class:'lijn',type:'button',onclick:function(){state.route.stof=k;fixRoute();save();go('line');}},
      h('span',{class:'ic','aria-hidden':'true'},STOF[k].t.charAt(0)),
      h('b',null,STOF[k].full),
      h('small',null,lv.length?lv.length+' levels · '+unitText(k,total):'nog leeg'),
      lv.length?bar(p):null,
      lv.length?h('small',null,p+'% afgerond · levels gehaald: Beginner '+b+' van '+lv.length+', Gevorderd '+a+' van '+lv.length+(nx?' · volgende: '+lvName(nx.l):'')):null);
  })));
  view.appendChild(h('p',{class:'note'},'Naḥw is grammatica. Klank is uitspraak en klinkertekens. Leesoefeningen uit het boek zitten niet in de app. Alle inhoud komt uit jouw eigen boeken en aantekeningen.'));
}

/* 2. de lijn van één categorie: levels in de volgorde van de boeken */
function pip(t,on,title){return h('span',{class:'pip'+(on?' on':''),title:title},t);}
function vLine(){
  var stof=state.route.stof,groups=lines(stof),nx=nextStop(stof);
  view.appendChild(h('div',{class:'row spread'},back('Alle lijnen','home'),h('button',{class:'btn sm',type:'button',onclick:function(){go('progress');}},'Voortgang')));
  view.appendChild(h('h2',null,STOF[stof].full));
  if(STOF[stof].doel) view.appendChild(h('p',{class:'note'},STOF[stof].doel));
  if(!groups.length){
    view.appendChild(emptyPanel('Nog geen inhoud',STOF[stof].empty||'',STOF[stof].need||[]));
    if(!isR(stof)) view.appendChild(addForm(stof));
    return;
  }
  if(nx) view.appendChild(h('div',{class:'depart'},
    h('div',{class:'board'},h('small',null,'Volgende halte'),h('div',{class:'route'},STOF[stof].t+' '+lvName(nx.l)+' · '+nx.l.titel+'  ›  '+NIV[nx.niv]+' ('+pctOf(nx.l,nx.niv)+'%)')),
    h('div',{class:'row'},
      h('button',{class:'btn primary grow',type:'button',onclick:function(){departTo(nx.l,nx.niv);}},'Ga verder'),
      h('button',{class:'btn',type:'button',onclick:function(){openMap(curLevel(),nx.l,nx.niv,1);}},'Routekaart'))));
  else view.appendChild(h('button',{class:'btn',type:'button',onclick:function(){openMap(curLevel(),null,'adv',1);}},'Routekaart'));
  view.appendChild(h('p',{class:'small muted'},'Elk level heeft twee niveaus: B is Beginner (meerkeuze), G is Gevorderd (zelf typen). Elk woord of elke vraag telt mee: 1 keer goed in een toets is halverwege, '+cfg('need')+' keer achter elkaar goed is beheerst. Een fout zet dat woord terug op nul. Wat je op Gevorderd goed hebt, telt ook voor Beginner. '+(admin()?'Admin: alle levels zijn open om te testen.':(cfg('lock')==='open'?'Alle levels zijn open.':'Een level gaat open zodra je het vorige op '+NIV[cfg('lock')]+' hebt gehaald.'))));
  groups.forEach(function(g){
    view.appendChild(h('h3',{class:'boekkop'},g.label));
    view.appendChild(h('div',{class:'line levels'},g.levels.map(function(l,i){
      var b=passed(l,'beg'),a=passed(l,'adv'),isNext=nx&&nx.l.boek===l.boek&&nx.l.deel===l.deel,p=pctAll(l),lock=lockOf(l);
      return h('section',{class:'stop'+(i===g.levels.length-1?' end':'')},
        h('div',{class:'rail'},h('span',{class:'node'+(a?' full':b?' half':'')+(lock?' locked':'')},l.code||(l.eind?'★':'+'))),
        h('div',{class:'halt'},
          h('button',{class:'level'+(isNext?' next':'')+(l.eind?' eind':'')+(lock?' locked':''),type:'button',disabled:!!lock,onclick:function(){openLevel(l,isNext?nx.niv:null);}},
            h('span',{class:'lt'},
              h('small',{class:'lk'},STOF[stof].t+' '+lvName(l)+(isNext?' · volgende halte':'')),
              h('b',null,l.titel),
              h('small',null,lock||unitText(stof,l.n)),
              h('span',{class:'mini'},
                h('span',null,'B'),bar(pctOf(l,'beg'),'beg'),h('span',null,pctOf(l,'beg')+'%'),
                h('span',null,'G'),bar(pctOf(l,'adv'),'adv'),h('span',null,pctOf(l,'adv')+'%'))),
            h('span',{class:'lp'+(p===100?' done':'')},h('b',null,p+'%'),h('small',null,p===100?'gehaald':'afgerond')))));
    })));
  });
  if(!isR(stof)) view.appendChild(addForm(stof));
}

/* 3. één level: niveau, oefenvorm, richting en nakijken */
function vLevel(){
  var r=state.route,l=curLevel();
  if(!l||lockOf(l)){go('line');return;}
  var isN=isR(r.stof),isList=r.vorm==='list';
  view.appendChild(h('div',{class:'row spread'},back(STOF[r.stof].t,'line'),
    h('div',{class:'row'},
      admin()?h('button',{class:'btn sm',type:'button',onclick:function(){r.vorm='list';save();depart();}},'Inhoud bewerken'):null,
      h('button',{class:'btn sm',type:'button',onclick:function(){var nx=nextStop(r.stof);openMap(l,nx?nx.l:null,nx?nx.niv:'adv',3);}},'Routekaart'))));
  view.appendChild(h('section',{class:'panel'},
    h('small',{class:'kicker'},STOF[r.stof].t+' · '+lvName(l)+' · '+l.boek),
    h('h2',null,l.titel),
    h('p',{class:'muted small'},unitText(r.stof,l.n)+' · '+pctAll(l)+'% van het level afgerond'),
    progRow(l,'beg'),progRow(l,'adv'),
    h('p',{class:'small muted'},'1 keer goed in een toets = halverwege, '+cfg('need')+' keer achter elkaar goed = beheerst. Gevorderd telt ook voor Beginner. Het level is gehaald als beide niveaus op 100% staan.')));

  var nivNote=isList?'Bij Lijst rijdt de trein hier door.'
    :isN?'Beginner: meerkeuze. Gevorderd: antwoorden in het Arabisch typ je zelf. Vragen met een omschrijving als antwoord blijven meerkeuze.'
    :r.vorm==='review'?'Beginner: je bedenkt het antwoord, draait de kaart om en beoordeelt jezelf. Gevorderd: je typt het antwoord en de app kijkt het na.'
    :'Beginner: je kiest uit meerdere antwoorden. Gevorderd: je typt het antwoord zelf.';
  var stops=[
    ['Niveau',[['beg','Beginner',(r.vorm==='review'?'kaart omdraaien':'meerkeuze')+(passed(l,'beg')?' · gehaald':''),isList],
               ['adv','Gevorderd','zelf typen'+(passed(l,'adv')?' · gehaald':''),isList]],r.niv,setRoute('niv'),nivNote],
    ['Oefenvorm',[['review','Herhalen','kaarten met slimme herhaling',isN],['quiz','Toets','telt voor je voortgang'],['list',isN?'Regels':'Lijst','alles op een rij']],r.vorm,setRoute('vorm'),
      isN?'Bij Naḥw en Klank zijn er geen kaarten om te herhalen. Kies Toets of Regels.':'Alleen een toets telt mee voor beheersing. Elke ronde kiest eerst wat je nog niet beheerst; doe rondes tot alles beheerst is.']
  ];
  if(r.vorm==='quiz') stops.push(['Lengte',[['kort','Korte ronde',isN?'8 vragen':'10 vragen'],['heel','Hele level','alles wat je nog niet beheerst ('+(levelIds(l).length-known(l,r.niv)||levelIds(l).length)+')']],r.len,setRoute('len'),
    'Elke ronde begint met wat je het minst beheerst.']);
  if(!isN) stops.push(['Richting',[['an','Arabisch → Nederlands','vertalen',isList],['na','Nederlands → Arabisch','terugvertalen',isList]],r.richt,setRoute('richt'),
    isList?'Bij Lijst rijdt de trein hier door.':r.richt==='an'?'Je ziet het Arabisch en geeft de betekenis.':'Je ziet de betekenis en geeft het Arabisch met tashkeel.']);
  stops.push(['Nakijken',[['now','Direct','na elke vraag',r.vorm!=='quiz'],['later','Achteraf','na de laatste vraag',r.vorm!=='quiz']],r.kijk,setRoute('kijk'),
    r.vorm==='quiz'?null:'Alleen bij Toets kies je hoe er wordt nagekeken.']);
  view.appendChild(h('div',{class:'line'},stops.map(function(s,i){
    return stop(i+1,s[0],s[1],s[2],s[3],s[4],i===stops.length-1?'end':null);
  })));

  var n=pool().length,can=isList||n>0;
  view.appendChild(h('div',{class:'depart'},
    h('div',{class:'board'},h('small',null,'Vertrek'),h('div',{class:'route'},routeText())),
    h('button',{class:'btn primary',type:'button',id:'depart',disabled:!can,onclick:depart},can?'Vertrek':'Op deze route rijdt nog geen trein')));
}

/* 4. de routekaart: waar ben ik, waar ga ik heen, wat ligt er nog voor me. Drie zoomstanden:
   1 = hele route (alle boeken als stippen), 2 = één boek met namen, 3 = dichtbij (de haltes rond je bestemming) */
var ZOOM=['','Hele route','Boek','Dichtbij'];
function lkey(l){return l?l.boek+'|'+l.deel:null;}
function openMap(here,to,niv,z,auto){ui.map={here:lkey(here),to:lkey(to),niv:niv||'beg',z:z||2,auto:!!auto&&!!to};go('map');}
function lvState(l,m){
  var k=lkey(l),c=[];
  if(k===m.here) c.push('here');
  if(k===m.to) c.push('to');
  if(passed(l,'adv')) c.push('full');else if(passed(l,'beg')) c.push('half');
  if(lockOf(l)) c.push('locked');
  return c.join(' ');
}
function tag(l,m){
  var k=lkey(l);
  return k===m.here&&k===m.to?'Je bent hier':k===m.here?'Je bent hier':k===m.to?'Bestemming':'';
}
function vMap(){
  var m=ui.map,stof=state.route.stof,groups=lines(stof),all=flat(groups),num=all.filter(function(l){return l.nr!=null;});
  var here=all.filter(function(l){return lkey(l)===m.here;})[0],to=all.filter(function(l){return lkey(l)===m.to;})[0];
  var ti=to?num.indexOf(to):-1,ahead=num.filter(function(l,i){return i>ti&&!passed(l,'beg');}).length;
  var pts=0,max=0;num.forEach(function(l){pts+=points(l,'beg')+points(l,'adv');max+=2*cfg('need')*levelIds(l).length;});
  var routePct=Math.floor(pts*100/Math.max(1,max)),doneN=num.filter(function(l){return passed(l,'beg');}).length;
  var books=uniq(ahead?num.filter(function(l,i){return i>ti;}).map(function(l){return l.boek;}):[]);

  view.appendChild(back(STOF[stof].t,'line'));
  view.appendChild(h('section',{class:'panel mapsum'},
    h('small',{class:'kicker'},'Routekaart · '+STOF[stof].full),
    h('div',{class:'mrow'},h('span',{class:'mdot here'}),h('span',null,h('small',null,'Je bent hier'),h('b',null,here?lvName(here)+' · '+here.titel+' ('+pctAll(here)+'%)':'Station: nog niet vertrokken'))),
    to?h('div',{class:'mrow'},h('span',{class:'mdot to'}),h('span',null,h('small',null,'Bestemming'),h('b',null,lvName(to)+' · '+to.titel+' · '+NIV[m.niv]))):
      h('div',{class:'mrow'},h('span',{class:'mdot full'}),h('span',null,h('small',null,'Bestemming'),h('b',null,'Eindpunt bereikt: alle levels gehaald'))),
    h('div',{class:'mrow'},h('span',{class:'mdot'}),h('span',null,h('small',null,'Nog voor je'),
      h('b',null,ahead?ahead+(ahead===1?' level':' levels')+' na je bestemming, in '+books.join(', '):'Na deze halte niets meer op deze lijn'))),
    bar(routePct),
    h('p',{class:'small muted'},'Route '+routePct+'% afgerond · '+doneN+' van '+num.length+' levels gehaald op Beginner')));

  /* zoomknoppen; op een touchscherm werkt ook knijpen met twee vingers */
  function zoom(d){var z=Math.min(3,Math.max(1,m.z+d));if(z!==m.z){m.z=z;m.auto=false;render();}}
  view.appendChild(h('div',{class:'zoom',role:'group','aria-label':'Zoom'},
    h('button',{class:'btn sm',type:'button','aria-label':'Uitzoomen',disabled:m.z===1,onclick:function(){zoom(-1);}},'−'),
    [1,2,3].map(function(z){return h('button',{class:'btn sm ghost',type:'button','aria-pressed':String(z===m.z),onclick:function(){m.z=z;m.auto=false;render();}},ZOOM[z]);}),
    h('button',{class:'btn sm',type:'button','aria-label':'Inzoomen',disabled:m.z===3,onclick:function(){zoom(1);}},'+')));

  var map=h('div',{class:'map z'+m.z});
  if(m.z===1){
    groups.forEach(function(g){
      var nl=g.levels.filter(function(l){return l.nr!=null;});
      map.appendChild(h('div',{class:'mbook'},
        h('div',{class:'mhead'},h('b',null,g.label),h('small',null,nl.filter(function(l){return passed(l,'beg');}).length+' van '+nl.length+' gehaald')),
        h('div',{class:'dots'},g.levels.map(function(l){
          return h('button',{class:'dot '+lvState(l,m)+(l.eind?' eind':''),type:'button',title:lvName(l)+' · '+l.titel+' · '+pctAll(l)+'%',
            'aria-label':lvName(l)+' '+l.titel+', '+pctAll(l)+' procent'+(tag(l,m)?', '+tag(l,m):''),
            onclick:function(){m.focus=lkey(l);m.z=2;m.auto=false;render();}},l.eind?'★':(l.code||'+').split('.')[1]||'+');
        }))));
    });
  }else if(m.z===2){
    var fk=m.focus||m.to||m.here,fb=(all.filter(function(l){return lkey(l)===fk;})[0]||all[0]).boek;
    var gi=groups.map(function(g){return g.boek;}).indexOf(fb),g=groups[gi];
    map.appendChild(h('div',{class:'row spread'},
      h('button',{class:'btn sm',type:'button',disabled:gi<=0,onclick:function(){m.focus=lkey(groups[gi-1].levels[0]);m.auto=false;render();}},'← '+(gi>0?groups[gi-1].label:'')),
      h('b',null,g.label),
      h('button',{class:'btn sm',type:'button',disabled:gi>=groups.length-1,onclick:function(){m.focus=lkey(groups[gi+1].levels[0]);m.auto=false;render();}},(gi<groups.length-1?groups[gi+1].label:'')+' →')));
    map.appendChild(h('div',{class:'mlist'},g.levels.map(function(l){
      var t=tag(l,m);
      return h('div',{class:'mst '+lvState(l,m)},
        h('span',{class:'mnode'},l.code||(l.eind?'★':'+')),
        h('span',{class:'mtxt'},h('b',null,l.titel),h('small',null,(t?t+' · ':'')+pctAll(l)+'%'+(lockOf(l)?' · op slot':''))),
        bar(pctAll(l)));
    })));
  }else{
    var c=to||here,ci=all.indexOf(c),near=all.slice(Math.max(0,ci-2),ci+4);
    map.appendChild(h('div',{class:'mnear'},near.map(function(l){
      var t=tag(l,m);
      return h('div',{class:'mcard '+lvState(l,m)},
        h('span',{class:'mnode'},l.code||(l.eind?'★':'+')),
        h('div',{class:'mtxt'},
          t?h('small',{class:'kicker'},t):h('small',{class:'kicker'},lvName(l)+' · '+l.boek),
          h('b',null,l.titel),
          h('small',null,unitText(stof,l.n)+(lockOf(l)?' · '+lockOf(l):'')),
          progRow(l,'beg'),progRow(l,'adv')));
    })));
  }
  /* knijpen om te zoomen */
  var d0=0;
  map.addEventListener('touchstart',function(e){if(e.touches.length===2) d0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});
  map.addEventListener('touchmove',function(e){
    if(e.touches.length!==2||!d0) return;
    var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    if(d/d0>1.3){d0=0;zoom(1);}else if(d/d0<0.75){d0=0;zoom(-1);}
  },{passive:true});
  view.appendChild(map);

  var dep=to?h('button',{class:'btn primary',type:'button',id:'depart',onclick:function(){departTo(to,m.niv);}},'Vertrek naar '+lvName(to)+' ('+NIV[m.niv]+')'):null;
  var wait=m.auto&&cfg('autoFlow')?h('button',{class:'btn',type:'button',onclick:function(){m.auto=false;render();}},'Wacht, ik kijk eerst rond'):null;
  view.appendChild(h('div',{class:'depart'},dep,wait,
    to?h('button',{class:'btn',type:'button',onclick:function(){m.auto=false;openLevel(to,m.niv);}},'Eerst de instellingen van '+lvName(to)+' bekijken'):null));
  if(m.auto&&cfg('autoFlow')) countdown(dep,5,'Vertrek naar '+lvName(to)+' ('+NIV[m.niv]+')',function(){departTo(to,m.niv);});
}

/* 5. Instellingen (alleen als Admin): standaardkeuzes, voortgangsregels, automatisch doorgaan, weergave en gegevens */
function setRow(label,opts,cur,on,note){
  return h('div',{class:'setrow'},h('b',null,label),
    h('div',{class:'sporen plain'},opts.map(function(o){
      return h('button',{class:'spoor',type:'button','aria-pressed':String(String(o[0])===String(cur)),onclick:function(){on(o[0]);}},h('b',null,o[1]),o[2]?h('small',null,o[2]):null);
    })),
    note?h('p',{class:'small muted'},note):null);
}
function setS(k){return function(v){state.set[k]=v;save();render();};}
function setR(k){return function(v){state.route[k]=v;fixRoute();save();render();};}
function itemById(id){
  var all=[].concat(CONTENT.woorden,CONTENT.vnw,CONTENT.werkw),x=all.filter(function(y){return y.id===id;})[0],e=state.ed[id];
  if(e&&e.nieuw) return e;
  return x||state.words[id]||null;
}
/* welke aanpassingen staan al in de lesstof (klaar), en welke horen bij een item dat er niet meer is (wees)? */
function edStatus(){
  var cards={},regs={},out={klaar:[],wees:[]};
  [].concat(CONTENT.woorden,CONTENT.vnw,CONTENT.werkw).forEach(function(x){cards[x.id]=x;});
  CONTENT.regels.forEach(function(r){regs[r.id]=r;});
  Object.keys(state.ed).forEach(function(id){
    var e=state.ed[id],x=cards[id]||regs[id],gelijk;
    if(e.nieuw){if(e.del?!cards[id]:!!cards[id]) out.klaar.push(id);return;}
    if(e.del){if(!x) out.klaar.push(id);return;}
    if(!x){out.wees.push(id);return;}
    gelijk=Object.keys(e).every(function(k){return String(x[k]==null?'':x[k])===String(e[k]);});
    if(gelijk) out.klaar.push(id);
  });
  return out;
}
function vSettings(){
  var r=state.route,alts=Object.keys(state.alt).filter(function(id){return state.alt[id]&&state.alt[id].length;});
  var eds=Object.keys(state.ed),nMod=0,nNew=0,dels=[];
  eds.forEach(function(id){var e=state.ed[id];if(e.nieuw){if(!e.del) nNew++;}else if(e.del) dels.push(id);else nMod++;});
  view.appendChild(back(STOF[r.stof].t,'line'));
  view.appendChild(h('h2',null,'Instellingen'));
  view.appendChild(h('p',{class:'small muted'},'Deze instellingen gelden voor de hele app, ook als Gebruiker. Ze worden met je voortgang bewaard op al je apparaten.'));

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Oefenen'),
    setRow('Niveau',[['beg','Beginner','meerkeuze'],['adv','Gevorderd','zelf typen']],r.niv,setR('niv')),
    setRow('Richting bij woorden',[['an','Arabisch → Nederlands'],['na','Nederlands → Arabisch']],r.richt,setR('richt')),
    setRow('Nakijken',[['now','Direct','na elke vraag'],['later','Achteraf','na de laatste vraag']],r.kijk,setR('kijk')),
    setRow('Lengte van een toets',[['kort','Korte ronde',cfg('kort')+' vragen'],['heel','Hele level','alles wat nog niet beheerst is']],r.len,setR('len')),
    setRow('Vragen in een korte ronde',[[5,'5'],[10,'10'],[15,'15'],[20,'20']],cfg('kort'),setS('kort'))));

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Voortgang'),
    setRow('Beheerst na',[[1,'1 keer goed'],[2,'2 keer achter elkaar'],[3,'3 keer achter elkaar']],cfg('need'),setS('need'),'Hoe vaak een woord of vraag achter elkaar goed moet zijn in een toets.'),
    setRow('Levels openen (Gebruiker)',[['beg','Na Beginner'],['adv','Na Gevorderd'],['open','Altijd open']],cfg('lock'),setS('lock'),'Wanneer het volgende level op de lijn opengaat.'),
    setRow('Nieuwe kaarten per dag (Herhalen)',[[5,'5'],[10,'10'],[20,'20'],[30,'30']],cfg('perDay'),setS('perDay'))));

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Automatisch'),
    setRow('Door na een goed antwoord',[[0,'Uit'],[1,'1 s'],[2,'2 s'],[3,'3 s']],cfg('autoSec'),setS('autoSec')),
    setRow('Volgende ronde en volgend level',[[true,'Automatisch','met aftellen'],[false,'Zelf kiezen','met knoppen']],cfg('autoFlow'),function(v){state.set.autoFlow=v===true||v==='true';save();render();})));

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Weergave'),
    setRow('Arabische letters',[['m','Normaal'],['l','Groot'],['xl','Extra groot']],cfg('arz'),setS('arz')),
    setRow('Thema',[['auto','Zoals je apparaat'],['light','Licht'],['dark','Donker']],cfg('theme'),setS('theme')),
    setRow('Toetsenbord bij typen in het Arabisch',[['app','Toetsenbord van de app'],['own','Eigen toetsenbord']],state.kb,function(v){state.kb=v;save();render();})));

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Zelf goedgekeurde antwoorden'),
    alts.length?h('div',{class:'wlist'},alts.map(function(id){
      var x=itemById(id);
      return h('div',{class:'w'},
        h('div',{class:'nl'},x?x.nl:id,h('small',null,'Ook goed: '+state.alt[id].map(function(a){return '‘'+a+'’';}).join(', '))),
        x?ar(x.ar,'','div'):h('span',null),
        h('button',{class:'btn sm ghost',type:'button',onclick:function(){delete state.alt[id];save();render();}},'Wis'));
    })):h('p',{class:'small muted'},'Nog geen. Tik bij een fout getypte betekenis op "Toch goed rekenen", dan komt je antwoord hier als goed antwoord bij.')));

  var st=edStatus(),wees=st.wees,klaar=st.klaar;
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Aanpassingen in de lesstof'),
    h('p',{class:'small'},nMod+' aangepast · '+nNew+' toegevoegd · '+dels.length+' verwijderd'),
    h('p',{class:'small muted'},'Aanpassen of toevoegen doe je als Admin in een level via "Inhoud bewerken". Het origineel uit je boek blijft bewaard. Om ze vast in de lesstof te zetten: npm run edits en npm run upload op de pc.'),
    wees.length?h('div',{class:'admbar'},h('span',null,h('b',null,'Let op: '),wees.length+(wees.length===1?' aanpassing hoort':' aanpassingen horen')+' bij een item dat niet meer in de lesstof staat: '+wees.join(', ')+'. Die doet niets meer.'),
      h('button',{class:'btn sm',type:'button',onclick:function(){wees.forEach(function(id){delete state.ed[id];});save();render();}},'Wis deze')):null,
    eds.length?h('div',{class:'row'},h('button',{class:'btn',type:'button',disabled:!klaar.length,onclick:function(){
      if(!ui.verwerkt){ui.verwerkt=true;render();return;}
      klaar.forEach(function(id){delete state.ed[id];});ui.verwerkt=false;save();render();
    }},ui.verwerkt?'Zeker? '+klaar.length+' weghalen uit de app':'Aanpassingen zijn verwerkt in de lesstof'),
      h('small',{class:'muted'},klaar.length+' van '+eds.length+' staan al in de lesstof'+(eds.length-klaar.length?'; de rest blijft in de app staan':'')+'.')):null,
    dels.length?h('div',{class:'wlist'},dels.map(function(id){
      var x=itemById(id);
      return h('div',{class:'w'},h('div',{class:'nl'},x?x.nl:id,h('small',null,'verwijderd')),x?ar(x.ar,'','div'):h('span',null),
        h('button',{class:'btn sm ghost',type:'button',onclick:function(){delete state.ed[id].del;if(!Object.keys(state.ed[id]).length) delete state.ed[id];save();render();}},'Terugzetten'));
    })):null));

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Gegevens'),
    h('div',{class:'row'},
      h('button',{class:'btn',type:'button',onclick:function(){
        var a=document.createElement('a'),b=new Blob([JSON.stringify(state,null,1)],{type:'application/json'});
        a.href=URL.createObjectURL(b);a.download='daftar-voortgang-'+new Date().toISOString().slice(0,10)+'.json';
        document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1000);
      }},'Voortgang downloaden'),
      h('button',{class:'btn',type:'button',onclick:function(){state.set={};save();render();}},'Standaardinstellingen terugzetten')),
    h('div',{class:'row'},
      h('button',{class:'btn',type:'button',onclick:function(){
        if(ui.wis){state.adm=L.admNorm();ui.wis=false;save();}else ui.wis=true;render();
      }},ui.wis?'Zeker Admin-voortgang wissen?':'Admin-voortgang wissen'))));
}

/* 6. Voortgang: grafieken over consistentie, beheersing, mijlpalen, tijd en activiteit */
function masteryOf(ids){
  var n=cfg('need'),o={tot:ids.length,adv:0,beg:0,half:0};
  ids.forEach(function(id){var b=streakOf('beg',id),a=streakOf('adv',id);if(a>=n) o.adv++;if(b>=n) o.beg++;else if(b>0) o.half++;});
  return o;
}
function catIds(k){
  if(!isR(k)) return cardItems(k).map(function(x){return x.id;});
  return vragenVan(rules(k).map(function(x){return x.id;})).map(function(q){return q.id;});
}
function dayLabel(d){var x=new Date(d*864e5);return x.getUTCDate()+'/'+(x.getUTCMonth()+1);}
function wday(d){return (new Date(d*864e5).getUTCDay()+6)%7;}   /* 0 = maandag */
function hm(sec){var m=Math.round(sec/60);return m<60?m+' min':Math.floor(m/60)+' u '+(m%60)+' min';}
function stack(o,unit){
  var t=Math.max(1,o.tot),pa=o.adv*100/t,pb=(o.beg-o.adv)*100/t,ph=o.half*100/t;
  return h('div',{class:'stackwrap'},
    h('div',{class:'stack',role:'img','aria-label':o.beg+' van '+o.tot+' herkend, '+o.adv+' zelf, '+o.half+' halverwege'},
      h('i',{class:'s-adv',style:'width:'+pa+'%'}),h('i',{class:'s-beg',style:'width:'+pb+'%'}),h('i',{class:'s-half',style:'width:'+ph+'%'})),
    h('small',null,o.beg+' van '+o.tot+' '+unit+' herkend ('+Math.floor(o.beg*100/t)+'%) · '+o.adv+' zelf · '+o.half+' halverwege'));
}
function legend(){
  return h('div',{class:'legend'},
    h('span',null,h('i',{class:'s-adv'}),'Beheerst op Gevorderd'),h('span',null,h('i',{class:'s-beg'}),'Beheerst op Beginner'),
    h('span',null,h('i',{class:'s-half'}),'Halverwege'),h('span',null,h('i',{class:'s-none'}),'Nog niet'));
}
/* staafjes per dag; vals: [{d, v, sub}] */
function dayBars(vals,fmt,cls){
  var max=Math.max.apply(null,vals.map(function(x){return x.v;}).concat([1]));
  return h('div',{class:'dbars '+(cls||'')},vals.map(function(x){
    return h('div',{class:'dbar',title:dayLabel(x.d)+': '+fmt(x.v)+(x.sub?' · '+x.sub:'')},
      h('span',{class:'dv'},x.v?fmt(x.v):''),
      h('span',{class:'dcol'},h('i',{style:'height:'+Math.round(x.v*100/max)+'%'})),
      h('small',null,dayLabel(x.d).split('/')[0]));
  }));
}
function lineChart(pts,max){
  var w=300,hgt=110,ns='http://www.w3.org/2000/svg';
  var svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+w+' '+hgt);svg.setAttribute('class','lchart');svg.setAttribute('role','img');
  var d=pts.map(function(p,i){return (i?'L':'M')+(pts.length===1?w/2:i*(w-10)/(pts.length-1)+5).toFixed(1)+' '+(hgt-8-(p.v*(hgt-24)/Math.max(1,max))).toFixed(1);}).join(' ');
  var path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('class','ln');svg.appendChild(path);
  pts.forEach(function(p,i){var c=document.createElementNS(ns,'circle');c.setAttribute('cx',(pts.length===1?w/2:i*(w-10)/(pts.length-1)+5).toFixed(1));c.setAttribute('cy',(hgt-8-(p.v*(hgt-24)/Math.max(1,max))).toFixed(1));c.setAttribute('r','3');c.setAttribute('class','pt');svg.appendChild(c);});
  svg.setAttribute('aria-label','Groei: '+pts.map(function(p){return dayLabel(p.d)+' '+p.v;}).join(', '));
  return svg;
}
function vProgress(){
  var P0=pr(),t=today(),days=P0.days||{},time=P0.time||{},acc=P0.acc||{},hist=P0.hist||{};
  var w=masteryOf(catIds('w').concat(catIds('p'))),i,d;
  view.appendChild(back(STOF[state.route.stof].t,'line'));
  view.appendChild(h('h2',null,'Voortgang'));
  if(admin()) view.appendChild(h('p',{class:'small muted'},'Je bent Admin: dit is de voortgang van het Admin-kladblok. Schakel naar Gebruiker voor je eigen voortgang.'));

  /* reeksen */
  var act=Object.keys(days).filter(function(k){return days[k]>0;}).map(Number).sort(function(a,b){return a-b;});
  var longest=0,run=0,prev=null;act.forEach(function(x){run=prev!=null&&x===prev+1?run+1:1;longest=Math.max(longest,run);prev=x;});
  var last30=act.filter(function(x){return x>t-30;}).length;
  var totSec=Object.keys(time).reduce(function(a,k){return a+time[k];},0);

  view.appendChild(h('section',{class:'panel'},h('h3',null,'Overzicht'),
    h('div',{class:'tiles'},
      h('div',{class:'tile'},h('b',null,w.beg),h('span',null,'woorden herkend van '+w.tot)),
      h('div',{class:'tile'},h('b',null,w.adv),h('span',null,'woorden zelf kunnen maken')),
      h('div',{class:'tile'},h('b',null,streak()),h('span',null,'dagen op rij (langste '+longest+')')),
      h('div',{class:'tile'},h('b',null,hm(totSec)),h('span',null,'in de app')))));

  /* consistentie: kalender van de laatste 13 weken */
  var start=t-90;while(wday(start)!==0) start--;
  var grid=h('div',{class:'heat',role:'img','aria-label':last30+' actieve dagen in de laatste 30 dagen'});
  ['ma','di','wo','do','vr','za','zo'].forEach(function(n,r){grid.appendChild(h('small',{class:'hl',style:'grid-row:'+(r+1)},r%2?'':n));});
  var maxd=Math.max.apply(null,act.map(function(x){return days[x];}).concat([1]));
  for(d=start;d<=t;d++){
    var v=days[d]||0,lvl=!v?0:v<maxd*0.25?1:v<maxd*0.5?2:v<maxd*0.75?3:4;
    grid.appendChild(h('i',{class:'hc l'+lvl+(d===t?' today':''),style:'grid-row:'+(wday(d)+1)+';grid-column:'+(Math.floor((d-start)/7)+2),title:dayLabel(d)+': '+v+' antwoorden'}));
  }
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Consistentie'),
    h('p',{class:'small muted'},'Elk vakje is een dag; hoe donkerder, hoe meer je die dag hebt geoefend.'),grid,
    h('p',{class:'small'},last30+' van de laatste 30 dagen geoefend · '+streak()+' dagen op rij · langste reeks '+longest+' dagen')));

  /* beheersing per categorie */
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Beheersing per categorie'),legend(),
    ['w','p','s','n','k'].map(function(k){
      var o=masteryOf(catIds(k));
      return h('div',{class:'crow'},h('b',null,STOF[k].full),stack(o,isR(k)?'vragen':STOF[k].unit[1]));
    })));

  /* mijlpalen uit het eigen materiaal: per boek de levels en de herkende woorden, de eerstvolgende stap en ronde aantallen */
  var ms=L.milestones(standVoorMijlpalen(w.beg)),rd=ms.round;
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Mijlpalen'),
    ms.next?h('div',{class:'mnext'},h('small',null,'Eerstvolgende mijlpaal'),h('b',null,ms.next.text+'.')):h('div',{class:'mnext'},h('b',null,'Alle boeken zijn op Beginner en Gevorderd gehaald.')),
    h('div',{class:'crow'},
      h('b',null,'Herkende woorden: '+rd.count),
      h('div',{class:'prog'},h('span',{class:'pl'},rd.from+' → '+rd.next),bar(Math.floor((rd.count-rd.from)*100/Math.max(1,rd.next-rd.from)),'beg'),h('span',{class:'pv'},'nog '+rd.left)),
      h('small',{class:'muted'},(rd.reached?'Mijlpaal '+rd.reached+' gehaald. ':'')+'Volgende: '+rd.next+' herkende woorden (Woorden en Voornaamwoorden, op Beginner).')),
    legend(),
    ms.books.map(function(b){
      return h('div',{class:'crow'},h('b',null,b.boek),h('small',null,b.text.replace(b.boek+': ','')),
        b.words.tot?stack(masteryOf(boekWoorden(b.boek)),'woorden'):null);
    })));

  /* tijd */
  var tk=Object.keys(time).map(Number).sort(function(a,b){return a-b;}),from=tk.length?tk[0]:t;
  var week=0;for(i=0;i<7;i++) week+=time[t-i]||0;
  var actT=tk.filter(function(k){return time[k]>0;}).length;
  var tv=[];for(i=13;i>=0;i--) tv.push({d:t-i,v:Math.round((time[t-i]||0)/60)});
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Tijd in de app'),
    h('div',{class:'tiles three'},
      h('div',{class:'tile'},h('b',null,hm(totSec)),h('span',null,'totaal')),
      h('div',{class:'tile'},h('b',null,hm(week)),h('span',null,'afgelopen 7 dagen')),
      h('div',{class:'tile'},h('b',null,hm(actT?totSec/actT:0)),h('span',null,'gemiddeld per oefendag'))),
    dayBars(tv,function(v){return v+'m';},'time'),
    h('p',{class:'small muted'},'Telt de tijd dat de app open is en je iets doet (na 90 seconden niets doen stopt de klok). Bijgehouden sinds '+dayLabel(from)+'; daarvoor werd tijd nog niet gemeten.')));

  /* activiteit en score */
  var av=[];for(i=13;i>=0;i--){d=t-i;var a=acc[d];av.push({d:d,v:days[d]||0,sub:a&&a.n?Math.round(a.ok*100/a.n)+'% goed':''});}
  var an=0,ao=0;Object.keys(acc).forEach(function(k){an+=acc[k].n;ao+=acc[k].ok;});
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Activiteit (laatste 14 dagen)'),
    dayBars(av,function(v){return v;},'act'),
    h('p',{class:'small'},'Aantal antwoorden per dag'+(an?' · gemiddeld '+Math.round(ao*100/an)+'% goed (sinds het bijhouden van scores)':'')+'.')));

  /* groei */
  var hk=Object.keys(hist).map(Number).sort(function(a,b){return a-b;});
  var pts=hk.map(function(k){return {d:k,v:hist[k].w||0};});
  view.appendChild(h('section',{class:'panel'},h('h3',null,'Groei: herkende woorden'),
    pts.length>1?lineChart(pts,Math.max.apply(null,pts.map(function(p){return p.v;}).concat([10]))):
      h('p',{class:'small muted'},'Deze grafiek wordt elke dag bijgewerkt en verschijnt zodra er twee dagen zijn gemeten (vanaf morgen).'),
    pts.length?h('p',{class:'small'},pts.map(function(p){return dayLabel(p.d)+': '+p.v;}).slice(-7).join(' · ')):null));
}
/* de woorden (Woorden en Voornaamwoorden) van één boek */
function boekWoorden(b){return cardItems('w').concat(cardItems('p')).filter(function(x){return x.boek===b;}).map(function(x){return x.id;});}
/* invoer voor L.milestones: per boek de genummerde levels van alle categorieën en de herkende woorden */
function standVoorMijlpalen(wordsBeg){
  var books=BOOKS.map(function(b){
    var lv={tot:0,beg:0,adv:0},ws=masteryOf(boekWoorden(b));
    ['w','p','s','n','k'].forEach(function(k){
      flat(lines(k)).forEach(function(l){if(l.nr==null||l.boek!==b) return;lv.tot++;if(passed(l,'beg')) lv.beg++;if(passed(l,'adv')) lv.adv++;});
    });
    return {boek:b,levels:lv,words:{tot:ws.tot,beg:ws.beg}};
  }).filter(function(b){return b.levels.tot||b.words.tot;});
  var nx=null;['w','p','s','n','k'].some(function(k){nx=nextStop(k);return !!nx;});
  return {books:books,focus:nx?nx.l.boek:null,wordsBeg:wordsBeg};
}

/* ---------- de rit ---------- */
function vSession(){
  var r=state.route;
  var cl=curLevel();
  view.appendChild(h('div',{class:'runbar'},
    h('button',{class:'btn sm',type:'button',id:'back','aria-label':'Terug naar het level',onclick:toStation},'←'),
    h('span',{class:'rt'},h('b',null,cl?lvName(cl)+' · '+cl.titel:STOF[r.stof].t),
      h('small',null,(r.vorm==='list'?(isR(r.stof)?'Regels':'Lijst'):NIV[r.niv]+' · '+VORM[r.vorm]+(r.vorm==='quiz'&&r.len==='heel'?' · hele level':''))))));
  if(isR(r.stof)){
    if(r.vorm==='list') vRules(); else vRun(nahwQs,'Bij deze regel staan nog geen vragen.');
    return;
  }
  var items=pool();
  if(r.vorm==='list'){vList(r.stof,items);return;}
  if(!items.length){view.appendChild(emptyPanel('Nog geen inhoud',STOF[r.stof].empty,STOF[r.stof].need));return;}
  if(r.vorm==='review') vReview(r.stof,items);
  else vRun(function(){return deckQs(r.stof,items);},'Voor de toets zijn minstens twee verschillende kaarten nodig.');
}

/* toetsronde. vraag: {kicker, ask(), stim, say, typed, arOpts, opts:[{k,t}], ok(v), fb(v), done(ok)} */
function vRun(make,emptyMsg){
  var lv0=curLevel();
  var r=ui.run||(ui.run={list:make(),i:0,picks:[],force:{},before:lv0?pctOf(lv0,state.route.niv):0}),later=state.route.kijk==='later';
  if(!r.list.length){view.appendChild(h('section',{class:'panel'},h('p',{class:'muted'},emptyMsg)));return;}
  if(r.i>=r.list.length){vResult(r);return;}
  var q=r.list[r.i],picked=r.picks[r.i],done=picked!==undefined;
  function answer(v){
    r.picks[r.i]=v;var good=q.ok(v);q.done(good);mark(q,good);bump();accRec(good);save();
    if(later) r.i++;
    render();
    if(later&&r.i>=r.list.length) window.scrollTo(0,0);
  }
  var box=h('section',{class:'panel'},
    h('div',{class:'row spread'},h('h3',null,q.kicker),h('span',{class:'muted small'},'Vraag '+(r.i+1)+' van '+r.list.length)),
    h('p',{class:'q'},q.ask()),
    q.stim?h('div',{class:'stim'+lg(q.stim)},ar(q.stim)):null,
    q.say?h('div',{class:'say'},q.say):null);
  if(q.typed){
    if(!done) box.appendChild((q.typed==='nl'?typeBoxNl:typeBox)(later?'Volgende':'Controleer',answer));
    else box.appendChild(P('Jouw antwoord: ',shown(q.typed,picked)));
  }else{
    box.appendChild(h('div',{class:'opts'+(q.arOpts?'':' wide')},q.opts.map(function(o){
      var cls='opt'+(q.arOpts?' ar':'');
      if(done){if(q.ok(o.k)) cls+=' right';else if(o.k===picked) cls+=' wrong';}
      return h('button',{class:cls,type:'button',lang:q.arOpts?'ar':null,dir:q.arOpts?'rtl':null,disabled:done,onclick:function(){answer(o.k);}},o.t);
    })));
  }
  var nextBtn=null;
  if(done){
    nextBtn=h('button',{class:'btn primary',type:'button',id:'next',onclick:function(){r.i++;render();window.scrollTo(0,0);}},r.i+1<r.list.length?'Volgende':'Bekijk resultaat');
    box.appendChild(h('div',{class:'row nextrow'},nextBtn,softBtn(r,r.i)));
    box.appendChild(h('div',{class:'fb'},q.fb(picked)));
  }
  view.appendChild(box);
  if(done){
    nextBtn.scrollIntoView({block:'nearest'});
    if(cfg('autoSec')>0&&okAt(r,r.i)) countdown(nextBtn,cfg('autoSec'),nextBtn.textContent,function(){r.i++;render();window.scrollTo(0,0);});
  }
  if(later) view.appendChild(h('p',{class:'muted small'},'Je ziet pas na de laatste vraag wat goed en fout was, met de reden erbij.'));
}
function okAt(r,i){return !!r.force[i]||r.list[i].ok(r.picks[i]);}
/* bij een vrij getypte betekenis kan de gebruiker een afgekeurd antwoord zelf goed rekenen */
function softBtn(r,i){
  var q=r.list[i];
  if(!q.soft) return null;
  if(r.force[i]) return h('span',{class:'small muted'},'Goedgerekend en toegevoegd als goed antwoord: ‘'+String(r.picks[i]||'').trim()+'’. Je kunt dit terugdraaien bij Instellingen (als Admin).');
  if(q.ok(r.picks[i])) return null;
  return h('button',{class:'btn sm',type:'button',onclick:function(){
    var v=String(r.picks[i]||'').trim();
    r.force[i]=true;mark(q,true);
    if(v&&q.mid){var a=state.alt[q.mid]||(state.alt[q.mid]=[]);if(a.map(nlKey).indexOf(nlKey(v))<0) a.push(v.slice(0,120));}
    save();render();
  }},'Toch goed rekenen');
}
function vResult(r){
  var score=0,later=state.route.kijk==='later',rt=state.route,l=curLevel(),ok,nx,btns=[];
  r.list.forEach(function(q,i){if(okAt(r,i)) score++;});
  ok=!!l&&passed(l,rt.niv);
  var auto=null,autoLabel='',autoFn=null,pause;
  var again=h('button',{class:'btn'+(ok?'':' primary'),type:'button',onclick:function(){ui.run=null;render();window.scrollTo(0,0);}},ok?'Nieuwe ronde':'Volgende ronde');
  if(!ok){btns.push(again);if(!later){auto=again;autoLabel='Volgende ronde';autoFn=function(){ui.run=null;render();window.scrollTo(0,0);};}}
  if(ok){
    /* automatisch door naar het volgende level op hetzelfde niveau, via de routekaart */
    nx=nextAfter(l,rt.niv);
    if(nx&&!(nx.l.boek===l.boek&&nx.l.deel===l.deel)){
      auto=h('button',{class:'btn primary',type:'button',onclick:function(){openMap(l,nx.l,nx.niv,3,true);}},'');
      autoLabel='Door naar '+lvName(nx.l)+' ('+NIV[nx.niv]+')';auto.textContent=autoLabel;
      autoFn=function(){openMap(l,nx.l,nx.niv,3,true);};
      btns.push(auto);
    }
    if(rt.niv==='beg'&&!passed(l,'adv')) btns.push(h('button',{class:'btn',type:'button',onclick:function(){rt.niv='adv';save();depart();}},'Eerst dit level op Gevorderd'));
    btns.push(again);
  }
  if(!cfg('autoFlow')) auto=null;
  if(auto){
    pause=h('button',{class:'btn ghost',type:'button',onclick:function(){stopTimer();auto.textContent=autoLabel;pause.remove();}},'Pauze');
    btns.push(pause);
  }
  btns.push(h('button',{class:'btn',type:'button',onclick:function(){go('line');}},'Naar de lijn'));
  view.appendChild(h('section',{class:'panel'},
    h('h2',null,score+' van '+r.list.length+' goed'),
    l?h('div',{class:'levelres'},
      h('small',{class:'kicker'},STOF[rt.stof].t+' · '+lvName(l)+' · '+l.titel),
      h('div',{class:'big'},h('b',null,pctOf(l,rt.niv)+'%'),h('span',null,' van het level afgerond op '+NIV[rt.niv])),
      bar(pctOf(l,rt.niv),rt.niv),
      h('p',{class:'small'},known(l,rt.niv)+' van '+levelIds(l).length+' beheerst'+(half(l,rt.niv)?' · '+half(l,rt.niv)+' halverwege':'')
        +(pctOf(l,rt.niv)-r.before>0?' · +'+(pctOf(l,rt.niv)-r.before)+'% in deze ronde':pctOf(l,rt.niv)-r.before<0?' · '+(pctOf(l,rt.niv)-r.before)+'% door fouten in deze ronde':'')),
      h('p',{class:ok?'ok':'small muted'},ok?lvName(l)+' gehaald op '+NIV[rt.niv]+(rt.niv==='adv'?' (en daarmee ook op Beginner)':'')+': je beheerst alles.'
        :'1 keer goed = halverwege, 2 keer achter elkaar goed = beheerst.'+(rt.niv==='adv'?' Wat je op Gevorderd goed hebt, telt ook voor Beginner.':' Volgende rondes beginnen met wat nog niet beheerst is.'))):null,
    h('p',{class:'muted'},later?'Hieronder staat per vraag of je antwoord goed of fout was, en waarom.':(score===r.list.length?'Alles goed.':'Doe een nieuwe ronde om de fouten te herhalen.')),
    h('div',{class:'row'},btns)));
  if(auto) countdown(auto,ok?4:5,autoLabel,autoFn);
  if(!later) return;
  r.list.forEach(function(q,i){
    var v=r.picks[i],ok=okAt(r,i),mine;
    if(q.typed) mine=shown(q.typed,v);
    else{mine=q.opts.filter(function(o){return o.k===v;})[0];mine=q.arOpts?ar(mine.t,'big'):mine.t;}
    view.appendChild(h('section',{class:'panel'},
      h('div',{class:'row spread'},h('h3',null,'Vraag '+(i+1)),h('span',{class:'badge '+(ok?'ok':'no')},ok?'Goed':'Fout')),
      h('p',{class:'q'},q.ask()),
      q.stim?h('div',{class:'stim'+lg(q.stim)},ar(q.stim)):null,
      q.say?h('div',{class:'say'},q.say):null,
      P('Jouw antwoord: ',mine),
      h('div',{class:'fb'},q.fb(v)),
      softBtn(r,i)));
  });
}

/* ---------- kaarten: woorden, voornaamwoorden, werkwoorden ---------- */
function tail(x){
  var out=[];
  if(x.noot) out.push(P(x.noot));
  if(x.bron) out.push(h('p',{class:'src'},'Bron: '+x.bron));
  return out;
}
/* beoordeelt een getypt Arabisch antwoord bij een kaart (regels in L.judgeCard; stof bepaalt of de uitgang mag afwijken) */
function judgeCard(all,target,v,stof){
  var j=L.judgeCard(all,target,v,stof),other=j.other;
  if(j.kind==='exact') return {ok:true,nodes:[P(okB('Goed. '),ar(target.ar),' betekent ‘'+target.nl+'’.')].concat(tail(target))};
  if(j.kind==='empty') return {ok:false,nodes:[P(noB('Fout. '),'Je hebt niets ingevuld.'),P('Bij ‘'+target.nl+'’ hoort ',ar(target.ar),'.')].concat(tail(target))};
  if(j.kind==='synonym') return {ok:true,nodes:[P(okB('Goed. '),'Het boek geeft voor ‘'+target.nl+'’ zowel ',ar(other.ar),' als ',ar(target.ar),'.')].concat(tail(other))};
  if(j.kind==='other') return {ok:false,nodes:[
    P(noB('Fout. '),ar(v),' is hier fout, want dat betekent ‘'+other.nl+'’.'),
    P(ar(v),' zou goed zijn als er om ‘'+other.nl+'’ gevraagd werd.'),
    P('Bij ‘'+target.nl+'’ hoort ',ar(target.ar),'.')].concat(tail(target))};
  if(j.kind==='ending-ok') return {ok:true,nodes:[P(okB('Goed. '),'Het woord klopt. Alleen de klinkeruitgang wijkt af: als los woord staat het hier als ',ar(target.ar),' en jij typte ',ar(v),'.')].concat(tail(target))};
  if(j.kind==='ending') return {ok:false,nodes:[
    P(noB('Fout. '),'De letters en de stam kloppen, maar de uitgang niet: jij typte ',ar(v),' en het moet ',ar(target.ar),' zijn.')].concat(explainNodes(j.explain),[
    P(lbl('Waarom fout: '),'Bij deze kaart hoort de uitgang bij de vorm. Een andere laatste klinker geeft een andere vorm.'),
    P('Bij ‘'+target.nl+'’ hoort ',ar(target.ar),'.')],tail(target))};
  return {ok:false,nodes:[P(noB('Fout. '),ar(v),' is hier fout.')].concat(explainNodes(j.explain),[
    P(lbl('Wanneer wel goed: '),'Deze schrijfwijze komt in het ingelezen materiaal niet voor als ander woord.'),
    P('Bij ‘'+target.nl+'’ hoort ',ar(target.ar),'.')],tail(target))};
}
/* beoordeelt een getypte betekenis (Nederlands, of het Engels uit het boek) bij een kaart; de regels staan in L.judgeNl */
var nlKey=L.nlKey;
function judgeNl(all,target,v){
  var j=L.judgeNl(all,target,v,state.alt),shown='‘'+String(v||'').trim()+'’',other=j.other;
  var right=P(ar(target.ar),' betekent ‘'+target.nl+'’.');
  if(j.kind==='empty') return {ok:false,nodes:[P(noB('Fout. '),'Je hebt niets ingevuld.'),right].concat(tail(target))};
  if(j.ok) return {ok:true,nodes:[P(okB('Goed. '),ar(target.ar),' betekent ‘'+target.nl+'’.'+(j.kind==='mine'?' Jouw antwoord '+shown+' heb je eerder zelf goedgekeurd.':''))].concat(tail(target))};
  if(j.kind==='other') return {ok:false,nodes:[
    P(noB('Fout. '),shown+' is hier fout, want dat is de betekenis van ',ar(other.ar),'.'),
    P(shown+' zou goed zijn als er ',ar(other.ar),' had gestaan.'),
    P('Hier staat ',ar(target.ar),' en dat betekent ‘'+target.nl+'’.')].concat(tail(target))};
  return {ok:false,nodes:[
    P(noB('Fout. '),shown+' staat niet bij de betekenissen van dit woord.'),
    P(lbl('Wanneer wel goed: '),'Dit antwoord hoort bij geen enkel ander woord in dit onderdeel. Betekent het volgens jou hetzelfde, reken het dan zelf goed.'),
    right].concat(tail(target))};
}
/* vier vormen: richting (Arabisch naar Nederlands of andersom) maal niveau (meerkeuze of typen) */
function deckQs(stof,items){
  var r=state.route,adv=r.niv==='adv',an=r.richt==='an',all=cardItems(stof);
  return weakFirst(items,r.niv,function(x){return x.id;}).slice(0,roundLen(items.map(function(x){return x.id;}),cfg('kort'))).map(function(target){
    var q={kicker:target.deel,mid:target.id,done:function(){}};
    if(an) q.stim=target.ar; else q.say=target.q||target.nl;
    if(adv&&an){
      q.typed='nl';q.soft=true;
      q.ask=function(){return ['Typ de betekenis.'];};
      q.ok=function(v){return judgeNl(all,target,v).ok;};
      q.fb=function(v){return judgeNl(all,target,v).nodes;};
    }else if(adv){
      q.typed='ar';
      q.ask=function(){return ['Typ het Arabisch met tashkeel.'];};
      q.ok=function(v){return judgeCard(all,target,v,stof).ok;};
      q.fb=function(v){return judgeCard(all,target,v,stof).nodes;};
    }else{
      var opts=[target],p=shuffle(items),i;
      for(i=0;i<p.length&&opts.length<4;i++){
        if(opts.every(function(o){return o.nl!==p[i].nl&&o.ar!==p[i].ar;})) opts.push(p[i]);
      }
      opts=shuffle(opts);
      q.arOpts=!an;
      q.opts=opts.map(function(o){return {k:o.id,t:an?o.nl:o.ar};});
      q.ask=function(){return [an?'Wat betekent dit?':'Welk Arabisch woord hoort hierbij?'];};
      q.ok=function(k){return k===target.id;};
      q.fb=function(k){
        var out=[],x=opts.filter(function(o){return o.id===k;})[0];
        if(k===target.id) out.push(P(okB('Goed. '),ar(target.ar),' betekent ‘'+target.nl+'’.'));
        else if(an){
          out.push(P(noB('Fout. '),'‘'+x.nl+'’ is hier fout, want dat is de betekenis van ',ar(x.ar),'.'));
          out.push(P('‘'+x.nl+'’ zou goed zijn als er ',ar(x.ar),' had gestaan.'));
          out.push(P('Hier staat ',ar(target.ar),' en dat betekent ‘'+target.nl+'’.'));
        }else{
          out.push(P(noB('Fout. '),ar(x.ar),' is hier fout, want dat betekent ‘'+x.nl+'’.'));
          out.push(P(ar(x.ar),' zou goed zijn als er om ‘'+x.nl+'’ gevraagd werd.'));
          out.push(P('Bij ‘'+target.nl+'’ hoort ',ar(target.ar),'.'));
        }
        return out.concat(tail(target));
      };
    }
    return q;
  }).filter(function(q){return q.typed||q.opts.length>1;});
}
/* korte ronde: vast aantal; hele level: alles wat op dit niveau nog niet beheerst is (of alles, als het al beheerst is) */
function roundLen(ids,kort){
  if(state.route.len!=='heel') return kort;
  var open=ids.filter(function(id){return streakOf(state.route.niv,id)<cfg('need');}).length;
  return open||ids.length;
}
function newLeft(){return pr().nt.d===today()?Math.max(0,cfg('perDay')-pr().nt.n):cfg('perDay');}
function buildQueue(items){
  var t=today(),due=[],nw=[];
  items.forEach(function(x){var s=pr().srs[x.id];if(!s) nw.push(x.id);else if(s.due<=t) due.push(x.id);});
  return shuffle(due).concat(nw.slice(0,newLeft()));
}
function grade(id,g){
  var t=today(),s=pr().srs[id],ivl;
  if(!s){s={ivl:0,ease:2.5,reps:0,due:t};pr().nt=pr().nt.d===t?{d:t,n:pr().nt.n+1}:{d:t,n:1};}
  if(g===0){s.reps=0;s.ivl=0;s.ease=Math.max(1.3,s.ease-0.2);s.due=t;ui.queue.push(id);}
  else{
    if(s.reps===0) ivl=g===3?4:1;
    else if(s.reps===1) ivl=g===3?7:(g===1?2:3);
    else ivl=Math.round(s.ivl*(g===1?1.2:(g===2?s.ease:s.ease*1.3)));
    if(g===1) s.ease=Math.max(1.3,s.ease-0.15);
    if(g===3) s.ease+=0.15;
    s.ivl=Math.max(1,ivl);s.reps++;s.due=t+s.ivl;
  }
  pr().srs[id]=s;bump();accRec(g>0);save();
}
function vReview(stof,items){
  var map={},r=state.route,adv=r.niv==='adv',an=r.richt==='an';
  items.forEach(function(x){map[x.id]=x;});
  if(!ui.queue) ui.queue=buildQueue(items);
  while(ui.queue.length&&!map[ui.queue[0]]) ui.queue.shift();
  if(!ui.queue.length){
    var anyNew=items.some(function(x){return !pr().srs[x.id];});
    view.appendChild(h('section',{class:'panel'},
      h('h2',null,'Klaar voor vandaag'),
      h('p',{class:'muted'},anyNew&&newLeft()===0
        ?'Je hebt vandaag '+cfg('perDay')+' nieuwe kaarten gedaan. De rest komt morgen, zodat het blijft hangen.'
        :'Op deze route staat niets meer klaar voor herhaling. Kies een toets of een ander deel.'),
      h('div',{class:'row'},
        h('button',{class:'btn primary',type:'button',onclick:function(){state.route.vorm='quiz';save();depart();}},'Toets op deze route'),
        h('button',{class:'btn',type:'button',onclick:toStation},'Terug naar het level'))));
    return;
  }
  var id=ui.queue[0],w=map[id];
  var card=h('section',{class:'panel flash'},
    h('div',{class:'les'},w.deel+(pr().srs[id]?'':' · nieuw')),
    an?ar(w.ar,'front'+lg(w.ar),'div'):h('div',{class:'front nl'},w.q||w.nl));
  if(!ui.shown){
    if(adv) card.appendChild((an?typeBoxNl:typeBox)('Controleer',function(v){ui.typed=v;ui.shown=true;render();}));
    else card.appendChild(h('button',{class:'btn primary',type:'button',id:'show',onclick:function(){ui.shown=true;render();}},'Toon antwoord'));
  }else{
    card.appendChild(an?h('div',{class:'back'},w.nl):ar(w.ar,'back'+lg(w.ar),'div'));
    if(adv){
      var all=cardItems(stof),j=an?judgeNl(all,w,ui.typed):judgeCard(all,w,ui.typed,stof);
      card.appendChild(h('div',{class:'fb'},P('Jouw antwoord: ',shown(an?'nl':'ar',ui.typed)),j.nodes));
    }else{
      tail(w).forEach(function(n){card.appendChild(n);});
    }
    card.appendChild(h('div',{class:'grades'},
      [['Opnieuw','again',0],['Moeilijk','',1],['Goed','',2],['Makkelijk','easy',3]].map(function(b){
        return h('button',{class:'btn '+b[1],type:'button',onclick:function(){ui.queue.shift();grade(id,b[2]);ui.shown=false;ui.typed=null;render();}},b[0]);
      })));
  }
  view.appendChild(card);
  view.appendChild(h('p',{class:'muted small'},'Nog '+ui.queue.length+' in deze ronde.'+(adv?'':' Zeg het antwoord eerst hardop en kijk dan pas.')));
}
function addForm(stof){
  var form=h('form',{class:'add',onsubmit:function(ev){
    ev.preventDefault();
    var a=document.getElementById('in-ar'),n=document.getElementById('in-nl'),l=document.getElementById('in-les');
    var av=a.value.trim(),nv=n.value.trim();
    if(!av||!nv) return;
    state.les=l.value.trim();
    state.words['w'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)]={ar:av.slice(0,80),nl:nv.slice(0,120),les:state.les.slice(0,40),cat:stof};
    state.route.boek='Eigen';state.route.deel='all';
    save();render();
  }},
    h('label',null,'Arabisch (met klinkertekens)',h('input',{type:'text',id:'in-ar',class:'arin',dir:'rtl',lang:'ar',autocomplete:'off',maxlength:'80'})),
    h('label',null,'Nederlands',h('input',{type:'text',id:'in-nl',autocomplete:'off',maxlength:'120'})),
    h('label',{class:'full'},'Boek en les, bijvoorbeeld Gateway 2, les 5',h('input',{type:'text',id:'in-les',autocomplete:'off',maxlength:'40',value:state.les})),
    h('div',{class:'full'},h('button',{class:'btn primary',type:'submit'},'Toevoegen')));
  return h('section',{class:'panel'},h('h3',null,'Zelf toevoegen'),form);
}
function vList(stof,items){
  var groups={},order=[],t=today(),rt=state.route;
  if(admin()&&rt.deel!=='all'&&rt.boek!=='Eigen') view.appendChild(newForm(stof,rt.boek,rt.deel));
  if(!items.length) view.appendChild(emptyPanel('Nog geen inhoud',STOF[stof].empty,STOF[stof].need));
  items.forEach(function(x){var g=x.boek+' · '+x.deel;if(!groups[g]){groups[g]=[];order.push(g);}groups[g].push(x);});
  order.forEach(function(g){
    var list=h('div',{class:'wlist'});
    groups[g].forEach(function(x){
      var s=pr().srs[x.id];
      var status=!s?'nieuw':(s.due<=t?'vandaag herhalen':'over '+(s.due-t)+(s.due-t===1?' dag':' dagen'));
      if(admin()&&ui.edit===x.id){list.appendChild(editCard(stof,x));return;}
      list.appendChild(h('div',{class:'w'},
        h('div',{class:'nl'},x.nl,h('small',null,status+(x.bron?' · '+x.bron:'')+(x.edited?' · aangepast':''))),
        ar(x.ar,'','div'),
        admin()&&!x.own?h('button',{class:'btn sm ghost',type:'button','aria-label':'Bewerk '+x.nl,onclick:function(){ui.edit=x.id;render();}},'Bewerk'):
        x.own?h('button',{class:'btn sm ghost',type:'button','aria-label':'Verwijder '+x.nl,onclick:function(){
          if(ui.del===x.id){delete state.words[x.id];delete pr().srs[x.id];ui.del=null;save();}else{ui.del=x.id;}
          render();
        }},ui.del===x.id?'Zeker?':'Verwijder'):h('span',null)));
    });
    view.appendChild(h('section',{class:'panel'},h('h3',null,g+' · '+groups[g].length),list));
  });
  if(!admin()) view.appendChild(addForm(stof));
}
function field(label,id,val,attrs){
  var a={type:'text',id:id,value:val||'',autocomplete:'off'};for(var k in attrs||{}) a[k]=attrs[k];
  return h('label',null,label,attrs&&attrs.area?h('textarea',{id:id,rows:'5'},val||''):h('input',a));
}
function val(id){var e=document.getElementById(id);return e?e.value.trim():'';}
/* Admin: een item uit de lesstof aanpassen of verwijderen; het origineel blijft bewaard */
function editCard(stof,x){
  var e=state.ed[x.id];
  return h('form',{class:'add edit',onsubmit:function(ev){
    ev.preventDefault();
    var arv=val('ed-ar'),nlv=val('ed-nl'),nv={ar:arv.slice(0,80),nl:nlv.slice(0,160),bron:val('ed-bron').slice(0,80),noot:val('ed-noot').slice(0,300)};
    if(!arv||!nlv) return;
    if(e&&e.nieuw) EDF.forEach(function(k){e[k]=nv[k];});
    else{
      /* alleen bewaren wat afwijkt van het origineel uit de lesstof */
      var o=STOF[stof].src.filter(function(y){return y.id===x.id;})[0]||{},d={};
      EDF.forEach(function(k){if(nv[k]!==(o[k]||'')) d[k]=nv[k];});
      if(Object.keys(d).length) state.ed[x.id]=d; else delete state.ed[x.id];
    }
    ui.edit=null;save();render();
  }},
    h('label',null,'Arabisch (met klinkertekens)',h('input',{type:'text',id:'ed-ar',class:'arin',dir:'rtl',lang:'ar',value:x.ar,autocomplete:'off'})),
    field('Nederlands','ed-nl',x.nl),field('Bron','ed-bron',x.bron),field('Notitie','ed-noot',x.noot),
    h('div',{class:'full row'},
      h('button',{class:'btn primary',type:'submit'},'Opslaan'),
      h('button',{class:'btn',type:'button',onclick:function(){ui.edit=null;ui.del=null;render();}},'Annuleer'),
      e&&!e.nieuw?h('button',{class:'btn',type:'button',onclick:function(){delete state.ed[x.id];ui.edit=null;save();render();}},'Origineel terugzetten'):null,
      h('button',{class:'btn ghost danger',type:'button',onclick:function(){
        if(ui.del!==x.id){ui.del=x.id;render();return;}
        if(e&&e.nieuw) delete state.ed[x.id]; else (state.ed[x.id]=state.ed[x.id]||{}).del=true;
        ui.del=null;ui.edit=null;save();render();
      }},ui.del===x.id?'Zeker verwijderen?':'Verwijder')));
}
/* Admin: een nieuw item aan dit level toevoegen */
function newForm(stof,boek,deel){
  return h('section',{class:'panel'},h('h3',null,'Toevoegen aan dit level'),
    h('form',{class:'add',onsubmit:function(ev){
      ev.preventDefault();
      var arv=val('nw-ar'),nlv=val('nw-nl');
      if(!arv||!nlv) return;
      state.ed['e'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)]={nieuw:true,cat:stof,boek:boek,deel:deel,ar:arv.slice(0,80),nl:nlv.slice(0,160),bron:val('nw-bron').slice(0,80),noot:val('nw-noot').slice(0,300)};
      save();render();
    }},
      h('label',null,'Arabisch (met klinkertekens)',h('input',{type:'text',id:'nw-ar',class:'arin',dir:'rtl',lang:'ar',autocomplete:'off'})),
      field('Nederlands','nw-nl',''),field('Bron, bijvoorbeeld Gateway to Arabic 1, blz. 48','nw-bron',''),field('Notitie','nw-noot',''),
      h('div',{class:'full'},h('button',{class:'btn primary',type:'submit'},'Toevoegen'))));
}

/* ---------- nahw ---------- */
function regel(id){var r=CONTENT.regels.filter(function(r){return r.id===id;})[0];return r&&ruleOv(r);}
function vRules(){
  var r=state.route,box=h('section',{class:'panel'});
  rules(r.stof).filter(function(x){return rb(x)===r.boek&&(r.deel==='all'||x.id===r.deel);}).forEach(function(x){
    if(admin()&&ui.edit===x.id){
      box.appendChild(h('form',{class:'add edit',onsubmit:function(ev){
        ev.preventDefault();
        var d=state.ed[x.id]=state.ed[x.id]||{};
        d.titel=val('ed-titel').slice(0,120)||x.titel;d.tekst=val('ed-tekst').slice(0,4000);d.bron=val('ed-bron').slice(0,80);
        ui.edit=null;save();render();
      }},field('Titel','ed-titel',x.titel),h('label',{class:'full'},'Uitleg',h('textarea',{id:'ed-tekst',rows:'7'},x.tekst||'')),field('Bron','ed-bron',x.bron),
        h('div',{class:'full row'},h('button',{class:'btn primary',type:'submit'},'Opslaan'),
          h('button',{class:'btn',type:'button',onclick:function(){ui.edit=null;render();}},'Annuleer'),
          x.edited?h('button',{class:'btn',type:'button',onclick:function(){delete state.ed[x.id];ui.edit=null;save();render();}},'Origineel terugzetten'):null)));
      return;
    }
    box.appendChild(h('div',{class:'rule'},h('b',null,x.titel),h('p',null,x.tekst),x.bron?h('p',{class:'src'},'Bron: '+x.bron+(x.edited?' · aangepast':'')):null,
      admin()?h('button',{class:'btn sm',type:'button',onclick:function(){ui.edit=x.id;render();}},'Bewerk'):null));
  });
  view.appendChild(box);
}
function nahwQs(){
  var adv=state.route.niv==='adv',qs=weakFirst(pool(),state.route.niv,function(q){return q.id;});
  qs=qs.slice(0,roundLen(qs.map(function(q){return q.id;}),cfg('kort')));
  return qs.map(function(q){
    var rg=regel(q.regel),arOpts=!!q.ar,gi=-1;
    q.opties.forEach(function(o,i){if(o.goed) gi=i;});
    var g=q.opties[gi],typed=adv&&arOpts&&!q.mc;
    var txt=function(o){return arOpts?ar(o.t):'‘'+o.t+'’';};
    var src=function(){return rg?[h('p',{class:'src'},'Regel: '+rg.titel+(rg.bron?' · Bron: '+rg.bron:''))]:[];};
    var optFb=function(p){
      if(p.goed) return [P(okB('Goed. '),p.waarom||'')].concat(src());
      var out=[P(noB('Fout. '),txt(p),' is hier fout. ',p.waarom||'')];
      if(p.wel) out.push(P(lbl('Wanneer wel goed: '),p.wel));
      out.push(P(lbl('Het juiste antwoord: '),txt(g),'. ',g.waarom||''));
      return out.concat(src());
    };
    var base={kicker:rg?rg.titel:'Naḥw',mid:q.id,stim:q.stim||null,arOpts:arOpts,done:function(ok){pr().nahw[q.id]=ok?1:0;}};
    if(typed){
      base.typed=true;
      base.ask=function(){return [q.vraag.replace(/^Hoe wordt dit woord met al- ervoor\?$/,'Typ dit woord met al- ervoor.')];};
      base.ok=function(v){return norm(v)===norm(g.t);};
      base.fb=function(v){
        var nv=norm(v),hit=q.opties.filter(function(o){return norm(o.t)===nv;})[0];
        if(hit) return optFb(hit);
        if(!nv) return [P(noB('Fout. '),'Je hebt niets ingevuld.'),P(lbl('Het juiste antwoord: '),ar(g.t),'. ',g.waarom||'')].concat(src());
        return [P(noB('Fout. '),ar(v),' is hier fout.')].concat(explain(v,g.t),[
          P(lbl('Wanneer wel goed: '),'Deze schrijfwijze komt bij deze regel in het boek niet voor.'),
          P(lbl('Het juiste antwoord: '),ar(g.t),'. ',g.waarom||'')],src());
      };
    }else{
      base.ask=function(){return [q.vraag];};
      base.opts=shuffle(q.opties.map(function(o,i){return {k:i,t:o.t};}));
      base.ok=function(k){return k===gi;};
      base.fb=function(k){return optFb(q.opties[k]);};
    }
    return base;
  });
}

(function(){
  var lo=document.getElementById('logout'),b;
  if(!lo) return;
  b=h('button',{type:'button',id:'mode',class:'btn sm ghost',onclick:function(){
    state.mode=admin()?'user':'admin';save();modeLabel();if(ui.screen!=='run') render();
  }});
  function modeLabel(){b.textContent=(admin()?'Admin':'Gebruiker');b.setAttribute('aria-pressed',String(admin()));}
  modeLabel();
  lo.parentNode.insertBefore(b,lo);
  lo.parentNode.insertBefore(h('button',{type:'button',id:'settings',class:'btn sm ghost',hidden:!admin(),onclick:function(){go('settings');}},'Instellingen'),lo);
})();
document.addEventListener('keydown',function(e){
  if(e.key!=='Enter'||ui.screen!=='run') return;
  var t=e.target,n=document.getElementById('next');
  if(n&&!(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))){e.preventDefault();n.click();}
});
(function(){
  var last=Date.now(),sec=0;
  ['pointerdown','keydown','touchstart','scroll'].forEach(function(e){document.addEventListener(e,function(){last=Date.now();},{passive:true});});
  setInterval(function(){
    if(document.visibilityState!=='visible'||Date.now()-last>90000) return;
    var p=pr(),t=today();
    p.time[t]=(p.time[t]||0)+15;sec+=15;
    if(sec>=60){
      sec=0;
      p.hist[t]={w:masteryOf(catIds('w').concat(catIds('p'))).beg};
      ['time','acc','hist'].forEach(function(k){var ks=Object.keys(p[k]);if(ks.length>400) ks.sort(function(a,b){return a-b;}).slice(0,ks.length-400).forEach(function(x){delete p[k][x];});});
      save();
    }
  },15000);
})();
render();
connect();
})();
