const API="/api";let token=localStorage.getItem("jc_token"),me=null;
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
async function req(path,opt={}){let h={"Content-Type":"application/json",...(opt.headers||{})};if(token)h.Authorization="Bearer "+token;let r=await fetch(API+path,{...opt,headers:h});let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
const api=async(path,opt={})=>req(path,{...opt,body:opt.body&&typeof opt.body!=="string"?JSON.stringify(opt.body):opt.body});
const escapeHtml=esc;
function msg(id,t){$(id).textContent=t}function initials(n){return n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function update(){let on=!!token;$("#logout").classList.toggle("hidden",!on);$("#auth").classList.toggle("hidden",on);$("#session").innerHTML=on?'<span class="btn">Signed in</span>':'<span class="btn ghost">Guest mode</span>';$("#miniName").textContent=me?.name||"Guest";$("#miniBio").textContent=me?.bio||"Sign in to build your profile.";$("#miniAvatar").textContent=me?initials(me.name):"?";if(me){$("#profileName").value=me.name;$("#profileBio").value=me.bio||""}}
async function loadMe(){if(!token){update();return}try{me=(await req("/users/me")).user;update()}catch(e){token=null;localStorage.removeItem("jc_token");update()}}
async function register(){let d=await req("/auth/register",{method:"POST",body:JSON.stringify({name:$("#name").value.trim(),email:$("#email").value.trim(),password:$("#password").value})});token=d.token;localStorage.setItem("jc_token",token);$("#verifyBox").classList.remove("hidden");msg("#authMsg",d.message||"Account created. Verify your email.");await loadMe()}
async function login(){let d=await req("/auth/login",{method:"POST",body:JSON.stringify({email:$("#email").value.trim(),password:$("#password").value})});token=d.token;localStorage.setItem("jc_token",token);await loadMe();msg("#authMsg","Logged in.")}
$("#register").onclick=async e=>{e.preventDefault();try{await register()}catch(x){msg("#authMsg",x.message)}};$("#login").onclick=async()=>{try{await login()}catch(x){msg("#authMsg",x.message)}};
$("#verifyForm").onsubmit=async e=>{e.preventDefault();try{let d=await req("/auth/verify",{method:"POST",body:JSON.stringify({token:$("#verifyToken").value.trim()})});msg("#authMsg",d.message)}catch(x){msg("#authMsg",x.message)}};
$("#logout").onclick=async()=>{try{await req("/auth/logout",{method:"POST"})}catch(e){}token=null;me=null;localStorage.removeItem("jc_token");update()};
$("#openPost").onclick=()=>$("#postForm").classList.toggle("hidden");
$("#postForm").onsubmit=async e=>{e.preventDefault();try{await req("/posts",{method:"POST",body:JSON.stringify({title:$("#postTitle").value,body:$("#postBody").value})});e.target.reset();e.target.classList.add("hidden");loadPosts()}catch(x){alert(x.message)}};
async function loadPosts(){try{let d=await req("/posts");$("#posts").innerHTML=d.posts.map(p=>`<article class="post"><div class="meta">${esc(p.author_name)} · ${new Date(p.created_at).toLocaleString()}</div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><div class="actions"><button onclick="likePost(${p.id})">♥ ${p.likes}</button><button onclick="toggleComments(${p.id})">Comments</button><button onclick="reportPost(${p.id})">Report</button></div><div id="comments-${p.id}" class="comments hidden"></div></article>`).join("")||'<p class="muted">No posts yet.</p>'}catch(e){$("#posts").innerHTML=`<p class="muted">${esc(e.message)}</p>`}}
async function likePost(id){if(!token)return alert("Log in to like posts.");try{await req(`/posts/${id}/like`,{method:"POST"});loadPosts()}catch(e){alert(e.message)}}
async function toggleComments(id){let box=$(`#comments-${id}`);box.classList.toggle("hidden");if(box.dataset.loaded)return;try{let d=await req(`/posts/${id}/comments`);box.innerHTML=d.comments.map(c=>`<div class="comment"><strong>${esc(c.author_name)}</strong><span>${esc(c.body)}</span></div>`).join("")+(token?`<form onsubmit="addComment(event,${id})"><input placeholder="Write a comment..." maxlength="500" required><button class="mini">Comment</button></form>`:"");box.dataset.loaded="1"}catch(e){box.textContent=e.message}}
async function addComment(e,id){e.preventDefault();let i=e.target.querySelector("input");try{await req(`/posts/${id}/comments`,{method:"POST",body:JSON.stringify({body:i.value})});i.value="";let b=$(`#comments-${id}`);delete b.dataset.loaded;await toggleComments(id);b.classList.remove("hidden")}catch(x){alert(x.message)}}
async function reportPost(id){if(!token)return alert("Log in to report.");let reason=prompt("Reason for report?");if(reason)try{await req("/reports",{method:"POST",body:JSON.stringify({post_id:id,reason})});alert("Report submitted.")}catch(e){alert(e.message)}}
async function loadMembers(q=""){try{let d=await req("/users?search="+encodeURIComponent(q));$("#membersGrid").innerHTML=d.members.map(m=>`<article class="member"><div class="avatar">${esc(m.initials)}</div><strong>${esc(m.name)}</strong><small>${esc(m.bio||"Fan community member")}</small>${me&&me.id!==m.id?`<button class="mini" onclick="follow(${m.id})">${m.following?"Following":"Follow"}</button>`:""}</article>`).join("")}catch(e){$("#membersGrid").textContent=e.message}}
async function follow(id){try{await req(`/users/${id}/follow`,{method:"POST"});loadMembers($("#memberSearch").value);loadNotifications()}catch(e){alert(e.message)}}
$("#profileForm").onsubmit=async e=>{e.preventDefault();try{me=(await req("/users/me",{method:"PATCH",body:JSON.stringify({name:$("#profileName").value,bio:$("#profileBio").value})})).user;update();msg("#profileMsg","Profile saved.")}catch(x){msg("#profileMsg",x.message)}};
async function loadNotifications(){if(!token){$("#notices").innerHTML='<p class="muted">Sign in to see notifications.</p>';return}try{let d=await req("/notifications");$("#notices").innerHTML=d.notifications.map(n=>`<div class="notice"><strong>${esc(n.type)}</strong><div>${esc(n.message)}</div><small>${new Date(n.created_at).toLocaleString()}</small></div>`).join("")||'<p class="muted">No notifications.</p>'}catch(e){$("#notices").textContent=e.message}}
async function loadReports(){try{let d=await req("/admin/reports");$("#reports").innerHTML=d.reports.map(r=>`<div class="report"><strong>#${r.id} — ${esc(r.reason)}</strong><p>${esc(r.title)} by ${esc(r.author_name)}</p><button class="mini danger" onclick="resolveReport(${r.id})">Resolve</button></div>`).join("")||'<p class="muted">No open reports.</p>'}catch(e){$("#reports").textContent=e.message}}
async function resolveReport(id){try{await req(`/admin/reports/${id}`,{method:"PATCH"});loadReports()}catch(e){alert(e.message)}}
loadMe();loadPosts();loadMembers();loadNotifications();
function escapeAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
async function loadMembership(){const box=document.getElementById("membershipStatus");if(!box)return;if(!token){box.textContent="Sign in to view membership status or purchase.";return}try{const r=await api("/api/membership/me");if(!r){box.textContent="No membership yet. Join for $550 USD.";return}box.innerHTML=`<strong>Status:</strong> ${escapeHtml(r.status)} · <strong>Top Fan ID:</strong> ${escapeHtml(r.card_number||"Pending")} · <strong>Show benefits:</strong> ${Number(r.used_count||0)}/${Number(r.total_uses||2)} used`;const links=document.getElementById("privateLinks");links.innerHTML="";if(r.channel_status==="approved"){if(r.whatsapp_url)links.innerHTML+=`<a class="primary button" href="${escapeAttr(r.whatsapp_url)}" target="_blank" rel="noopener">Open WhatsApp</a>`;if(r.signal_url)links.innerHTML+=`<a class="secondary button" href="${escapeAttr(r.signal_url)}" target="_blank" rel="noopener">Open Signal</a>`}else links.textContent="Private-channel access is pending administrator approval."}catch(e){box.textContent=e.message}}
document.getElementById("membershipCheckout")?.addEventListener("click",async()=>{try{const r=await api("/api/membership/checkout",{method:"POST"});if(r.url)location.href=r.url;else alert(r.error||"Payment setup is unavailable.")}catch(e){alert(e.message)}});
document.getElementById("loadMembership")?.addEventListener("click",loadMembership);
document.getElementById("meetGreetForm")?.addEventListener("submit",async(e)=>{e.preventDefault();try{await api("/api/membership/meet-greet",{method:"POST",body:{requested_show:document.getElementById("mgShow").value,requested_city:document.getElementById("mgCity").value,requested_date:document.getElementById("mgDate").value||null,message:document.getElementById("mgMessage").value}});e.target.reset();alert("Your request was submitted for administrator review.");loadMeetGreets()}catch(err){alert(err.message)}});
async function loadMeetGreets(){const el=document.getElementById("mgList");if(!el||!token)return;try{const rows=await api("/api/membership/meet-greet");el.innerHTML=rows.map(x=>`<article class="card"><strong>${escapeHtml(x.requested_show||"Show request")}</strong><span>${escapeHtml(x.status)}</span><p>${escapeHtml(x.requested_city||"")}</p></article>`).join("")}catch(e){el.textContent=e.message}}
window.addEventListener("load",()=>{loadMembership();loadMeetGreets()});


async function adminApi(path, options={}) {
  return api(path, options);
}
function adminEscape(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function adminButton(label, action, id){return `<button class="secondary" data-admin-action="${action}" data-id="${adminEscape(id)}">${label}</button>`;}

async function loadAdminDashboard(){
  const dash=document.getElementById("admin-dashboard");
  if(!dash || !token) return;
  try{
    const me=await adminApi("/api/users/me");
    if(!me || me.role!=="admin"){dash.hidden=true;return;}
    dash.hidden=false;
    await Promise.all([loadAdminMembers(),loadAdminMeetGreets(),loadAdminAccess()]);
  }catch(e){dash.hidden=true;}
}

async function loadAdminMembers(){
  const body=document.getElementById("adminMembersBody"); if(!body)return;
  try{
    const rows=await adminApi("/api/admin/membership/memberships");
    body.innerHTML=rows.map(r=>`<tr>
      <td><strong>${adminEscape(r.name)}</strong><br><span class="muted">${adminEscape(r.email)}</span></td>
      <td>${adminEscape(r.status)}</td>
      <td>${adminEscape(r.card_number||"—")}</td>
      <td>${Number(r.used_count||0)}/${Number(r.total_uses||2)}</td>
      <td>${adminEscape(r.channel_status||"none")}</td>
      <td>${r.status==="active" ? adminButton("Manage access","access",r.user_id) : adminButton("Activate","activate",r.id)}</td>
    </tr>`).join("");
  }catch(e){body.innerHTML=`<tr><td colspan="6">${adminEscape(e.message)}</td></tr>`}
}

async function loadAdminMeetGreets(){
  const body=document.getElementById("adminMeetBody"); if(!body)return;
  try{
    const rows=await adminApi("/api/admin/membership/meet-greet");
    body.innerHTML=rows.map(r=>`<tr>
      <td>${adminEscape(r.name)}<br><span class="muted">${adminEscape(r.email)}</span></td>
      <td>${adminEscape(r.requested_show||"—")}</td><td>${adminEscape(r.requested_city||"—")}</td>
      <td>${adminEscape(r.requested_date||"—")}</td><td>${adminEscape(r.status)}</td>
      <td><select data-meet-status="${adminEscape(r.id)}">
        ${["pending","approved","declined","completed","cancelled"].map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}
      </select></td>
    </tr>`).join("");
  }catch(e){body.innerHTML=`<tr><td colspan="6">${adminEscape(e.message)}</td></tr>`}
}

async function loadAdminAccess(){
  const el=document.getElementById("adminAccessList"); if(!el)return;
  try{
    const rows=await adminApi("/api/admin/membership/memberships");
    el.innerHTML=rows.filter(r=>r.status==="active").map(r=>`<div class="admin-card">
      <div><strong>${adminEscape(r.name)}</strong><div class="muted">${adminEscape(r.email)} · ${adminEscape(r.channel_status||"none")}</div></div>
      ${r.channel_status==="approved"?adminButton("Revoke","revoke",r.user_id):adminButton("Review / Approve","access",r.user_id)}
    </div>`).join("") || `<p class="muted">No active memberships yet.</p>`;
  }catch(e){el.textContent=e.message}
}

function openActivation(id){
  document.getElementById("activateMembershipId").value=id;
  document.getElementById("activationModal").hidden=false;
}
function closeActivation(){document.getElementById("activationModal").hidden=true;}

document.addEventListener("click",async(e)=>{
  const b=e.target.closest("[data-admin-action]");
  if(b){
    const action=b.dataset.adminAction,id=b.dataset.id;
    try{
      if(action==="activate") openActivation(id);
      if(action==="revoke"){await adminApi(`/api/admin/membership/private-channel/${id}/revoke`,{method:"POST"});await loadAdminDashboard();}
      if(action==="access"){document.querySelector('[data-tab="admin-access"]')?.click();document.getElementById("adminAccessList")?.scrollIntoView({behavior:"smooth"});}
    }catch(err){alert(err.message)}
  }
});
document.getElementById("closeActivation")?.addEventListener("click",closeActivation);
document.getElementById("confirmActivation")?.addEventListener("click",async()=>{
  const id=document.getElementById("activateMembershipId").value;
  try{
    await adminApi(`/api/admin/membership/memberships/${id}/activate`,{method:"POST",body:{
      whatsapp_url:document.getElementById("waLink").value,
      signal_url:document.getElementById("signalLink").value,
      expires_at:document.getElementById("expiryDate").value||null
    }});
    closeActivation(); document.getElementById("waLink").value="";document.getElementById("signalLink").value="";document.getElementById("expiryDate").value="";
    await loadAdminDashboard(); alert("Membership activated and Top Fan ID issued.");
  }catch(err){alert(err.message)}
});
document.addEventListener("change",async(e)=>{
  const sel=e.target.closest("[data-meet-status]"); if(!sel)return;
  try{await adminApi(`/api/admin/membership/meet-greet/${sel.dataset.meetStatus}`,{method:"PATCH",body:{status:sel.value}});await loadAdminMeetGreets();}
  catch(err){alert(err.message)}
});
document.addEventListener("click",e=>{
  const tab=e.target.closest(".admin-tab");if(!tab)return;
  document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));tab.classList.add("active");
  document.querySelectorAll(".admin-tab-panel").forEach(x=>x.hidden=x.id!==tab.dataset.tab);
});
window.addEventListener("load",()=>setTimeout(loadAdminDashboard,300));
