/* ERSYA MEBEL — lightweight Supabase REST/Auth client.
   Keeps the app independent of the Supabase JS CDN so the admin/public site still works on phones. */
(function(){
  const cfg = window.ERSYA_SUPABASE || {};
  const root = String(cfg.url || '').replace(/\/+$/,'');
  const anonKey = String(cfg.anonKey || '');
  const STORE = 'ersya_supabase_session_v1';

  function jsonHeaders(token, extra){
    const h = { 'apikey': anonKey, 'Content-Type': 'application/json', ...(extra||{}) };
    if(token) h.Authorization = 'Bearer ' + token;
    return h;
  }
  async function parseResponse(res){
    const text = await res.text();
    let body = null;
    try{ body = text ? JSON.parse(text) : null; }catch(_){ body = text; }
    if(!res.ok){
      const msg = body?.message || body?.msg || body?.error_description || body?.hint || body?.error || (typeof body==='string'?body:res.statusText) || 'Permintaan online gagal';
      const err = new Error(String(msg)); err.status=res.status; err.body=body; throw err;
    }
    return body;
  }
  async function request(path, options){
    if(!root || !anonKey) throw new Error('Konfigurasi Supabase belum lengkap');
    let res;
    try{
      const ctrl = typeof AbortController!=='undefined' ? new AbortController() : null;
      let timer=null;
      const reqOpts={...(options||{})};
      if(ctrl){reqOpts.signal=ctrl.signal;timer=setTimeout(()=>ctrl.abort(),20000);}
      res=await fetch(root+path,reqOpts);
      if(timer)clearTimeout(timer);
    }catch(e){
      if(e?.name==='AbortError') throw new Error('Supabase timeout (20 detik)');
      throw new Error('Supabase tidak dapat dihubungi: '+(e?.message||e));
    }
    return parseResponse(res);
  }
  function readStored(){
    try{ const s=JSON.parse(localStorage.getItem(STORE)||'null'); return s && s.access_token ? s : null; }catch(_){ return null; }
  }
  function saveStored(s){ if(s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE); }
  function jwtExp(token){
    try{ const part=String(token).split('.')[1]; if(!part)return 0; const b=part.replace(/-/g,'+').replace(/_/g,'/'); const json=decodeURIComponent(atob(b).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')); return Number(JSON.parse(json).exp||0); }catch(_){ return 0; }
  }
  async function refreshSession(session){
    if(!session?.refresh_token) return null;
    try{
      const data = await request('/auth/v1/token?grant_type=refresh_token',{
        method:'POST', headers:jsonHeaders(null), body:JSON.stringify({refresh_token:session.refresh_token})
      });
      const next={...session,...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
      saveStored(next); return next;
    }catch(e){ saveStored(null); return null; }
  }
  async function signInWithPassword({email,password}){
    try{
      const data=await request('/auth/v1/token?grant_type=password',{method:'POST',headers:jsonHeaders(null),body:JSON.stringify({email,password})});
      const session={...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
      saveStored(session);
      return {data:{user:data.user||null,session},error:null};
    }catch(error){ return {data:{user:null,session:null},error}; }
  }
  async function getSession(){
    let s=readStored();
    if(!s) return {data:{session:null},error:null};
    const exp=Number(s.expires_at||jwtExp(s.access_token)||0);
    if(exp && exp < Math.floor(Date.now()/1000)+60) s=await refreshSession(s);
    return {data:{session:s||null},error:null};
  }
  async function signOut(){ saveStored(null); return {error:null}; }
  async function token(){ const r=await getSession(); return r.data.session?.access_token||null; }

  function builder(table){
    let mode='select', columns='*', filters=[], orderBy=null, ascending=true, limitN=null, body=null, conflict=null;
    const base='/rest/v1/'+encodeURIComponent(table);
    const b={
      select(cols='*'){ mode='select'; columns=cols; return b; },
      eq(col,val){ filters.push(col+'=eq.'+encodeURIComponent(String(val))); return terminalIfMutation(); },
      neq(col,val){ filters.push(col+'=neq.'+encodeURIComponent(String(val))); return terminalIfMutation(); },
      limit(n){
        const value = Number(n);
        if(!Number.isInteger(value) || value < 0) throw new Error('Batas hasil query tidak valid');
        limitN = value;
        return b;
      },
      order(col,opts){ orderBy=col; ascending=opts?.ascending!==false; return executeSelect(false); },
      maybeSingle(){ return executeSelect(true); },
      single(){ return executeSelect(true); },
      upsert(rows,opts){ mode='upsert'; body=rows; conflict=opts?.onConflict||null; return executeMutation(); },
      insert(rows){ mode='insert'; body=rows; return executeMutation(); },
      update(patch){ mode='update'; body=patch; return b; },
      delete(){ mode='delete'; return b; }
    };
    function terminalIfMutation(){
      if(mode==='update' || mode==='delete') return executeMutation();
      return b;
    }
    async function executeSelect(maybeOne){
      try{
        let q=[];
        if(columns) q.push('select='+encodeURIComponent(columns));
        if(filters.length) q=q.concat(filters);
        if(orderBy) q.push('order='+encodeURIComponent(orderBy)+(ascending?'.asc':'.desc'));
        if(limitN) q.push('limit='+encodeURIComponent(limitN));
        const t=await token();
        const data=await request(base+'?'+q.join('&'),{method:'GET',headers:jsonHeaders(t)});
        const arr=Array.isArray(data)?data:[];
        return {data:maybeOne?(arr[0]||null):arr,error:null};
      }catch(error){ return {data:null,error}; }
    }
    async function executeMutation(){
      try{
        let url=base; if(filters.length) url+='?'+filters.join('&');
        const t=await token();
        let headers={...jsonHeaders(t)};
        let method='POST';
        if(mode==='update') method='PATCH';
        else if(mode==='delete') method='DELETE';
        else if(mode==='upsert'){
          headers.Prefer='resolution=merge-duplicates,return=representation';
          if(conflict) url+='?on_conflict='+encodeURIComponent(conflict);
        }else if(mode==='insert') headers.Prefer='return=representation';
        else method='POST';
        const data=await request(url,{method,headers,body:mode==='delete'?undefined:JSON.stringify(body)});
        return {data,error:null};
      }catch(error){ return {data:null,error}; }
    }
    return b;
  }

  window.supabase={createClient:function(){
    return {
      auth:{signInWithPassword,getSession,signOut},
      from:builder,
      __ersyaLite:true
    };
  }};
})();
