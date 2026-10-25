// Headless play-tester: runs N full games with both sides on autopilot and prints balance stats.
// Usage: node tools/sim.js [games=2000] [quarterSeconds=300]
const fs=require("fs"),path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","seahawks","index.html"),"utf8");
const src=html.match(/<script>([\s\S]*)<\/script>/)[1];
const N=+process.argv[2]||2000,QL=+process.argv[3]||300;
const stub=()=>({hidden:true,value:"0",innerHTML:"",textContent:""});
const els={};const document={getElementById:id=>els[id]||(els[id]=stub())};
const driver=`
render=function(){};
const swap=f=>{[G.score.me,G.score.opp]=[G.score.opp,G.score.me];[G.to.me,G.to.opp]=[G.to.opp,G.to.me];try{return f()}finally{[G.score.me,G.score.opp]=[G.score.opp,G.score.me];[G.to.me,G.to.opp]=[G.to.opp,G.to.me]}};
const S={g:0,pts:[],me:0,opp:0,tie:0,ot:0,plays:0,msgs:{},errs:[],drives:0};
const bump=k=>S.msgs[k]=(S.msgs[k]||0)+1;
const _say=say;say=function(m,c){
 for(const [k,re] of [["TD",/TOUCHDOWN|PICK-SIX/],["FG good",/field goal! \\+3/],["FG miss",/attempt is no good/],["INT",/INTERCEPTED|intercepts/],["Fumble lost",/FUMBLE.*recover/],["Sack",/SACKS|sacks/],["Punt",/punts/],["Safety",/SAFETY!/],["Turnover on downs",/Turnover on downs/],["Penalty",/FLAG!/],["First down",/FIRST DOWN/],["2pt good",/two-point try is GOOD/],["2pt fail",/two-point try is stopped/],["XP miss",/misses the extra/],["Onside recovered",/RECOVER it/],["Return TD",/all the way back/]])if(re.test(m))bump(k);
 return _say(m,c)};
function check(){
 if(G.over||G.pending)return;
 if(!(G.yd>=1&&G.yd<=99))throw Error("yd out of range "+G.yd);
 if(!(G.down>=1&&G.down<=4))throw Error("bad down "+G.down);
 if(G.fd<=G.yd)throw Error("fd<=yd");
 if(G.clock<0)throw Error("neg clock");
}
for(let g=0;g<${N};g++){
 G0=Math.floor(Math.random()*T.length);Q0=${QL};start();let n=0;
 try{
 while(!G.over){
  if(++n>2000)throw Error("loop "+JSON.stringify({q:G.q,clock:G.clock,p:G.pending,poss:G.poss}));
  if(G.pending==="conv"){if(G.ct==="me")CV(swap(aiConv));else oppConv();continue}
  if(G.pending==="kickoff"){if(G.kt==="me")KO(swap(aiKick));else oppKO();continue}
  check();S.plays++;
  if(G.poss==="me"){
   if(G.down===4&&!G.goFor){const k=swap(aiFourth);if(k==="punt")PUNT();else if(k==="fg")FG();else{GO();P1(swap(aiCall))}}
   else{const f=swap(aiFlags);G.hurry=f.hu;G.tout=!!f.toTeam;P1(swap(aiCall))}
  }else{
   if(G.down===4&&!G.plan)G.plan={kind:aiFourth()};
   const pl=G.plan;
   if(pl&&pl.kind==="punt")OPP("punt");else if(pl&&pl.kind==="fg")OPP("fg");else D1(aiDef());
  }
 }}catch(e){S.errs.push(e.message);continue}
 S.g++;S.pts.push(G.score.me,G.score.opp);if(G.ot)S.ot++;
 if(G.score.me>G.score.opp)S.me++;else if(G.score.me<G.score.opp)S.opp++;else S.tie++;
}
const avg=S.pts.reduce((a,b)=>a+b,0)/S.pts.length,sorted=[...S.pts].sort((a,b)=>a-b);
console.log("games",S.g,"errors",S.errs.length,S.errs.slice(0,5));
console.log("pts/team avg",avg.toFixed(1),"median",sorted[sorted.length>>1],"shutouts%",(100*S.pts.filter(p=>p===0).length/S.pts.length).toFixed(1));
console.log("plays/game",(S.plays/S.g).toFixed(1),"win% me/opp/tie",[S.me,S.opp,S.tie].map(x=>(100*x/S.g).toFixed(1)).join(" / "),"OT%",(100*S.ot/S.g).toFixed(1));
console.log("per game:",Object.entries(S.msgs).map(([k,v])=>k+" "+(v/S.g).toFixed(2)).join(" | "));
`;
new Function("document","navigator","window","matchMedia",src+"\n"+driver)(document,{},{},()=>({matches:true}));
