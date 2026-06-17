/* ---------- Editorial stylesheet (ported from the prototype artifact) ---------- */
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root{
  --ink:#211d16; --ink-soft:#4d4639; --cream:#f6f1e6; --paper:#fcf9f1;
  --rule:#d8cfba; --garnet:#7a2e2a; --moss:#3f5d43; --amber:#9a6a1f;
  --mono:'IBM Plex Mono',monospace; --sans:'IBM Plex Sans',sans-serif; --disp:'Fraunces',serif;
}
*{box-sizing:border-box}
html,body,#root{margin:0;padding:0}
.app{min-height:100vh;background:var(--cream);color:var(--ink);font-family:var(--sans);padding:28px clamp(16px,4vw,56px) 48px;}
button{font-family:var(--sans);cursor:pointer}

.masthead{max-width:1100px;margin:0 auto}
.mast-rule{height:1px;background:var(--rule)}
.mast-rule.heavy{height:3px;background:var(--ink);margin-top:14px}
.mast-row{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding:18px 0 0;flex-wrap:wrap}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--garnet);margin-bottom:8px}
.title{font-family:var(--disp);font-weight:700;font-size:clamp(30px,4.4vw,52px);line-height:1.02;margin:0}
.mast-meta{font-size:12.5px;color:var(--ink-soft);display:flex;flex-direction:column;gap:4px;padding-bottom:6px}
.meta-line span{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--garnet);margin-right:8px}

.brief{max-width:1100px;margin:22px auto 0;background:var(--paper);border:1px solid var(--rule);padding:20px 22px}
.brief-label{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);display:block;margin-bottom:8px}
.brief-input{width:100%;font-family:var(--disp);font-size:18px;line-height:1.45;color:var(--ink);background:transparent;border:none;border-bottom:1px solid var(--rule);resize:vertical;padding:4px 0 10px;outline:none}
.brief-input:focus{border-bottom-color:var(--garnet)}
.brief-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
.btn{background:transparent;border:1px solid var(--ink);padding:9px 16px;font-size:13px;font-weight:500;color:var(--ink);transition:background .15s}
.btn:hover{background:var(--ink);color:var(--cream)}
.btn.primary{background:var(--ink);color:var(--cream)}
.btn.primary:hover{background:var(--garnet);border-color:var(--garnet)}
.btn:disabled{opacity:.5;cursor:wait}
.btn.small{padding:5px 11px;font-size:12px}

.pipeline{display:flex;gap:8px;align-items:center;margin-top:16px;flex-wrap:wrap}
.pstep{font-family:var(--mono);font-size:11px;letter-spacing:.06em;padding:5px 10px;border:1px solid var(--rule);color:var(--ink-soft)}
.pstep.live{border-color:var(--garnet);color:var(--garnet);animation:pulse 1.4s infinite}
.pstep.done{border-color:var(--moss);color:var(--moss)}
.pnote{font-size:12px;color:var(--ink-soft);font-style:italic}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion: reduce){.pstep.live{animation:none}}

