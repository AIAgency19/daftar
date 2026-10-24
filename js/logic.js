/* Daftar Arabisch: logica zonder DOM. Laadt in de browser (window.DaftarLogic, voor js/app.js)
   en in Node (require('./js/logic.js'), voor de tests in tests/). */
(function(root){
'use strict';

/* ---------- vorm van de opgeslagen voortgang ---------- */
var V=4;
/* onderdelen met losse items; elk item krijgt in ts een eigen tijdstempel (zie stampChanges) */
var ITEMS=['m.beg','m.adv','srs','nahw','alt','ed','words'],ITEMS_ADM=['m.beg','m.adv','srs','nahw'];
/* onderdelen die als één geheel gelden: de meest recent gewijzigde waarde wint */
var SCALARS=['set','route','kb','mode','les'];
/* onderdelen per dag: per dag de hoogste waarde (optellen zou dubbel tellen) */
var DAYS=['days','time','acc','hist'];

function admNorm(a){
  if(!a||typeof a!=='object') a={};
  ['srs','nahw','days','time','acc','hist','ts'].forEach(function(k){if(!a[k]||typeof a[k]!=='object') a[k]={};});
  if(!a.nt||typeof a.nt!=='object') a.nt={d:0,n:0};
  if(!a.m||typeof a.m!=='object') a.m={};
  ['beg','adv'].forEach(function(k){if(!a.m[k]||typeof a.m[k]!=='object') a.m[k]={};});
  return a;
}
function fresh(){return {v:V,updated:0,words:{},srs:{},nahw:{},days:{},nt:{d:0,n:0},m:{beg:{},adv:{}},les:'',kb:'app',mode:'user',adm:admNorm(),set:{},alt:{},ed:{},time:{},acc:{},hist:{},ts:{},
  route:{stof:'w',boek:'Boek 1',deel:'all',richt:'an',niv:'beg',vorm:'review',kijk:'now',len:'kort'}};}
function normalize(s){
  var b=fresh(),id,w;
  if(!s||typeof s!=='object'||!s.words||typeof s.words!=='object') return b;
  ['srs','nahw','days','nt','m','route'].forEach(function(k){if(!s[k]||typeof s[k]!=='object') s[k]=b[k];});
  ['beg','adv'].forEach(function(k){if(!s.m[k]||typeof s.m[k]!=='object') s.m[k]={};});
  delete s.lv;
  if(!s.v||s.v<2){
    /* versie 1 bevatte een startset en vragen die niet uit het materiaal van de gebruiker kwamen */
    for(id in s.words){
      w=s.words[id];
      if(/^s\d+$/.test(id)&&w.les==='Startset'){delete s.words[id];continue;}
      if(w.s){s.srs[id]=w.s;delete w.s;}
    }
    s.nahw={};
  }
  if(!s.v||s.v<3){
    if(s.fb==='later') s.route.kijk='later';
    delete s.fb;delete s.dir;delete s.sarf;s.v=3;
  }
  if(s.v<4){
    /* versie 4: tijdstempels per item (ts), zodat voortgang van verschillende apparaten samengevoegd kan worden */
    s.ts={};if(s.adm&&typeof s.adm==='object') s.adm.ts={};
    s.v=4;
  }
  for(id in s.words){if(s.words[id].cat!=='p'&&s.words[id].cat!=='s') s.words[id].cat='w';}
  if(typeof s.les!=='string') s.les='';
  if(s.kb!=='own') s.kb='app';
  if(s.mode!=='admin') s.mode='user';
  s.adm=admNorm(s.adm);
  ['set','alt','ed','time','acc','hist','ts'].forEach(function(k){if(!s[k]||typeof s[k]!=='object') s[k]={};});
  return s;
}

/* ---------- samenvoegen tussen apparaten ---------- */
function clone(x){return x==null?x:JSON.parse(JSON.stringify(x));}
function sec(o,path){var p=path.split('.'),i;for(i=0;i<p.length;i++){if(!o) return undefined;o=o[p[i]];}return o;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
/* vaste weergave (sleutels op volgorde), om twee versies op inhoud te vergelijken */
function sorted(x){
  if(!x||typeof x!=='object') return x;
  if(Array.isArray(x)) return x.map(sorted);
  var o={};Object.keys(x).sort().forEach(function(k){o[k]=sorted(x[k]);});return o;
}
function sig(x){return JSON.stringify(sorted(x));}
function keysOf(){var o={},i,k;for(i=0;i<arguments.length;i++) for(k in arguments[i]||{}) o[k]=1;return Object.keys(o);}

/* Zet een tijdstempel bij elk item dat sinds de vorige opgeslagen versie (prev) is veranderd, toegevoegd of verwijderd.
   Keuze: de klok van het apparaat, per item. De server kent alleen één updated_at per rij en kan dus niet per woord
   beslissen; de klokken van telefoon en pc lopen via internet gelijk tot op seconden, en oefensessies liggen minuten uiteen.
   Een verwijderd item houdt zijn tijdstempel (zonder waarde): zo weet een ander apparaat dat het weg moet. */
function stampLevel(cur,prev,now,items,scalars){
  var ts=cur.ts||(cur.ts={});
  items.forEach(function(name){
    var a=sec(cur,name)||{},b=sec(prev,name)||{},t=ts[name]||(ts[name]={});
    keysOf(a,b).forEach(function(k){if(!same(a[k],b[k])) t[k]=now;});
  });
  scalars.forEach(function(name){if(!same(cur[name],prev[name])) ts['@'+name]=now;});
}
function stampChanges(cur,prev,now){
  if(!prev) return cur;
  stampLevel(cur,prev,now,ITEMS,SCALARS);
  if(cur.adm) stampLevel(cur.adm,prev.adm||{},now,ITEMS_ADM,[]);
  return cur;
}
/* per item: de kant met de nieuwste tijdstempel wint (ook als die kant het item verwijderd heeft).
   Zonder tijdstempels (voortgang van voor versie 4): een item dat maar aan één kant bestaat blijft bestaan,
   bij een item aan beide kanten wint de kant die als geheel het laatst is opgeslagen. */
function mergeItems(out,a,b,name,bNewer){
  var A=sec(a,name)||{},B=sec(b,name)||{},TA=(a.ts&&a.ts[name])||{},TB=(b.ts&&b.ts[name])||{};
  var R={},T={};
  keysOf(A,B,TA,TB).forEach(function(k){
    var ta=TA[k],tb=TB[k],useB;
    if(ta==null&&tb==null){
      if(k in A&&k in B) useB=bNewer; else useB=!(k in A);
    }else useB=(tb||0)>(ta||0);
    var S=useB?B:A,t=useB?tb:ta;
    if(k in S) R[k]=clone(S[k]);
    if(t!=null) T[k]=t;
  });
  var p=name.split('.');
  if(p.length===2){out[p[0]]=out[p[0]]||{};out[p[0]][p[1]]=R;}else out[name]=R;
  out.ts[name]=T;
}
function dayMax(name,x,y){
  if(x==null) return clone(y);
  if(y==null) return clone(x);
  if(name==='acc') return (y.n||0)>(x.n||0)?clone(y):clone(x);
  if(name==='hist') return (y.w||0)>(x.w||0)?clone(y):clone(x);
  return Math.max(x,y);
}
function mergeLevel(out,a,b,items,scalars,bNewer){
  out.ts={};
  items.forEach(function(name){mergeItems(out,a,b,name,bNewer);});
  scalars.forEach(function(name){
    var ta=a.ts&&a.ts['@'+name],tb=b.ts&&b.ts['@'+name],useB=ta==null&&tb==null?bNewer:(tb||0)>(ta||0);
    out[name]=clone(useB?b[name]:a[name]);
    var t=useB?tb:ta;if(t!=null) out.ts['@'+name]=t;
  });
  DAYS.forEach(function(name){
    var A=a[name]||{},B=b[name]||{},R={};
    keysOf(A,B).forEach(function(k){R[k]=dayMax(name,A[k],B[k]);});
    out[name]=R;
  });
  var na=a.nt||{d:0,n:0},nb=b.nt||{d:0,n:0};
  out.nt=na.d===nb.d?{d:na.d,n:Math.max(na.n||0,nb.n||0)}:clone(nb.d>na.d?nb:na);
}
/* voegt twee versies van de voortgang samen (lokaal a, van de server b); a en b blijven ongewijzigd */
function merge(a,b){
  a=normalize(clone(a));b=normalize(clone(b));
  var bNewer=(b.updated||0)>(a.updated||0),out=clone(a);
  mergeLevel(out,a,b,ITEMS,SCALARS,bNewer);
  out.adm=admNorm(clone(a.adm));
  mergeLevel(out.adm,a.adm,b.adm,ITEMS_ADM,[],bNewer);
  out.updated=Math.max(a.updated||0,b.updated||0);
  out.v=V;
  return out;
}

/* ---------- Arabisch vergelijken ---------- */
var F='َ',D='ُ',K='ِ',S='ْ',SH='ّ',FT='ً',DT='ٌ',KT='ٍ';
var MARK=/[ً-ْٰ]/;
var MARKNAME={};
MARKNAME[F]='fatḥa';MARKNAME[D]='ḍamma';MARKNAME[K]='kasra';MARKNAME[S]='sukoon';MARKNAME[SH]='shadda';
MARKNAME[FT]='tanween fatḥa';MARKNAME[DT]='tanween ḍamma';MARKNAME[KT]='tanween kasra';MARKNAME['ٰ']='kleine alif';
function prep(s){return String(s||'').replace(/[ـٰ؟،?.!,]/g,'').replace(/\s+/g,' ').trim().replace(/اً/g,'ًا').replace(/(^| )اَ(?=ل)/g,'$1ا');}
function clusters(s){
  var out=[],i,c;s=prep(s);
  for(i=0;i<s.length;i++){c=s.charAt(i);if(MARK.test(c)){if(out.length) out[out.length-1].m.push(c);}else out.push({b:c,m:[]});}
  out.forEach(function(k){k.m.sort();});
  return out;
}
function norm(s){return clusters(s).map(function(k){return k.b+k.m.join('');}).join('');}
/* de stam zonder de laatste klinker of tanween (en zonder de alif die tanween fatḥa draagt) */
function stem(s){
  var c=clusters(s);if(!c.length) return '';
  if(c.length>1&&c[c.length-1].b==='ا'&&!c[c.length-1].m.length&&c[c.length-2].m.indexOf(FT)>=0) c.pop();
  var last=c[c.length-1];last.m=last.m.filter(function(m){return m===SH;});
  return c.map(function(k){return k.b+k.m.join('');}).join('');
}
function markNames(m){return m.length?m.map(function(x){return MARKNAME[x]||x;}).join(' met '):'geen teken';}
/* waarin wijkt een getypt antwoord (v) af van het juiste (t)? Geeft gegevens; js/app.js maakt er tekst van.
   {kind:'empty'} | {kind:'letters', have, want} | {kind:'marks', diffs:[{pos, letter, have, want}], more} */
function explain(v,t){
  var a=clusters(v),b=clusters(t),i,diffs=[];
  var sa=a.map(function(k){return k.b;}).join(''),sb=b.map(function(k){return k.b;}).join('');
  if(!a.length) return {kind:'empty'};
  if(sa!==sb) return {kind:'letters',have:sa,want:sb};
  for(i=0;i<a.length;i++) if(a[i].m.join('')!==b[i].m.join('')) diffs.push({pos:i+1,letter:a[i].b,have:markNames(a[i].m),want:markNames(b[i].m)});
  return {kind:'marks',diffs:diffs.slice(0,3),more:Math.max(0,diffs.length-3)};
}
/* Beoordeelt een getypt Arabisch antwoord bij een kaart. cat is de categorie: 'w' woorden, 'p' voornaamwoorden, 's' ṣarf.
   Alleen bij losse woorden (w) mag de laatste klinker afwijken: die staan in de grondvorm, en de uitgang (tanween)
   hangt af van de plaats in de zin. Bij voornaamwoorden en ṣarf maakt de uitgang deel uit van de vorm
   (أَنْتَ/أَنْتِ, كِتَابُكَ/كِتَابُكِ, يَسْكُتُ/يَسْكُتَ/يَسْكُتْ), dus daar moet het antwoord precies kloppen.
   kind: exact | empty | synonym | other | ending-ok | ending | wrong */
function judgeCard(all,target,v,cat){
  var nv=norm(v),nt=norm(target.ar),other;
  if(nv===nt) return {ok:true,kind:'exact'};
  if(!nv) return {ok:false,kind:'empty'};
  other=all.filter(function(x){return x.id!==target.id&&norm(x.ar)===nv;})[0];
  if(other&&other.nl===target.nl) return {ok:true,kind:'synonym',other:other};
  if(other) return {ok:false,kind:'other',other:other};
  if(stem(v)===stem(target.ar)) return cat==='w'?{ok:true,kind:'ending-ok'}:{ok:false,kind:'ending',explain:explain(v,target.ar)};
  return {ok:false,kind:'wrong',explain:explain(v,target.ar)};
}

/* ---------- een getypte betekenis beoordelen ---------- */
function nlKey(s){return String(s||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[.!?"“”‘’',;:]/g,' ').replace(/\s+/g,' ').trim();}
function uniqList(a){var o=[],seen={};a.forEach(function(x){if(!seen[x]){seen[x]=1;o.push(x);}});return o;}
/* alle goede betekenissen van een kaart: het Nederlands, het Engels uit het boek, de delen daarvan, en de antwoorden
   die de gebruiker zelf heeft goedgekeurd (alt: lijst met teksten) */
function meanings(x,alt){
  var out=[],lead=/^(hij|het|zij|ze|ik|he|it|she|a|an|the|een|de) /,subj=/^(hij|het|zij|ze|ik|he|it|she)$/;
  [x.nl,x.en].forEach(function(src){
    if(!src) return;
    var first=null,whole=nlKey(src);
    if(whole) out.push(whole);
    if(/\.\s*$/.test(src)||src.length>45) return;   /* hele zinnen worden niet in stukken geknipt */
    src.split(/[;,:]/).forEach(function(part){
      var p=nlKey(part),m;if(!p) return;
      out.push(p);
      m=p.match(lead);
      if(m){if(!first) first=m[1];out.push(p.replace(lead,''));}
      else if(first&&subj.test(first)) out.push(first+' '+p);
    });
  });
  (alt||[]).forEach(function(a){var k=nlKey(a);if(k) out.push(k);});
  return uniqList(out);
}
/* Beoordeelt een getypte betekenis. alts: object id → lijst met zelf goedgekeurde antwoorden (state.alt).
   kind: empty | match | mine (goed dankzij een zelf goedgekeurd antwoord) | other (betekenis van een andere kaart) | none */
function judgeNl(all,target,v,alts){
  alts=alts||{};
  var k=nlKey(v),other;
  if(!k) return {ok:false,kind:'empty'};
  if(meanings(target,alts[target.id]).indexOf(k)>=0)
    return {ok:true,kind:meanings(target).indexOf(k)<0?'mine':'match'};
  other=all.filter(function(x){return x.id!==target.id&&meanings(x,alts[x.id]).indexOf(k)>=0;})[0];
  if(other) return {ok:false,kind:'other',other:other};
  return {ok:false,kind:'none'};
}

/* ---------- mijlpalen uit het eigen materiaal ---------- */
/* stand: {books:[{boek, levels:{tot,beg,adv}, words:{tot,beg}}], focus: boek van de volgende halte, wordsBeg: herkende woorden}
   levels telt de genummerde levels van alle categorieën in dat boek (eindstations niet); words telt Woorden en Voornaamwoorden.
   Geeft per boek een regel tekst, de eerstvolgende afgeronde stap (next) en de ronde telling van herkende woorden (round). */
function roundSteps(n){var out=[100],x=250;while(x<=n+250){out.push(x);x+=250;}return out;}
function milestones(stand){
  var books=(stand&&stand.books)||[],out={books:[],next:null,round:null};
  books.forEach(function(b){
    var lv=b.levels||{tot:0,beg:0,adv:0};
    out.books.push({boek:b.boek,levels:lv,words:b.words||{tot:0,beg:0},
      text:b.boek+': '+lv.beg+' van '+lv.tot+(lv.tot===1?' level':' levels')+' gehaald op Beginner, '+lv.adv+' op Gevorderd'});
  });
  /* de eerstvolgende mijlpaal: in het boek van de volgende halte (daarna de boeken erna) de stap die het dichtst bij af is */
  var start=Math.max(0,books.map(function(b){return b.boek;}).indexOf(stand&&stand.focus)),i,c,best;
  for(i=start;i<books.length&&!out.next;i++){
    var b=books[i],lv=b.levels||{tot:0,beg:0,adv:0},w=b.words||{tot:0,beg:0},cands=[];
    if(w.tot&&w.beg<w.tot) cands.push({kind:'words',left:w.tot-w.beg,frac:w.beg/w.tot,
      text:'Nog '+(w.tot-w.beg)+(w.tot-w.beg===1?' woord':' woorden')+' tot alle woorden van '+b.boek+' herkend zijn'});
    if(lv.tot&&lv.beg<lv.tot) cands.push({kind:'beg',left:lv.tot-lv.beg,frac:lv.beg/lv.tot,
      text:'Nog '+(lv.tot-lv.beg)+(lv.tot-lv.beg===1?' level':' levels')+' tot '+b.boek+' op Beginner af is'});
    if(lv.tot&&lv.adv<lv.tot) cands.push({kind:'adv',left:lv.tot-lv.adv,frac:lv.adv/lv.tot,
      text:'Nog '+(lv.tot-lv.adv)+(lv.tot-lv.adv===1?' level':' levels')+' tot '+b.boek+' op Gevorderd af is'});
    best=null;
    for(c=0;c<cands.length;c++) if(!best||cands[c].frac>best.frac||(cands[c].frac===best.frac&&cands[c].left<best.left)) best=cands[c];
    if(best){best.boek=b.boek;out.next=best;}
  }
  /* ronde aantallen herkende woorden: 100, 250, 500, 750, 1000, ... (een eigen telling, geen niveau) */
  var n=(stand&&stand.wordsBeg)||0,steps=roundSteps(n),reached=null,next=null;
  steps.forEach(function(s){if(s<=n) reached=s;else if(next==null) next=s;});
  out.round={count:n,reached:reached,next:next,left:next-n,from:reached||0};
  return out;
}

var L={V:V,milestones:milestones,fresh:fresh,admNorm:admNorm,normalize:normalize,clone:clone,same:same,sig:sig,stampChanges:stampChanges,merge:merge,
  MARK:MARK,MARKNAME:MARKNAME,prep:prep,clusters:clusters,norm:norm,stem:stem,markNames:markNames,explain:explain,judgeCard:judgeCard,
  nlKey:nlKey,meanings:meanings,judgeNl:judgeNl};
if(typeof module!=='undefined'&&module.exports) module.exports=L; else root.DaftarLogic=L;
})(this);
