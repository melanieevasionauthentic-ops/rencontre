
// ===== Serendi v15 — app.js (full) =====
const $ = s => document.querySelector(s);
const toast = (m)=>{const t=$('#toast');if(!t)return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2400);};

let SUPA_URL='', SUPA_ANON='';
try{SUPA_URL=window.SERENDI_CFG?.SUPABASE_URL||''; SUPA_ANON=window.SERENDI_CFG?.SUPABASE_ANON||'';}catch(e){}
let supa=null; try{ if(SUPA_URL&&SUPA_ANON){ supa = window.supabase.createClient(SUPA_URL,SUPA_ANON); } }catch(e){ console.warn('Supabase init error',e); }

const readSettings=()=>{try{return JSON.parse(localStorage.getItem('settings')||'{}')}catch(e){return{}}}
const writeSettings=(o)=>localStorage.setItem('settings',JSON.stringify(o));
const readProfile =()=>{try{return JSON.parse(localStorage.getItem('profile')||'{}')}catch(e){return{}}}
const writeProfile=(o)=>localStorage.setItem('profile',JSON.stringify(o));
const getRadius=()=>Number(readSettings().radius||1000);
function writeFlag(k,v){localStorage.setItem('flag:'+k,JSON.stringify({v,t:Date.now()}));}
function readFlag(k){try{return JSON.parse(localStorage.getItem('flag:'+k)||'{}').v}catch(e){return null}}

let map, meMarker, markers=[], baseLayer;
function initMap(){
  const el=$('#map'); if(!el) return;
  try{
    map = L.map('map',{ zoomControl:true, attributionControl:true });
    baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    map.setView([48.8566,2.3522], 13);
  }catch(e){ console.error(e); toast('Erreur carte'); }
}
function locateMe(){
  if(!navigator.geolocation){ toast('Géolocalisation indisponible'); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude}=pos.coords;
    if(map){
      map.setView([latitude,longitude],15);
      if(meMarker) meMarker.remove();
      meMarker = L.marker([latitude,longitude],{title:'Moi'}).addTo(map);
    }
    if(readFlag('available')){ upsertPresence(latitude,longitude).catch(()=>toast('Présence non envoyée')); }
  },err=>{ console.warn(err); toast('Autorise la position'); },{enableHighAccuracy:true,timeout:10000});
}

async function upsertPresence(lat,lon){
  if(!supa) return;
  const p=readProfile();
  const uid=localStorage.getItem('uid')||crypto.randomUUID(); localStorage.setItem('uid',uid);
  const row={
    id:uid, lat, lon, radius_m:getRadius(),
    bio_text:(p.bio||'').slice(0,300),
    profile:{
      display_name:p.display_name||'',
      age:p.age||null, height:p.height||null,
      hair:p.hair||'', body:p.body||'',
      relation_type:p.relation_type||'',
      recognize:p.recognize||'',
      gender:p.my_gender||'',
      orientations:p.my_orientation||[]
    },
    updated_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+60*60*1000).toISOString()
  };
  const {error}=await supa.from('presence').upsert(row,{onConflict:'id'});
  if (error) { toast('Erreur présence: '+ (error.message||'inconnue')); throw error; }
}
async function loadNearby(){
  if(!supa||!map) return;
  const {data,error}=await supa.from('presence')
    .select('id,lat,lon,profile,updated_at,expires_at')
    .gt('expires_at', new Date().toISOString())
    .limit(500);
  if(error){ console.warn(error); toast('Erreur lecture présence'); return; }
  // dedup by id keep latest
  const latest=new Map();
  for(const r of data){
    const prev=latest.get(r.id);
    if(!prev || new Date(r.updated_at)>new Date(prev.updated_at)){ latest.set(r.id,r); }
  }
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const sel=$('#nearby-select'); if(sel){ sel.innerHTML=''; const o0=document.createElement('option');o0.value='';o0.textContent='— choisir —'; sel.appendChild(o0); }
  for(const r of latest.values()){
    if(!r.lat||!r.lon) continue;
    const prof=r.profile||{};
    const m=L.marker([r.lat,r.lon]).addTo(map);
    markers.push(m);
    const descParts=[];
    if(prof.display_name) descParts.push(`<b>${prof.display_name}</b>`);
    const micro=[prof.age?`Âge ${prof.age}`:'', prof.height?`${prof.height} cm`:'', prof.hair?`Cheveux ${prof.hair}`:'', prof.body?`Corps ${prof.body}`:''].filter(Boolean).join(' — ');
    if(micro) descParts.push(micro);
    if(prof.relation_type) descParts.push(`Relation: ${prof.relation_type}`);
    if(prof.recognize) descParts.push(`Reconnaître: ${prof.recognize}`);
    m.bindPopup(descParts.join('<br>'));
    if(sel){ const o=document.createElement('option'); o.value=r.id; o.textContent=prof.display_name||('#'+r.id.slice(0,6)); sel.appendChild(o); }
  }
}