.notice{margin-top:14px;padding:11px 14px;font-size:13px;border-left:3px solid}
.notice.warn{border-color:var(--amber);background:#f4ead6;color:#6e4c14}
.notice.error{border-color:var(--garnet);background:#f2e2e0;color:var(--garnet)}

.layout{max-width:1100px;margin:26px auto 0;display:grid;grid-template-columns:240px 1fr;gap:26px;align-items:start}
@media(max-width:820px){.layout{grid-template-columns:1fr}}
.toc{position:sticky;top:16px;background:var(--paper);border:1px solid var(--rule)}
@media(max-width:820px){.toc{position:static}}
.toc-head{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:12px 14px;border-bottom:1px solid var(--rule);color:var(--ink-soft)}
.toc-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--rule);padding:10px 14px;font-size:13px;color:var(--ink)}
.toc-item:hover{background:var(--cream)}
.toc-item.active{background:var(--ink);color:var(--cream)}
.toc-num{font-family:var(--mono);font-size:11px;color:var(--garnet)}
.toc-item.active .toc-num{color:#e8b9a8}
.toc-label{flex:1}
.dot{width:7px;height:7px;border-radius:50%;border:1px solid var(--rule)}
.dot.ok{background:var(--moss);border-color:var(--moss)}
.toc-foot{padding:12px 14px;font-size:11.5px;color:var(--ink-soft);line-height:1.6}
.warn-text{color:var(--amber)} .ok-text{color:var(--moss)}

.card{background:var(--paper);border:1px solid var(--rule);padding:26px 30px;box-shadow:4px 4px 0 rgba(33,29,22,.08)}
.sec-head{display:flex;justify-content:space-between;align-items:center;gap:14px;border-bottom:3px solid var(--ink);padding-bottom:12px;margin-bottom:18px;flex-wrap:wrap}
.sec-title{display:flex;align-items:baseline;gap:12px}
.sec-num{font-family:var(--mono);font-size:13px;color:var(--garnet)}
.sec-title h2{font-family:var(--disp);font-weight:600;font-size:26px;margin:0}
.sec-actions{display:flex;align-items:center;gap:12px}
.review-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-soft);cursor:pointer;border:1px solid var(--rule);padding:5px 10px}
.review-toggle.on{border-color:var(--moss);color:var(--moss);font-weight:600}
.review-toggle input{accent-color:var(--moss)}

.prose{font-size:15px;line-height:1.72}
.md-p{margin:0 0 13px}
.md-p.muted{color:var(--ink-soft);font-size:13.5px;font-style:italic}
.md-ul{margin:0 0 13px;padding-left:22px}
.md-ul li{margin-bottom:5px}
.md-h{font-family:var(--disp);font-weight:600;margin:20px 0 8px}
.md-h1{font-size:22px}.md-h2{font-size:19px}.md-h3{font-size:16.5px}.md-h4{font-size:15px;font-family:var(--sans);letter-spacing:.04em;text-transform:uppercase;color:var(--garnet)}

.cite-chip{font-family:var(--mono);font-size:11px;background:none;border:none;border-bottom:1.5px solid var(--garnet);color:var(--garnet);padding:0 2px;margin:0 1px;cursor:pointer}
.cite-chip:hover{background:#f0ddd9}
.cite-chip.cite-unknown{color:var(--amber);border-bottom-color:var(--amber)}
.local-placeholder{font-family:var(--mono);font-size:12px;background:#f4ead6;border:1px dashed var(--amber);color:#6e4c14;padding:1px 6px}

.cite-row{display:flex;gap:14px;border-bottom:1px solid var(--rule);padding:14px 0;align-items:flex-start}
.cite-id{font-family:var(--mono);font-size:12px;color:var(--garnet);min-width:38px;padding-top:2px}
.cite-body{flex:1}
.cite-title{font-family:var(--disp);font-weight:600;font-size:15.5px;margin-bottom:3px}
.cite-meta{font-size:12.5px;color:var(--ink-soft);margin-bottom:5px}
.cite-finding{font-size:13px;line-height:1.55}
.cite-side{display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:120px}
.badge{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border:1px solid}
.badge.anchor{color:var(--garnet);border-color:var(--garnet)}
.badge.consensus{color:var(--moss);border-color:var(--moss)}
.verify{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-soft);cursor:pointer}
.verify input{accent-color:var(--moss)}

.raw{margin-top:18px;font-size:12px}
.raw summary{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);cursor:pointer}
.raw pre{background:var(--cream);border:1px solid var(--rule);padding:12px;white-space:pre-wrap;max-height:280px;overflow:auto;font-family:var(--mono);font-size:11px;line-height:1.5}

.empty{max-width:680px;margin:60px auto;text-align:center;color:var(--ink-soft);font-size:15px;line-height:1.7}
.empty-num{font-family:var(--disp);font-size:64px;color:var(--rule);line-height:1;margin-bottom:12px}

.foot{max-width:1100px;margin:40px auto 0;border-top:1px solid var(--rule);padding-top:14px;font-size:11.5px;color:var(--ink-soft);font-family:var(--mono);letter-spacing:.02em}

button:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid var(--garnet);outline-offset:2px}
`;
