'use strict';

/* ── PASSWORD TOGGLE ─────────────────────────────────── */
function toggleNewPw(){
  const inp=document.getElementById('newPassword');
  const eye=document.getElementById('newPwEye');
  if(!inp||!eye) return;
  if(inp.type==='password'){ inp.type='text'; eye.textContent='🙈'; }
  else { inp.type='password'; eye.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'; }
}

/* ── MESSAGE HELPERS ─────────────────────────────────── */
const ICONS={ok:'✓',err:'✕',info:'ℹ'};
function showMsg(type,text){
  const b=document.getElementById('authMsg');
  if(b) b.className='msg '+type;
  const msgTxt=document.getElementById('msgTxt');
  if(msgTxt) msgTxt.textContent=text||'';
}
function clearMsg(){
  const b=document.getElementById('authMsg');
  if(b) b.className='msg hidden';
  const msgTxt=document.getElementById('msgTxt');
  if(msgTxt) msgTxt.textContent='';
}

/* ── FRIENDLY ERROR MAPPING ──────────────────────────── */
function friendlyErrorMessage(e, context){
  const raw=(e&&(e.message||e.error_description||String(e)))||'';
  console.error(`[AcademeForge${context?' · '+context:''}] Technical error:`,e);
  if(/failed to fetch|networkerror|network request failed|load failed/i.test(raw))
    return 'We couldn\u2019t reach our servers. Please check your internet connection and try again.';
  if(/timeout|timed out/i.test(raw))
    return 'That took too long to respond. Please try again in a moment.';
  if(/supabase client library failed to load/i.test(raw))
    return 'This page didn\u2019t load correctly. Please refresh and try again.';
  if(/functionshttperror|non-2xx|edge function/i.test(raw))
    return 'Our server had trouble processing that. Please try again in a moment.';
  if(/functionsrelayerror|functionsfetcherror/i.test(raw))
    return 'We couldn\u2019t connect to our servers. Please try again in a moment.';
  return 'Something went wrong on our end. Please try again in a moment.';
}

/* ── SUPABASE ─────────────────────────────────────────── */
const STUDENT_URL="https://afooyyydhlwngzssgqih.supabase.co";
const STUDENT_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb295eXlkaGx3bmd6c3NncWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDQxMjgsImV4cCI6MjA5NDIyMDEyOH0.KG0XO0oP_2MpewHoIwTtbrKg5FkyOYRUtVzLH1MSJiE";
const cleanPhone=v=>String(v||'').trim().replace(/\D/g,'');
let _sb=null;
function getSb(){
  if(_sb) return _sb;
  if(typeof window.supabase==='undefined'||!window.supabase.createClient)
    throw new Error('Supabase client library failed to load.');
  _sb=window.supabase.createClient(STUDENT_URL,STUDENT_KEY);
  return _sb;
}
async function edgeCall(fn,payload){
  try{
    if(!navigator.onLine) return{ok:false,message:'You\u2019re offline. Please check your internet connection and try again.'};
    const sb=getSb();
    const{data,error}=await sb.functions.invoke(fn,{body:payload||{}});
    if(error) return{ok:false,message:friendlyErrorMessage(error,fn)};
    if(!data){ console.error(`[AcademeForge · ${fn}] Empty response.`); return{ok:false,message:'We didn\u2019t get a response from the server. Please try again.'}; }
    return data;
  }catch(e){ return{ok:false,message:friendlyErrorMessage(e,fn)}; }
}

/* ── RESEND COOLDOWN TIMER ───────────────────────────── */
let _resendTimer=null;
let _resendSecondsLeft=0;

function startResendCooldown(){
  const btn=document.getElementById('btnResend');
  if(!btn) return;
  clearResendCooldown();
  _resendSecondsLeft=90;
  btn.disabled=true;
  btn.textContent='Resend Code ('+_resendSecondsLeft+'s)';
  _resendTimer=setInterval(function(){
    _resendSecondsLeft--;
    if(_resendSecondsLeft<=0){ clearResendCooldown(); }
    else { if(btn) btn.textContent='Resend Code ('+_resendSecondsLeft+'s)'; }
  },1000);
}

function clearResendCooldown(){
  if(_resendTimer){ clearInterval(_resendTimer); _resendTimer=null; }
  _resendSecondsLeft=0;
  const btn=document.getElementById('btnResend');
  if(btn){ btn.disabled=false; btn.textContent='Resend Code'; }
}

/* ── STEP TRACKER ─────────────────────────────────────── */
function setStep(n){
  for(let i=1;i<=3;i++){
    const c=document.getElementById('sc'+i);
    if(i<n){ c.className='step-circle done'; c.textContent='✓'; }
    else if(i===n){ c.className='step-circle active'; c.textContent=i; }
    else{ c.className='step-circle'; c.textContent=i; }
    if(i<3){
      const l=document.getElementById('sl'+i);
      if(l) l.className='step-line'+(i<n?' done':'');
    }
  }
}

let _resetStudent=null;
let _forgotOtpVerified=false;

/* ── STEP 1: FIND ACCOUNT ────────────────────────────── */
async function findStudentForReset(){
  clearMsg();
  const value=(document.getElementById('forgotLogin').value||'').trim();
  const clean=cleanPhone(value);
  if(!value){ showMsg('err','Please enter your Account ID, phone, or email.'); return; }
  const btn=document.getElementById('btnFindAccount');
  btn.disabled=true; btn.textContent='Finding account\u2026';
  showMsg('info','Looking up your AcademeForge Account\u2026');
  const res=await edgeCall('student-find-reset-af',{value,clean_value:clean,email_value:value.toLowerCase()});
  if(!res||!res.ok){ showMsg('err',res?.message||'No account found with those details.'); btn.disabled=false; btn.textContent='Send Verification Code'; return; }
  if(!res.student?.email){ showMsg('err','Account found but no email on record. Contact support.'); btn.disabled=false; btn.textContent='Send Verification Code'; return; }
  _resetStudent=res.student; _forgotOtpVerified=false;
  showMsg('info','Sending verification code to your registered email\u2026');
  const otpRes=await edgeCall('student-send-otp-af',{email:_resetStudent.email,mobile:_resetStudent.mobile||'',purpose:'reset'});
  if(!otpRes||!otpRes.ok){ showMsg('err',otpRes?.message||'Could not send verification code. Please try again.'); btn.disabled=false; btn.textContent='Send Verification Code'; return; }
  document.getElementById('s1Area').classList.add('hidden');
  document.getElementById('s2Area').classList.remove('hidden');
  document.getElementById('forgotLogin').disabled=true;
  btn.classList.add('hidden');
  setStep(2);
  showMsg('ok','Verification code sent to your registered email address.');
  startResendCooldown();
}

/* ── BACK TO STEP 1 ──────────────────────────────────── */
function backToStep1(){
  clearMsg();
  clearResendCooldown();
  _resetStudent=null;
  _forgotOtpVerified=false;
  document.getElementById('s1Area').classList.remove('hidden');
  document.getElementById('s2Area').classList.add('hidden');
  document.getElementById('forgotOtp').value='';
  const loginEl=document.getElementById('forgotLogin');
  if(loginEl) loginEl.disabled=false;
  const btn=document.getElementById('btnFindAccount');
  if(btn){ btn.classList.remove('hidden'); btn.disabled=false; btn.textContent='Send Verification Code'; }
  setStep(1);
}

/* ── RESEND OTP ───────────────────────────────────────── */
async function resendOtp(){
  if(!_resetStudent) return;
  clearMsg();
  showMsg('info','Resending verification code\u2026');
  const res=await edgeCall('student-send-otp-af',{email:_resetStudent.email,mobile:_resetStudent.mobile||'',purpose:'reset'});
  if(res?.ok){ showMsg('ok','A new verification code has been sent.'); startResendCooldown(); }
  else showMsg('err',res?.message||'Could not resend the code. Please try again.');
}

/* ── STEP 2: VERIFY OTP ──────────────────────────────── */
async function verifyForgotOtp(){
  clearMsg();
  const otp=(document.getElementById('forgotOtp').value||'').trim();
  if(!_resetStudent){ showMsg('err','Please find your account first.'); return; }
  if(!otp||otp.length<6){ showMsg('err','Enter the 6-digit code from your email.'); return; }
  const btn=document.getElementById('btnVerifyOtp');
  btn.disabled=true; btn.textContent='Verifying\u2026';
  showMsg('info','Verifying your identity\u2026');
  const res=await edgeCall('student-verify-otp-af',{email:_resetStudent.email,otp,purpose:'reset'});
  if(!res||!res.ok){ showMsg('err',res?.message||'Incorrect code. Please try again.'); btn.disabled=false; btn.textContent='Verify Code'; return; }
  _forgotOtpVerified=true;
  clearResendCooldown();
  document.getElementById('s2Area').classList.add('hidden');
  document.getElementById('s3Area').classList.remove('hidden');
  setStep(3);
  showMsg('ok','Identity verified. Create your new password below.');
}

/* ── STEP 3: RESET PASSWORD ──────────────────────────── */
async function resetPassword(){
  clearMsg();
  const newPwd=(document.getElementById('newPassword').value||'').trim();
  if(!_resetStudent){ showMsg('err','Session expired. Please start again.'); return; }
  if(!_forgotOtpVerified){ showMsg('err','Identity not yet verified.'); return; }
  if(!newPwd||newPwd.length<6){ showMsg('err','Password must be at least 6 characters.'); return; }
  const btn=document.getElementById('btnResetPassword');
  btn.disabled=true; btn.textContent='Updating\u2026';
  showMsg('info','Updating your AcademeForge Account password\u2026');
  const res=await edgeCall('student-reset-password-af',{id:_resetStudent.id,email:_resetStudent.email,new_password:newPwd});
  if(!res||!res.ok){ showMsg('err',res?.message||'Password update failed. Please try again.'); btn.disabled=false; btn.textContent='Update Password'; return; }
  _resetStudent=null; _forgotOtpVerified=false;
  document.getElementById('boxForgot').classList.add('hidden');
  document.getElementById('boxSuccess').classList.remove('hidden');
}

/* ── THEME ────────────────────────────────────────────── */
function setThemeMode(e){var t=window.matchMedia("(prefers-color-scheme: dark)").matches;let a=e;"system"===e?(a=t?"dark":"light",localStorage.setItem("af_dark_mode","system")):localStorage.setItem("af_dark_mode","dark"===e?"1":"0"),document.documentElement.setAttribute("data-theme",a),document.querySelectorAll(".theme-btn").forEach(e=>e.classList.remove("active"));t=document.querySelector(`.theme-btn[data-theme="${e}"]`);t&&t.classList.add("active")}
document.addEventListener("DOMContentLoaded",()=>{var e=localStorage.getItem("af_dark_mode");let t="system";"1"===e?t="dark":"0"===e&&(t="light");e=document.querySelector(`.theme-btn[data-theme="${t}"]`);e&&e.classList.add("active")});

/* ── FOOTER ACCORDION (mobile) ───────────────────────── */
(function(){
  function initFooterAcc(){
    var toggles=document.querySelectorAll('.footer-acc-toggle');
    toggles.forEach(function(btn){
      btn.addEventListener('click',function(){
        var body=btn.nextElementSibling;
        var isOpen=btn.getAttribute('aria-expanded')==='true';
        toggles.forEach(function(other){
          if(other!==btn){ other.setAttribute('aria-expanded','false'); var ob=other.nextElementSibling; if(ob) ob.classList.remove('is-open'); }
        });
        btn.setAttribute('aria-expanded',isOpen?'false':'true');
        if(body) body.classList.toggle('is-open',!isOpen);
      });
    });
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initFooterAcc); }
  else { initFooterAcc(); }
})();