function wireUI(){
  const btnAvail=$('#btn-available'), btnStealth=$('#btn-stealth'), sel=$('#nearby-select'), btnReq=$('#btn-request');
  if(btnAvail){ btnAvail.addEventListener('click',()=>{ writeFlag('available',true); toast('Visible (60 min)'); locateMe(); upsertPresence( (map?.getCenter()?.lat)||48.8566, (map?.getCenter()?.lng)||2.3522 ).catch(()=>{}); }); }
  if(btnStealth){ btnStealth.addEventListener('click',()=>{ writeFlag('available',false); toast('Pause (3 h)'); }); }
  if(btnReq && sel && supa){
    btnReq.addEventListener('click',async()=>{
      const to_id = sel.value; if(!to_id){ toast('Choisis une personne'); return; }
      const from_id = localStorage.getItem('uid')||crypto.randomUUID(); localStorage.setItem('uid',from_id);
      const payload={from_id,to_id,message:'On se croise ?',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*60*1000).toISOString()};
      const {error}=await supa.from('intents').insert(payload);
      if(error){ toast('Envoi impossible'); console.warn(error); } else { toast('Demande envoyée'); }
    });
  }
}
function hookOnboarding(){
  const saveBtn=document.querySelector('#btn-save-profile'); if(!saveBtn) return;
  saveBtn.addEventListener('click',()=>{
    const val=sel=> (document.querySelector(sel)?.value||'').toString().trim();
    const multi=sel=> Array.from(document.querySelector(sel)?.selectedOptions||[]).map(o=>o.value);
    const p={
      display_name:val('#display_name'), my_gender:val('#my_gender'), my_orientation:multi('#my_orientation'),
      age:Number(val('#age'))||null, height:Number(val('#height'))||null, hair:val('#hair'), body:val('#body'),
      relation_type:val('#relation_type'), recognize:val('#recognize'), bio: (val('#bio')||'').slice(0,2400)
    };
    writeProfile(p); toast('Profil enregistré.'); setTimeout(()=>location.href='index.html',250);
  });
}
function hookSettings(){
  const btn=$('#btn-save-settings'); if(!btn) return;
  btn.addEventListener('click',()=>{
    const r=Number($('#radius')?.value||1000); const s=readSettings(); s.radius=r; writeSettings(s);
    $('#radius-display') && ($('#radius-display').textContent=String(r)); toast('Réglages enregistrés');
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  const isRadar=!!$('#map'), isOnb=!!$('#display_name'), isSet=!!$('#radius');
  if(isRadar){ initMap(); wireUI(); locateMe(); setInterval(loadNearby,12000); loadNearby(); $('#radius-display')&&($('#radius-display').textContent=String(getRadius())); }
  if(isOnb){ hookOnboarding(); }
  if(isSet){ hookSettings(); }
});
