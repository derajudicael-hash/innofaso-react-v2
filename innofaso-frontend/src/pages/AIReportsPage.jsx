import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

// ── localStorage ──────────────────────────────────────────────
const KEY_ENTRIES = "hygienemap_entries_v2";
const KEY_RESULTS = "hygienemap_results_v2";

function readLS() {
  try {
    return {
      entries: JSON.parse(localStorage.getItem(KEY_ENTRIES) || "[]"),
      results: JSON.parse(localStorage.getItem(KEY_RESULTS) || "{}"),
    };
  } catch { return { entries: [], results: {} }; }
}

// ── Helpers ───────────────────────────────────────────────────
const SEUIL_ENV = { "1":10, "2":25, "3":50, "4":100 };
function getSeuil(id) { return SEUIL_ENV[String(id||"").trim().charAt(0)] ?? 50; }
function getStatut(val, seuil) {
  if (val===null||val===undefined) return "inconnu";
  if (val>=seuil) return "critique";
  if (val>=seuil*0.8) return "surveillance";
  return "conforme";
}
function calcTendance(vals) {
  const v=vals.filter(x=>x!==null&&x!==undefined);
  if (v.length<2) return "stable";
  const n=v.length,sumX=n*(n-1)/2,sumX2=n*(n-1)*(2*n-1)/6;
  const sumY=v.reduce((a,b)=>a+b,0),sumXY=v.reduce((a,x,i)=>a+i*x,0);
  const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX);
  return slope>0.5?"hausse":slope<-0.5?"baisse":"stable";
}
function calcVariabilite(vals) {
  const v=vals.filter(x=>x!==null);
  if(v.length<2)return 0;
  const avg=v.reduce((a,b)=>a+b,0)/v.length;
  return Math.round(Math.sqrt(v.reduce((a,x)=>a+(x-avg)**2,0)/v.length)*10)/10;
}

function applyXlsStyles(ws){
  if(!ws||!ws['!ref'])return ws;
  const rng=XLSX.utils.decode_range(ws['!ref']);
  const bd={top:{style:"thin",color:{rgb:"FFD1D5DB"}},bottom:{style:"thin",color:{rgb:"FFD1D5DB"}},left:{style:"thin",color:{rgb:"FFD1D5DB"}},right:{style:"thin",color:{rgb:"FFD1D5DB"}}};
  for(let R=rng.s.r;R<=rng.e.r;R++){
    for(let C=rng.s.c;C<=rng.e.c;C++){
      const addr=XLSX.utils.encode_cell({r:R,c:C});
      if(!ws[addr])ws[addr]={v:"",t:"s"};
      ws[addr].s={border:bd,font:R===0?{bold:true,color:{rgb:"FFFFFFFF"},sz:10}:{sz:10},fill:R===0?{patternType:"solid",fgColor:{rgb:"FF1E3A5F"}}:{patternType:"solid",fgColor:{rgb:R%2===0?"FFFFFFFF":"FFF8FAFC"}},alignment:{vertical:"center",wrapText:R===0}};
    }
  }
  return ws;
}

// ── Couleurs graphique ────────────────────────────────────────
const CHART_COLORS = ["#8CC63F","#dc2626","#f59e0b","#2563eb","#9333ea","#0891b2"];
const TENDANCE_ICON = {hausse:"↗",stable:"→",baisse:"↘"};
const TENDANCE_CLR  = {hausse:"#dc2626",stable:"#6b7280",baisse:"#16a34a"};

function Spinner({size=14}) {
  return <span style={{display:"inline-block",width:size,height:size,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",animation:"ai-spin .7s linear infinite",flexShrink:0}}/>;
}

// ── Analyse locale ────────────────────────────────────────────
function analyseAllBulletins(entries, results) {
  if (!entries.length) return null;
  const bulletins = entries
    .map(e=>({entry:e,results:results[e.id]||[]}))
    .filter(b=>b.results.length>0)
    .sort((a,b)=>{
      const ya=parseInt(a.entry.year||"2025"),yb=parseInt(b.entry.year||"2025");
      const wa=parseInt(a.entry.weekNum||"0"),wb=parseInt(b.entry.weekNum||"0");
      return ya!==yb?ya-yb:wa-wb;
    });
  if(!bulletins.length) return null;

  const allWeeks=[...new Set(bulletins.map(b=>
    b.entry.weekNum?`S${String(b.entry.weekNum).padStart(2,"0")}-${b.entry.year||"2025"}`:b.entry.date||`B${b.entry.id}`
  ))].sort();

  const pointsMap={};
  bulletins.forEach(b=>{
    const sem=b.entry.weekNum?`S${String(b.entry.weekNum).padStart(2,"0")}-${b.entry.year||"2025"}`:b.entry.date||`B${b.entry.id}`;
    b.results.forEach(r=>{
      if(!r.pointId)return;
      if(!pointsMap[r.pointId])pointsMap[r.pointId]={id:r.pointId,description:r.description||r.pointId,seuil:r.spec??getSeuil(r.pointId),semaines:[],valeurs:[]};
      pointsMap[r.pointId].semaines.push(sem);
      pointsMap[r.pointId].valeurs.push(r.numericValue??null);
    });
  });

  const pointsStats=Object.values(pointsMap).map(p=>{
    const vNN=p.valeurs.filter(v=>v!==null);
    const derniere=vNN[vNN.length-1]??null;
    const tendance=calcTendance(vNN);
    const variabilite=calcVariabilite(vNN);
    const depassements=p.valeurs.filter(v=>v!==null&&v>=p.seuil).length;
    const recent=p.valeurs.slice(-8).filter(v=>v!==null);
    const depassRecents=recent.filter(v=>v>=p.seuil).length;
    const semStable=tendance==="stable"&&vNN.every(v=>v<p.seuil*0.5)?vNN.length:0;
    return {
      ...p,vNN,derniere,tendance,variabilite,depassements,depassRecents,
      pctSeuil:derniere!==null?Math.round(derniere/p.seuil*100):null,
      avgSeuil:vNN.length>0?Math.round((vNN.reduce((a,b)=>a+b,0)/vNN.length)/p.seuil*100):null,
      semStable,statut:getStatut(derniere,p.seuil),nbReleves:vNN.length,
      avg:vNN.length>0?Math.round(vNN.reduce((a,b)=>a+b,0)/vNN.length*10)/10:null,
    };
  });

  const stables=pointsStats.filter(p=>p.statut==="conforme"&&p.tendance==="stable"&&p.depassements===0);
  const aSurveiller=pointsStats.filter(p=>p.tendance==="hausse"||p.statut==="surveillance");
  const critiques=pointsStats.filter(p=>p.statut==="critique"||p.depassRecents>=3);
  const mgsEtendues=pointsStats.filter(p=>p.semStable>=5&&p.depassements===0);
  const conformeTotal=pointsStats.filter(p=>p.statut==="conforme");
  const avgVariabilite=pointsStats.length>0?Math.round(pointsStats.reduce((a,p)=>a+p.variabilite,0)/pointsStats.length*10)/10:0;

  // Données pour le graphique recharts
  const chartData=allWeeks.map(sem=>{
    const row={semaine:sem};
    Object.values(pointsMap).forEach(p=>{
      const i=p.semaines.indexOf(sem);
      row[p.id]=i>=0?p.valeurs[i]:null;
    });
    return row;
  });

  return {
    totalBulletins:bulletins.length,totalWeeks:allWeeks.length,total:pointsStats.length,
    stables,aSurveiller,critiques,mgsEtendues,conformeTotal,
    pointsStats,allWeeks,avgVariabilite,chartData,pointsMap,
  };
}

function genererObservations(analyse) {
  if(!analyse)return[];
  const {pointsStats,stables,critiques,aSurveiller,avgVariabilite,conformeTotal,total}=analyse;
  const obs=[];

  pointsStats.filter(p=>p.tendance==="hausse"&&p.nbReleves>=3).slice(0,5).forEach(p=>{
    obs.push({niveau:"élevé",icon:"↗",colorVar:"var(--red)",bgVar:"var(--red-bg)",borderVar:"var(--red-bd)",point:p.id,description:p.description,
      texte:`Le point "${p.description}" présente une tendance haussière sur ${p.nbReleves} relevés (dernière valeur : ${p.derniere??("—")} UFC/cm², seuil : ${p.seuil} UFC/cm²${p.depassements>0?`, ${p.depassements} dépassement(s) détecté(s)`:""}${p.depassRecents>=3?`, dont ${p.depassRecents} sur les 8 derniers relevés`:""}).`,
      justification:`Pente haussière calculée sur ${p.nbReleves} relevés. Valeur moyenne : ${p.avg} UFC/cm².`});
  });

  stables.filter(p=>p.nbReleves>=4).slice(0,4).forEach(p=>{
    obs.push({niveau:"faible",icon:"✓",colorVar:"var(--green)",bgVar:"var(--green-bg)",borderVar:"var(--green-bd)",point:p.id,description:p.description,
      texte:`Le point "${p.description}" reste conforme sur l'ensemble des ${p.nbReleves} relevés analysés (valeur moyenne : ${p.avg} UFC/cm², soit ${p.avgSeuil}% du seuil réglementaire).`,
      justification:`Aucun dépassement détecté. Tendance stable. Variabilité : ±${p.variabilite} UFC/cm².`});
  });

  pointsStats.filter(p=>p.variabilite>avgVariabilite*1.5&&p.nbReleves>=3).slice(0,3).forEach(p=>{
    obs.push({niveau:"moyen",icon:"~",colorVar:"var(--orange)",bgVar:"var(--orange-bg)",borderVar:"var(--orange-bd)",point:p.id,description:p.description,
      texte:`Le point "${p.description}" présente une variabilité plus importante que la moyenne (±${p.variabilite} UFC/cm² contre ±${avgVariabilite} en moyenne), malgré des valeurs restant ${p.statut==="conforme"?"sous le seuil":"proches ou au-delà du seuil"}.`,
      justification:`Écart-type calculé sur ${p.nbReleves} relevés. Valeurs entre ${Math.min(...p.vNN)} et ${Math.max(...p.vNN)} UFC/cm².`});
  });

  if(conformeTotal.length>0){
    obs.push({niveau:"faible",icon:"✓",colorVar:"var(--green)",bgVar:"var(--green-bg)",borderVar:"var(--green-bd)",point:null,description:null,
      texte:`${conformeTotal.length} point(s) sur ${total} sont restés conformes sur l'ensemble de la période analysée (${analyse.allWeeks.length} semaine(s)).`,
      justification:`Analyse de ${analyse.totalBulletins} bulletins importés.`});
  }

  critiques.filter(p=>p.depassRecents>=3).slice(0,3).forEach(p=>{
    obs.push({niveau:"élevé",icon:"⚠",colorVar:"var(--red)",bgVar:"var(--red-bg)",borderVar:"var(--red-bd)",point:p.id,description:p.description,
      texte:`Le point "${p.description}" a dépassé son seuil réglementaire (${p.seuil} UFC/cm²) à ${p.depassements} reprise(s) au total, dont ${p.depassRecents} sur les 8 derniers relevés. La dernière valeur enregistrée est de ${p.derniere??("—")} UFC/cm².`,
      justification:`${p.depassRecents} dépassements consécutifs récents. Dernière valeur : ${p.pctSeuil}% du seuil.`});
  });

  pointsStats.filter(p=>p.tendance==="baisse"&&p.nbReleves>=3&&p.premiere>p.seuil*0.5).slice(0,2).forEach(p=>{
    obs.push({niveau:"faible",icon:"↘",colorVar:"var(--green)",bgVar:"var(--green-bg)",borderVar:"var(--green-bd)",point:p.id,description:p.description,
      texte:`Le point "${p.description}" montre une tendance à la baisse sur les ${p.nbReleves} derniers relevés (de ${p.premiere} à ${p.derniere} UFC/cm²), ce qui indique une amélioration de la maîtrise microbiologique.`,
      justification:`Pente négative calculée. Aucune décision requise sur la base de ces seules données.`});
  });

  return obs;
}

// ── Tooltip recharts custom ───────────────────────────────────
function CustomTooltip({active,payload,label,seuil}) {
  if(!active||!payload||!payload.length)return null;
  return (
    <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border,#e5e7eb)",borderRadius:10,padding:"12px 16px",boxShadow:"var(--shadow-md)",minWidth:180}}>
      <div style={{fontWeight:700,marginBottom:8,color:"var(--txt)",fontSize:13}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,fontSize:12}}>
          <span style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0}}/>
          <span style={{color:"var(--txt2)",flex:1}}>{p.name}</span>
          <span style={{fontWeight:700,color:p.value>=seuil?"var(--red)":p.value>=seuil*0.8?"var(--orange)":"var(--txt)",fontFamily:"monospace"}}>{p.value} UFC/cm²</span>
        </div>
      ))}
      <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--border)",fontSize:11,color:"var(--red)",fontWeight:600}}>Seuil réglementaire : {seuil} UFC/cm²</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function AIReportsPage() {
  const [ls,setLs]=useState({entries:[],results:{}});
  const [analyse,setAnalyse]=useState(null);
  const [observations,setObservations]=useState([]);
  const [loading,setLoading]=useState(false);
  const [synthèseIA,setSynthèseIA]=useState(null);
  const [synthèseLoading,setSynthèseLoading]=useState(false);
  const [exportLoading,setExportLoading]=useState(null);
  const [error,setError]=useState(null);
  const [filtreNiveau,setFiltreNiveau]=useState("élevé");
  const [analyseDate,setAnalyseDate]=useState(null);
  const [selectedPoints,setSelectedPoints]=useState([]);

  useEffect(()=>{
    const d=readLS();setLs(d);
    const h=()=>setLs(readLS());
    window.addEventListener("hygienemap-files-changed",h);
    window.addEventListener("storage",h);
    return()=>{window.removeEventListener("hygienemap-files-changed",h);window.removeEventListener("storage",h);};
  },[]);

  useEffect(()=>{if(ls.entries.length>0&&!analyse)lancerAnalyse();},[ls.entries.length]);

  const lancerAnalyse=()=>{
    setLoading(true);setError(null);
    setTimeout(()=>{
      try{
        const a=analyseAllBulletins(ls.entries,ls.results);
        setAnalyse(a);
        if(a){
          setObservations(genererObservations(a));
          // Sélectionner les 3 premiers points par défaut
          const topPoints=Object.values(a.pointsMap||{}).slice(0,3).map(p=>p.id);
          setSelectedPoints(topPoints);
          lancerSynthèseGroq(a);
        }
        setAnalyseDate(new Date());
      }catch(e){setError(e.message);}
      finally{setLoading(false);}
    },300);
  };

  const lancerSynthèseGroq=async(a)=>{
    setSynthèseLoading(true);setSynthèseIA(null);
    try{
      const token=localStorage.getItem("innofaso_token")||"";
      const res=await fetch("/api/reports/from-bulletin",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body:JSON.stringify({
          bulletinType:"trimestriel",
          bulletinRef:`Analyse globale — ${a.totalBulletins} bulletins`,
          results:ls.entries.flatMap(e=>ls.results[e.id]||[]),
          kpis:{total:a.total,conformes:a.conformeTotal.length,surv:a.aSurveiller.length,crits:a.critiques.length,taux:Math.round(a.conformeTotal.length/a.total*100)},
          series:a.pointsStats.slice(0,10).map(p=>({pointId:p.id,description:p.description,seuil:p.seuil,tendance:p.tendance,depassementsRepetes:p.depassements,derniere:p.derniere})),
          pointsCritiques:a.critiques.slice(0,5),
          pointsSurveillance:a.aSurveiller.slice(0,5),
          pointsStables:a.stables.slice(0,5),
          pointsARetirer:a.mgsEtendues.slice(0,3),
        }),
      });
      if(res.ok){const d=await res.json();setSynthèseIA(d.synthesis);}
      else setSynthèseIA({unavailable:true});
    }catch{setSynthèseIA({unavailable:true});}
    finally{setSynthèseLoading(false);}
  };

  const handleExport=async(format)=>{
    if(!analyse)return;
    setExportLoading(format);setError(null);
    try{
      const dateStr=new Date().toLocaleDateString("fr-FR");
      const ref=`Analyse globale — ${analyse.totalBulletins} bulletins`;
      const taux=analyse.total>0?Math.round(analyse.conformeTotal.length/analyse.total*100):0;
      const safe=(s)=>{
        const M={
          '’':"'",'‘':"'",'“':'"','”':'"',
          'é':'e','è':'e','ê':'e','ë':'e',
          'à':'a','â':'a','ä':'a',
          'î':'i','ï':'i','ô':'o','ù':'u',
          'û':'u','ü':'u','ç':'c','ñ':'n',
          'É':'E','È':'E','À':'A','Ç':'C',
          '→':'->','↗':'>>','↘':'<<','↑':'^','↓':'v',
          '•':'-','·':'.','—':'-','–':'-','≥':'>=','≤':'<='
        };
        return String(s||"")
          .replace(/[‘’“”éèêëàâäîïôùûüçñÉÈÀÇ→↗↘↑↓•·—–≥≤]/g,c=>M[c]||c)
          .replace(/[^\x00-\xFF]/g,"?");
      };

      if(format==="excel"){
        // ── EXCEL ─────────────────────────────────────────────────
        // Lookup hebdomadaire : weeklyData[pointId][semaine] = valeur UFC
        const weeklyData={};
        analyse.pointsStats.forEach(p=>{weeklyData[p.id]={};});
        (analyse.chartData||[]).forEach(row=>{
          const sem=row.semaine;if(!sem)return;
          Object.keys(row).forEach(k=>{
            if(k!=="semaine"&&weeklyData[k]!==undefined&&row[k]!==null&&row[k]!==undefined)
              weeklyData[k][sem]=row[k];
          });
        });
        const weeks=analyse.allWeeks||[];
        const fc=(id)=>String(id||"").charAt(0);
        const envGroups=[
          {key:"E1",label:"Environnement 1 - Seuil <10 UFC/cm2",seuil:10,hdrRgb:"FF1D6FA8",pts:analyse.pointsStats.filter(p=>fc(p.id)==="1")},
          {key:"E2",label:"Environnement 2 - Seuil <25 UFC/cm2",seuil:25,hdrRgb:"FF92D050",pts:analyse.pointsStats.filter(p=>fc(p.id)==="2")},
          {key:"E3",label:"Environnement 3 - Seuil <50 UFC/cm2",seuil:50,hdrRgb:"FF70AD47",pts:analyse.pointsStats.filter(p=>fc(p.id)==="3")},
          {key:"E4",label:"Environnement 4 - Seuil <100 UFC/cm2",seuil:100,hdrRgb:"FFED7D31",pts:analyse.pointsStats.filter(p=>fc(p.id)==="4")},
        ];
        const BD={
          top:{style:"thin",color:{rgb:"FFD1D5DB"}},left:{style:"thin",color:{rgb:"FFD1D5DB"}},
          bottom:{style:"thin",color:{rgb:"FFD1D5DB"}},right:{style:"thin",color:{rgb:"FFD1D5DB"}}
        };
        const mkH=(rgb)=>({fill:{patternType:"solid",fgColor:{rgb}},font:{bold:true,color:{rgb:"FFFFFFFF"},sz:9},border:BD,alignment:{horizontal:"center",vertical:"center",wrapText:true}});
        const mkC=(bg,fg,bold=false)=>({fill:{patternType:"solid",fgColor:{rgb:bg}},font:{bold,color:{rgb:fg},sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
        const cellClr=(val,seuil)=>{
          if(val===null||val===undefined)return{bg:"FFF3F4F6",fg:"FF9CA3AF"};
          if(val>=seuil)return{bg:"FFFFC7CE",fg:"FF9C0006"};
          if(val>=seuil*0.8)return{bg:"FFFFEB9C",fg:"FF9C5700"};
          return{bg:"FFC6EFCE",fg:"FF006100"};
        };
        const sc=(ws,r,c,v,t,s)=>{ws[XLSX.utils.encode_cell({r,c})]={v,t,s};};

        // Helper : feuille par environnement (points en lignes, semaines en colonnes)
        const buildEnvSheet=(wb,sheetName,label,pts,seuil,hdrRgb)=>{
          if(!pts||pts.length===0)return;
          const ws={};const merges=[];
          const totalCols=2+weeks.length+5;
          // Ligne 1 : titre fusionné couleur environnement
          ws[XLSX.utils.encode_cell({r:0,c:0})]={v:label,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:hdrRgb}},font:{bold:true,sz:13,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center",vertical:"center"}}};
          merges.push({s:{r:0,c:0},e:{r:0,c:totalCols-1}});
          // Ligne 2 : en-têtes (Point | Description | S01 | S02 | ... | Target | Moy | Statut | Tendance | Dep.)
          sc(ws,1,0,"Point","s",mkH("FF1E3A5F"));
          sc(ws,1,1,"Description","s",mkH("FF1E3A5F"));
          weeks.forEach((w,wi)=>sc(ws,1,wi+2,w,"s",mkH("FF1E3A5F")));
          const c0=weeks.length+2;
          sc(ws,1,c0,"Target UFC/cm2","s",mkH("FF9C0006"));
          sc(ws,1,c0+1,"Moy. UFC","s",mkH("FF1E3A5F"));
          sc(ws,1,c0+2,"Statut","s",mkH("FF1E3A5F"));
          sc(ws,1,c0+3,"Tendance","s",mkH("FF1E3A5F"));
          sc(ws,1,c0+4,"Depass.","s",mkH("FF1E3A5F"));
          // Données : une ligne par point
          pts.forEach((pt,ri)=>{
            const r=ri+2;
            const ptS=pt.seuil||seuil;
            sc(ws,r,0,pt.id,"s",{fill:{patternType:"solid",fgColor:{rgb:"FFFFFFFF"}},font:{bold:true,color:{rgb:"FF1E3A5F"},sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(ws,r,1,pt.description||"","s",{fill:{patternType:"solid",fgColor:{rgb:"FFFFFFFF"}},font:{sz:9},border:BD,alignment:{vertical:"middle"}});
            weeks.forEach((week,wi)=>{
              const val=weeklyData[pt.id]?.[week];
              const{bg,fg}=cellClr(val,ptS);
              sc(ws,r,wi+2,val!==undefined?val:"",val!==undefined?"n":"s",mkC(bg,fg,val!==undefined&&val>=ptS));
            });
            sc(ws,r,c0,ptS,"n",mkC("FFFFC7CE","FF9C0006",true));
            sc(ws,r,c0+1,pt.avg!==null&&pt.avg!==undefined?pt.avg:"",pt.avg!=null?"n":"s",{fill:{patternType:"solid",fgColor:{rgb:"FFF9FAFB"}},font:{sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            const stBg=pt.statut==="critique"?"FFFFC7CE":pt.statut==="surveillance"?"FFFFEB9C":"FFC6EFCE";
            const stFg=pt.statut==="critique"?"FF9C0006":pt.statut==="surveillance"?"FF9C5700":"FF006100";
            sc(ws,r,c0+2,pt.statut||"","s",mkC(stBg,stFg,true));
            const tdFg=pt.tendance==="hausse"?"FF9C0006":pt.tendance==="baisse"?"FF006100":"FF6B7280";
            sc(ws,r,c0+3,pt.tendance||"","s",{fill:{patternType:"solid",fgColor:{rgb:"FFF9FAFB"}},font:{bold:pt.tendance==="hausse",color:{rgb:tdFg},sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(ws,r,c0+4,pt.depassements||0,"n",{fill:{patternType:"solid",fgColor:{rgb:pt.depassements>0?"FFFFC7CE":"FFF9FAFB"}},font:{bold:pt.depassements>0,color:{rgb:pt.depassements>0?"FF9C0006":"FF374151"},sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
          });
          ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:pts.length+1,c:totalCols-1}});
          ws["!merges"]=merges;
          ws["!cols"]=[{wch:14},{wch:38},...weeks.map(()=>({wch:9})),{wch:14},{wch:10},{wch:13},{wch:12},{wch:8}];
          ws["!rows"]=[{hpt:28},{hpt:24},...pts.map(()=>({hpt:18}))];
          XLSX.utils.book_append_sheet(wb,ws,sheetName);
        };

        const wb=XLSX.utils.book_new();

        // ── Feuille 1 : Résumé ──────────────────────────────────
        const wR={};const rM=[];
        wR[XLSX.utils.encode_cell({r:0,c:0})]={v:"RAPPORT MICROBIOLOGIQUE - InnoFaso Qualite",t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF1E3A5F"}},font:{bold:true,sz:14,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center",vertical:"center"}}};
        rM.push({s:{r:0,c:0},e:{r:0,c:5}});
        wR[XLSX.utils.encode_cell({r:1,c:0})]={v:`InnoFaso SA - ${ref} - ${dateStr}`,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF2B4F84"}},font:{sz:10,italic:true,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center",vertical:"center"}}};
        rM.push({s:{r:1,c:0},e:{r:1,c:5}});
        wR[XLSX.utils.encode_cell({r:2,c:0})]={v:"INDICATEURS CLES",t:"s",s:mkH("FF1E3A5F")};
        rM.push({s:{r:2,c:0},e:{r:2,c:5}});
        const kpiRows=[
          ["Points analyses",analyse.total,"FFFFFFFF","FF1E3A5F"],
          ["Conformes",analyse.conformeTotal.length,"FFC6EFCE","FF006100"],
          ["En surveillance",analyse.aSurveiller.length,"FFFFEB9C","FF9C5700"],
          ["Critiques",analyse.critiques.length,"FFFFC7CE","FF9C0006"],
          ["Taux de conformite",`${taux}%`,"FFF0F9FF","FF1D6FA8"],
          ["Bulletins analyses",analyse.totalBulletins,"FFF9FAFB","FF374151"],
          ["Semaines de donnees",weeks.length,"FFF9FAFB","FF374151"],
          ["Variabilite moyenne",`+/-${analyse.avgVariabilite} UFC/cm2`,"FFF9FAFB","FF374151"],
        ];
        kpiRows.forEach(([lbl,val,bg,fg],i)=>{
          const r=3+i;
          wR[XLSX.utils.encode_cell({r,c:0})]={v:lbl,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{bold:true,sz:10},border:BD,alignment:{vertical:"middle"}}};
          wR[XLSX.utils.encode_cell({r,c:1})]={v:val,t:typeof val==="number"?"n":"s",s:{fill:{patternType:"solid",fgColor:{rgb:bg}},font:{bold:true,color:{rgb:fg},sz:12},border:BD,alignment:{horizontal:"center",vertical:"middle"}}};
          rM.push({s:{r,c:1},e:{r,c:5}});
        });
        let rR=3+kpiRows.length+1;
        if(synthèseIA&&!synthèseIA.unavailable){
          wR[XLSX.utils.encode_cell({r:rR,c:0})]={v:"ANALYSE ET OBSERVATIONS IA",t:"s",s:mkH("FF7C3AED")};
          rM.push({s:{r:rR,c:0},e:{r:rR,c:5}});rR++;
          if(synthèseIA.summary){
            wR[XLSX.utils.encode_cell({r:rR,c:0})]={v:synthèseIA.summary,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF5F3FF"}},font:{sz:10,italic:true},border:BD,alignment:{wrapText:true,vertical:"middle"}}};
            rM.push({s:{r:rR,c:0},e:{r:rR,c:5}});
            if(!wR["!rows"])wR["!rows"]=[];wR["!rows"][rR]={hpt:52};rR++;
          }
          (synthèseIA.insights||[]).forEach(ins=>{
            wR[XLSX.utils.encode_cell({r:rR,c:0})]={v:`- ${ins}`,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF5F3FF"}},font:{sz:9},border:BD,alignment:{wrapText:true,vertical:"middle"}}};
            rM.push({s:{r:rR,c:0},e:{r:rR,c:5}});rR++;
          });
          (synthèseIA.recommendations||[]).forEach(rec=>{
            wR[XLSX.utils.encode_cell({r:rR,c:0})]={v:`-> ${rec}`,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFFEF2F2"}},font:{sz:9,color:{rgb:"FF9C0006"}},border:BD,alignment:{wrapText:true,vertical:"middle"}}};
            rM.push({s:{r:rR,c:0},e:{r:rR,c:5}});rR++;
          });
        }
        wR["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rR,c:5}});
        wR["!merges"]=rM;
        wR["!cols"]=[{wch:30},{wch:22},{wch:15},{wch:15},{wch:15},{wch:15}];
        if(!wR["!rows"])wR["!rows"]=[];
        wR["!rows"][0]={hpt:32};wR["!rows"][1]={hpt:22};wR["!rows"][2]={hpt:22};
        XLSX.utils.book_append_sheet(wb,wR,"Resume");

        // ── Feuille 2 : EB Global (tous environnements) ─────────
        buildEnvSheet(wb,"EB Global","EB - Tous Environnements - Suivi UFC/cm2",
          [...analyse.pointsStats].sort((a,b)=>a.id.localeCompare(b.id)),50,"FF1E3A5F");

        // ── Feuilles 3-6 : E1 / E2 / E3 / E4 ───────────────────
        envGroups.forEach(e=>{if(e.pts.length>0)buildEnvSheet(wb,e.key,e.label,e.pts,e.seuil,e.hdrRgb);});

        // ── Feuille 7 : Candidats au retrait ────────────────────
        if(analyse.mgsEtendues&&analyse.mgsEtendues.length>0){
          const wC={};const cM=[];
          wC[XLSX.utils.encode_cell({r:0,c:0})]={v:`CANDIDATS AU RETRAIT DU PLAN DE CONTROLE (${analyse.mgsEtendues.length} points)`,t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF21803D"}},font:{bold:true,sz:12,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center",vertical:"center"}}};
          cM.push({s:{r:0,c:0},e:{r:0,c:6}});
          wC[XLSX.utils.encode_cell({r:1,c:0})]={v:"Points stables >= 5 semaines sans depassement - candidats a une revision du plan de surveillance",t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF0FDF4"}},font:{sz:9,italic:true,color:{rgb:"FF4B5563"}},border:BD,alignment:{horizontal:"center"}}};
          cM.push({s:{r:1,c:0},e:{r:1,c:6}});
          ["Point","Description","Sem. stables","Moy. UFC/cm2","Seuil","% moy. seuil","Variabilite"].forEach((h,ci)=>{
            wC[XLSX.utils.encode_cell({r:2,c:ci})]={v:h,t:"s",s:mkH("FF15803D")};
          });
          analyse.mgsEtendues.forEach((p,ri)=>{
            const r=ri+3;
            const gF={fill:{patternType:"solid",fgColor:{rgb:"FFF0FDF4"}},font:{sz:9,color:{rgb:"FF374151"}},border:BD,alignment:{vertical:"middle"}};
            sc(wC,r,0,p.id,"s",{fill:{patternType:"solid",fgColor:{rgb:"FFF0FDF4"}},font:{bold:true,sz:9,color:{rgb:"FF1E3A5F"}},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wC,r,1,p.description||"","s",gF);
            sc(wC,r,2,p.semStable||p.nbReleves||0,"n",{...gF,font:{bold:true,sz:9,color:{rgb:"FF006100"}},alignment:{horizontal:"center",vertical:"middle"}});
            sc(wC,r,3,p.avg!=null?p.avg:"","n",{...gF,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wC,r,4,p.seuil,"n",mkC("FFFFC7CE","FF9C0006",true));
            sc(wC,r,5,p.avgSeuil!=null?`${p.avgSeuil}%`:"","s",{...gF,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wC,r,6,p.variabilite!==undefined?`+/-${p.variabilite}`:"","s",{...gF,alignment:{horizontal:"center",vertical:"middle"}});
          });
          wC["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:analyse.mgsEtendues.length+2,c:6}});
          wC["!merges"]=cM;
          wC["!cols"]=[{wch:14},{wch:42},{wch:14},{wch:14},{wch:12},{wch:14},{wch:14}];
          wC["!rows"]=[{hpt:28},{hpt:22},{hpt:22},...analyse.mgsEtendues.map(()=>({hpt:18}))];
          XLSX.utils.book_append_sheet(wb,wC,"Candidats retrait");
        }

        // ── Feuille 8 : Observations IA ─────────────────────────
        if(observations.length>0){
          const wO={};const oM=[];
          wO[XLSX.utils.encode_cell({r:0,c:0})]={v:"OBSERVATIONS AUTOMATIQUES",t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF1E3A5F"}},font:{bold:true,sz:12,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center"}}};
          oM.push({s:{r:0,c:0},e:{r:0,c:3}});
          ["Niveau","Point","Observation","Justification"].forEach((h,ci)=>{
            wO[XLSX.utils.encode_cell({r:1,c:ci})]={v:h,t:"s",s:mkH("FF1E3A5F")};
          });
          observations.forEach((o,ri)=>{
            const r=ri+2;
            const bgN=o.niveau==="élevé"?"FFFFC7CE":o.niveau==="moyen"?"FFFFEB9C":"FFC6EFCE";
            const fgN=o.niveau==="élevé"?"FF9C0006":o.niveau==="moyen"?"FF9C5700":"FF006100";
            sc(wO,r,0,o.niveau||"","s",{fill:{patternType:"solid",fgColor:{rgb:bgN}},font:{bold:true,sz:9,color:{rgb:fgN}},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wO,r,1,o.point||"-","s",{fill:{patternType:"solid",fgColor:{rgb:"FFF9FAFB"}},font:{sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wO,r,2,o.texte||"","s",{fill:{patternType:"solid",fgColor:{rgb:"FFFFFFFF"}},font:{sz:9},border:BD,alignment:{wrapText:true,vertical:"middle"}});
            sc(wO,r,3,o.justification||"","s",{fill:{patternType:"solid",fgColor:{rgb:"FFFFFFFF"}},font:{sz:9,italic:true,color:{rgb:"FF6B7280"}},border:BD,alignment:{wrapText:true,vertical:"middle"}});
          });
          wO["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:observations.length+1,c:3}});
          wO["!merges"]=oM;
          wO["!cols"]=[{wch:12},{wch:14},{wch:80},{wch:55}];
          wO["!rows"]=[{hpt:28},{hpt:22},...observations.map(()=>({hpt:22}))];
          XLSX.utils.book_append_sheet(wb,wO,"Observations IA");
        }

        // ── Feuille Evolution ──────────────────────────────────────
        {
          const weeklyConf=(analyse.allWeeks||[]).map(sem=>{
            const row=(analyse.chartData||[]).find(r=>r.semaine===sem);
            if(!row)return{sem,total:0,conf:0,dep:0,avgEB:null,taux:null};
            let conf=0,tot=0,dep=0,sumEB=0,nbEB=0;
            analyse.pointsStats.forEach(p=>{
              const val=row[p.id];
              if(val!==null&&val!==undefined&&typeof val==="number"){
                tot++;sumEB+=val;nbEB++;
                if(val<(p.seuil||50))conf++;else dep++;
              }
            });
            return{sem,total:tot,conf,dep,avgEB:nbEB>0?Math.round(sumEB/nbEB*10)/10:null,taux:tot>0?Math.round(conf/tot*100):null};
          });
          const wEv={};const evM=[];
          // ── Titre ──
          wEv[XLSX.utils.encode_cell({r:0,c:0})]={v:safe("EVOLUTION DES INDICATEURS MICROBIOLOGIQUES"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF1E3A5F"}},font:{bold:true,sz:13,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center",vertical:"center"}}};
          evM.push({s:{r:0,c:0},e:{r:0,c:5}});
          wEv[XLSX.utils.encode_cell({r:1,c:0})]={v:safe(`${weeklyConf.length} semaine(s) analysee(s) - ${analyse.totalBulletins} bulletins importes`),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF2B4F84"}},font:{sz:9,italic:true,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center"}}};
          evM.push({s:{r:1,c:0},e:{r:1,c:5}});
          // ── En-têtes ──
          [safe("Semaine"),safe("Points analyses"),safe("Taux conformite"),safe("Depassements"),safe("Moy. EB UFC/cm2"),safe("Tendance")].forEach((h,ci)=>{
            wEv[XLSX.utils.encode_cell({r:2,c:ci})]={v:h,t:"s",s:mkH("FF1E3A5F")};
          });
          // ── Données ──
          weeklyConf.forEach((w,ri)=>{
            const r=ri+3;
            const prevTaux=ri>0?weeklyConf[ri-1].taux:null;
            const trend=prevTaux===null?"":w.taux!==null&&w.taux>prevTaux?"hausse":w.taux!==null&&w.taux<prevTaux?"baisse":"stable";
            const tBg=w.taux===null?"FFF9FAFB":w.taux>=90?"FFC6EFCE":w.taux>=70?"FFFFEB9C":"FFFFC7CE";
            const tFg=w.taux===null?"FF9CA3AF":w.taux>=90?"FF006100":w.taux>=70?"FF9C5700":"FF9C0006";
            sc(wEv,r,0,safe(w.sem||""),"s",{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{bold:true,sz:10,color:{rgb:"FF1E3A5F"}},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wEv,r,1,w.total,"n",mkC("FFF9FAFB","FF374151",false));
            sc(wEv,r,2,w.taux!==null?`${w.taux}%`:"N/D","s",mkC(tBg,tFg,true));
            sc(wEv,r,3,w.dep,"n",{fill:{patternType:"solid",fgColor:{rgb:w.dep>0?"FFFFC7CE":"FFF9FAFB"}},font:{bold:w.dep>0,color:{rgb:w.dep>0?"FF9C0006":"FF374151"},sz:9},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            sc(wEv,r,4,w.avgEB!==null?w.avgEB:"N/D",w.avgEB!==null?"n":"s",mkC("FFF9FAFB","FF374151",false));
            const trFg=trend==="hausse"?"FF9C0006":trend==="baisse"?"FF006100":"FF6B7280";
            const trBg=trend==="hausse"?"FFFFC7CE":trend==="baisse"?"FFC6EFCE":"FFF9FAFB";
            sc(wEv,r,5,trend?safe("-> "+trend):"—","s",mkC(trBg,trFg,false));
          });
          // ── Séparateur ──
          let evRow=3+weeklyConf.length+1;
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:"",t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFE5E7EB"}}}};
          evM.push({s:{r:evRow,c:0},e:{r:evRow,c:5}});evRow++;
          // ── Visualisation matrice couleurs ──
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:safe("VISUALISATION - Taux de conformite par semaine (%)"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF1E3A5F"}},font:{bold:true,sz:10,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center"}}};
          evM.push({s:{r:evRow,c:0},e:{r:evRow,c:5}});evRow++;
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:safe("Vert >=90% | Orange 70-89% | Rouge <70%"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{sz:8,italic:true,color:{rgb:"FF4B5563"}},alignment:{horizontal:"center"}}};
          evM.push({s:{r:evRow,c:0},e:{r:evRow,c:5}});evRow++;
          // En-tête semaines
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:"Indicateur",t:"s",s:mkH("FF1E3A5F")};
          weeklyConf.forEach((w,ci)=>{wEv[XLSX.utils.encode_cell({r:evRow,c:ci+1})]={v:safe(w.sem||""),t:"s",s:mkH("FF2B4F84")};});
          evRow++;
          // Ligne conformité
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:safe("Conformite %"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{bold:true,sz:9},border:BD,alignment:{vertical:"middle"}}};
          weeklyConf.forEach((w,ci)=>{
            const bg2=w.taux===null?"FFF9FAFB":w.taux>=90?"FFC6EFCE":w.taux>=70?"FFFFEB9C":"FFFFC7CE";
            const fg2=w.taux===null?"FF9CA3AF":w.taux>=90?"FF006100":w.taux>=70?"FF9C5700":"FF9C0006";
            sc(wEv,evRow,ci+1,w.taux!==null?`${w.taux}%`:"N/D","s",mkC(bg2,fg2,true));
          });
          evRow++;
          // Ligne dépassements
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:safe("Depassements"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{bold:true,sz:9},border:BD,alignment:{vertical:"middle"}}};
          weeklyConf.forEach((w,ci)=>{sc(wEv,evRow,ci+1,w.dep,"n",mkC(w.dep>0?"FFFFC7CE":"FFC6EFCE",w.dep>0?"FF9C0006":"FF006100",w.dep>0));});
          evRow++;
          // Ligne Moy EB
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:safe("Moy. EB UFC/cm2"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{bold:true,sz:9},border:BD,alignment:{vertical:"middle"}}};
          weeklyConf.forEach((w,ci)=>{sc(wEv,evRow,ci+1,w.avgEB!==null?w.avgEB:"N/D",w.avgEB!==null?"n":"s",mkC("FFF9FAFB","FF374151",false));});
          evRow++;
          // ── Tendances résumé ──
          evRow++;
          wEv[XLSX.utils.encode_cell({r:evRow,c:0})]={v:safe("RESUME DES TENDANCES"),t:"s",s:{fill:{patternType:"solid",fgColor:{rgb:"FF1E3A5F"}},font:{bold:true,sz:10,color:{rgb:"FFFFFFFF"}},alignment:{horizontal:"center"}}};
          evM.push({s:{r:evRow,c:0},e:{r:evRow,c:5}});evRow++;
          [
            [safe("Points en hausse"),analyse.pointsStats.filter(p=>p.tendance==="hausse").length,"FFFFC7CE","FF9C0006"],
            [safe("Points stables"),analyse.pointsStats.filter(p=>p.tendance==="stable").length,"FFF9FAFB","FF374151"],
            [safe("Points en baisse"),analyse.pointsStats.filter(p=>p.tendance==="baisse").length,"FFC6EFCE","FF006100"],
            [safe("Taux conformite global"),`${taux}%`,"FFF0F9FF","FF1D6FA8"],
          ].forEach(([lbl,val,bg,fg])=>{
            sc(wEv,evRow,0,lbl,"s",{fill:{patternType:"solid",fgColor:{rgb:"FFF3F4F6"}},font:{bold:true,sz:10},border:BD,alignment:{vertical:"middle"}});
            sc(wEv,evRow,1,val,typeof val==="number"?"n":"s",{fill:{patternType:"solid",fgColor:{rgb:bg}},font:{bold:true,color:{rgb:fg},sz:12},border:BD,alignment:{horizontal:"center",vertical:"middle"}});
            evM.push({s:{r:evRow,c:1},e:{r:evRow,c:5}});evRow++;
          });
          const evCols=Math.max(6,weeklyConf.length+1);
          wEv["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:evRow,c:evCols-1}});
          wEv["!merges"]=evM;
          wEv["!cols"]=[{wch:22},...Array(evCols-1).fill({wch:14})];
          wEv["!rows"]=[{hpt:30},{hpt:20},{hpt:24},...weeklyConf.map(()=>({hpt:20}))];
          XLSX.utils.book_append_sheet(wb,wEv,"Evolution");
        }

        const buf=XLSX.write(wb,{bookType:"xlsx",type:"array",cellStyles:true});
        const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;a.download=`rapport-ia-innofaso-${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();URL.revokeObjectURL(url);

      }else{
        // ── PDF 4 pages ───────────────────────────────────────────
        const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
        const W=doc.internal.pageSize.getWidth();
        const H=doc.internal.pageSize.getHeight();
        const ML=14,MR=14,CW=W-ML-MR;
        let y=0;
        const PB=14;
        // ── HELPERS ───────────────────────────────────────────────
        const addHdr=()=>{
          doc.setFillColor(92,88,82);doc.rect(0,0,W,22,"F");
          doc.setFillColor(140,198,63);doc.rect(0,20,W,2.5,"F");
          doc.setTextColor(255,255,255);
          doc.setFontSize(13.5);doc.setFont("helvetica","bold");
          doc.text("RAPPORT MICROBIOLOGIQUE - InnoFaso",ML,10);
          doc.setFontSize(7);doc.setFont("helvetica","normal");
          doc.text("InnoFaso SA  |  Ouagadougou, Burkina Faso",ML,16);
          doc.setFontSize(10);doc.setFont("helvetica","normal");doc.setTextColor(200,200,200);
          const _fw=doc.getTextWidth("faso");
          doc.setFont("helvetica","bold");doc.setTextColor(140,198,63);
          doc.text("INN",W-MR-_fw,9,{align:"right"});
          doc.setFont("helvetica","normal");doc.setTextColor(200,200,200);
          doc.text("faso",W-MR,9,{align:"right"});
          doc.setTextColor(0,0,0);
        };
        const chk2=(need=20)=>{if(y+need>H-PB){doc.addPage();addHdr();y=28;}};
        const sec2=(num,title)=>{
          chk2(14);
          doc.setFillColor(92,88,82);doc.ellipse(ML+4,y+3.5,3.5,3.5,"F");
          doc.setTextColor(255,255,255);doc.setFontSize(7.5);doc.setFont("helvetica","bold");
          doc.text(String(num),ML+4,y+4.5,{align:"center"});
          doc.setTextColor(35,35,35);doc.setFontSize(10.5);doc.setFont("helvetica","bold");
          doc.text(safe(title),ML+11,y+5.5);
          doc.setDrawColor(140,198,63);doc.setLineWidth(0.6);doc.line(ML+11,y+7.5,ML+CW,y+7.5);
          doc.setTextColor(0,0,0);
          y+=13;
        };
        const drawSector=(cx,cy,r,innerR,startDeg,endDeg,clr)=>{
          const STEPS=Math.max(24,Math.ceil(Math.abs(endDeg-startDeg)/3));
          const s=(startDeg-90)*Math.PI/180,e2=(endDeg-90)*Math.PI/180;
          const pts=[];
          for(let i=0;i<=STEPS;i++){const a=s+(e2-s)*i/STEPS;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
          for(let i=STEPS;i>=0;i--){const a=s+(e2-s)*i/STEPS;pts.push([cx+innerR*Math.cos(a),cy+innerR*Math.sin(a)]);}
          const[x0,y0]=pts[0];
          const segs=[];
          for(let i=1;i<pts.length;i++)segs.push([pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]]);
          segs.push([x0-pts[pts.length-1][0],y0-pts[pts.length-1][1]]);
          doc.setFillColor(...clr);doc.setDrawColor(255,255,255);doc.setLineWidth(0.5);
          doc.lines(segs,x0,y0,[1,1],"FD",true);
        };
        // ── DATA PREP ─────────────────────────────────────────────
        const pdfTaux=analyse.total>0?Math.round(analyse.conformeTotal.length/analyse.total*100):0;
        const periodeArr=analyse.allWeeks||[];
        const periodeStr=periodeArr.length>=2?`${periodeArr[0]} au ${periodeArr[periodeArr.length-1]}`:periodeArr.length===1?periodeArr[0]:"";
        const fc2=(id)=>String(id||"").charAt(0);
        const half2=Math.max(1,Math.floor(periodeArr.length/2));
        const w1s2=new Set(periodeArr.slice(0,half2));
        const w2s2=new Set(periodeArr.slice(half2));
        const totDepsAllRaw=analyse.pointsStats.reduce((a,p)=>a+(p.depassements||0),0);
        const totDepsAll=Math.max(1,totDepsAllRaw);
        const wkConf=periodeArr.map(sem=>{
          const row=(analyse.chartData||[]).find(r=>r.semaine===sem);
          if(!row)return{sem,taux:null};
          let c=0,t=0;
          analyse.pointsStats.forEach(p=>{const v=row[p.id];if(v!==null&&v!==undefined&&typeof v==="number"){t++;if(v<(p.seuil||50))c++;}});
          return{sem,taux:t>0?Math.round(c/t*100):null};
        });
        const wkConf2=wkConf.filter(w=>w.taux!==null);
        let c1a=0,t1a=0,c2a=0,t2a=0;
        analyse.pointsStats.forEach(p=>{(analyse.chartData||[]).forEach(row=>{const v=row[p.id];if(v===null||v===undefined||typeof v!=="number")return;if(w1s2.has(row.semaine)){t1a++;if(v<(p.seuil||50))c1a++;}else if(w2s2.has(row.semaine)){t2a++;if(v<(p.seuil||50))c2a++;}});});
        const tx1a=t1a>0?Math.round(c1a/t1a*100):pdfTaux,tx2a=t2a>0?Math.round(c2a/t2a*100):pdfTaux;
        const globalEvol=tx2a-tx1a;
        const envDefs2=[
          {k:"E1",l:"Matieres premieres",d:"1",clr:[29,111,168]},
          {k:"E2",l:"Production",d:"2",clr:[21,128,61]},
          {k:"E3",l:"Conditionnement",d:"3",clr:[112,173,71]},
          {k:"E4",l:"Stockage",d:"4",clr:[237,125,49]},
        ];
        const envRows2=envDefs2.map(e=>{
          const pts=analyse.pointsStats.filter(p=>fc2(p.id)===e.d);
          if(!pts.length)return null;
          const conf=pts.filter(p=>p.statut==="conforme").length;
          const tx=Math.round(conf/pts.length*100);
          let c1=0,t1=0,c2=0,t2=0;
          pts.forEach(p=>{(analyse.chartData||[]).forEach(row=>{const v=row[p.id];if(v===null||v===undefined||typeof v!=="number")return;if(w1s2.has(row.semaine)){t1++;if(v<(p.seuil||50))c1++;}else if(w2s2.has(row.semaine)){t2++;if(v<(p.seuil||50))c2++;}});});
          const tx1=t1>0?Math.round(c1/t1*100):null,tx2=t2>0?Math.round(c2/t2*100):null;
          const evol=(tx1!==null&&tx2!==null)?tx2-tx1:null;
          const crit=pts.filter(p=>p.statut==="critique").length,surv=pts.filter(p=>p.statut==="surveillance").length;
          let comment="Bonne maitrise";
          if(crit>0)comment=`${crit} point(s) critique(s)`;
          else if(surv>0)comment="A surveiller";
          else if(tx>=98)comment="Excellente maitrise";
          else if(tx>=95)comment="Tres bonne maitrise";
          return{k:e.k,l:e.l,clr:e.clr,n:pts.length,conf,tx,evol,comment};
        }).filter(Boolean);
        const tops5=[...analyse.pointsStats].filter(p=>p.depassements>0).sort((a,b)=>b.depassements-a.depassements).slice(0,5);
        const top4pct=tops5.slice(0,4).reduce((a,p)=>a+(p.depassements||0),0);
        const top4pctOfAll=Math.round(top4pct/totDepsAll*100);
        const SEUIL_PDF={"1":10,"2":25,"3":50,"4":100};
        const envClrsPDF={"1":[220,38,38],"2":[234,88,12],"3":[22,163,74],"4":[37,99,235]};
        const envLblsPDF={"1":"E1 - Contact produit (seuil 10)","2":"E2 - Proximite (seuil 25)","3":"E3 - Support/Sol (seuil 50)","4":"E4 - Zone periph. (seuil 100)"};
        const depsRws2=["1","2","3","4"].map(t=>{
          const seuil=SEUIL_PDF[t];
          const pts=analyse.pointsStats.filter(p=>String(p.id||"").charAt(0)===t);
          const deps=pts.reduce((a,p)=>a+(p.vNN||[]).filter(v=>v>=seuil).length,0);
          return{label:safe(envLblsPDF[t]),clr:envClrsPDF[t],deps,seuil:seuil,type:t};
        }).filter(g=>g.deps>0);
        const totDG2=depsRws2.reduce((a,g)=>a+g.deps,0)||1;
        depsRws2.forEach(g=>{g.pct=Math.round(g.deps/totDG2*100);});
        const tlEv3=periodeArr.map((sem,i)=>{
          const row=(analyse.chartData||[]).find(r=>r.semaine===sem);
          let deps=0;const dPts=[];
          analyse.pointsStats.forEach(p=>{const v=row?.[p.id];if(v!==null&&v!==undefined&&typeof v==="number"&&v>=(p.seuil||50)){deps++;dPts.push(p.id);}});
          return{sem,deps,dPts,i};
        });
        const keyEvs2=[];
        tlEv3.forEach((w,i)=>{
          const prev=i>0?tlEv3[i-1]:null;
          const isLast=i===tlEv3.length-1;
          const isPeak=w.deps>=3,isFirst=prev&&prev.deps===0&&w.deps>0,isRecov=prev&&prev.deps>0&&w.deps===0;
          if((isPeak||isFirst||isRecov||isLast||(w.deps===0&&i===0))&&keyEvs2.length<7){
            let label="",detail="";
            if(w.deps===0){label="Periode stable";detail="Aucun depassement";}
            else if(isPeak){label="Pic de contamination";detail=`${w.deps} dep. - ${safe(w.dPts.slice(0,2).join(", "))}`;}
            else if(isFirst){label="Premiers depassements";detail=safe(w.dPts.slice(0,2).join(", ")||`${w.deps} pt(s)`);}
            else if(isRecov){label="Retour a la normale";detail="Amelioration progressive";}
            else{label=isLast?"Periode actuelle":`${w.deps} dep.`;detail=isLast?"Maitrise en cours":safe(w.dPts.slice(0,2).join(", "));}
            keyEvs2.push({sem:safe(w.sem||""),label,detail});
          }
        });
        const toShowPdf=[
          ...analyse.pointsStats.filter(p=>p.statut==="critique"),
          ...analyse.pointsStats.filter(p=>p.statut==="surveillance"),
          ...analyse.pointsStats.filter(p=>p.statut==="conforme").sort((a,b)=>(b.depassements||0)-(a.depassements||0)),
        ].filter((p,i,arr)=>arr.indexOf(p)===i).slice(0,5);
        const chartData3=analyse.chartData||[];
        const allMeas=[];
        analyse.pointsStats.forEach(p=>(p.vNN||[]).forEach(v=>allMeas.push(v)));
        const meanMeas=allMeas.length>0?allMeas.reduce((a,b)=>a+b,0)/allMeas.length:0;
        const madVal=allMeas.length>0?(allMeas.reduce((a,v)=>a+Math.abs(v-meanMeas),0)/allMeas.length).toFixed(1):"N/A";
        const cleanSynth=(s)=>safe(s||"").replace(/:\s*(,\s*)+/g,": ").replace(/,\s*,/g,"").replace(/:\s*\./g,".").replace(/\s{2,}/g," ").trim();
        // ── PAGE 1 ────────────────────────────────────────────────
        addHdr();y=27;
        doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(90,85,80);
        doc.text(safe(`Periode analysee : ${periodeStr}  (${periodeArr.length} semaine${periodeArr.length!==1?"s":""})`),ML,y);
        doc.text(safe(`Bulletins : ${analyse.totalBulletins}  |  Genere le : ${dateStr}`),W-MR,y,{align:"right"});
        doc.setDrawColor(200,195,188);doc.setLineWidth(0.3);doc.line(ML,y+2.5,W-MR,y+2.5);
        doc.setTextColor(0,0,0);y+=9;
        sec2(1,"Resume executif");
        const hasCrit2=analyse.critiques.length>0;
        const sumTxt=hasCrit2
          ?safe(`Cette analyse couvre ${periodeArr.length} semaine${periodeArr.length!==1?"s":""} de surveillance microbiologique. Sur ${analyse.total} points suivis, la conformite globale atteint ${pdfTaux}%. ${analyse.critiques.length} point(s) critique(s) necessitent une action corrective immediate.`)
          :safe(`Cette analyse couvre ${periodeArr.length} semaine${periodeArr.length!==1?"s":""} de surveillance microbiologique. Sur ${analyse.total} points suivis, la conformite globale est de ${pdfTaux}%. ${totDepsAllRaw>0&&tops5.length>0?`${tops5.length} point(s) ont presente des depassements.`:"Aucun depassement detecte."} La maitrise microbiologique est${pdfTaux>=90?" globalement satisfaisante.":" a ameliorer."}`);
        doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(55,55,55);
        const sumL=doc.splitTextToSize(sumTxt,CW);doc.text(sumL,ML,y);y+=sumL.length*5+7;
        chk2(28);
        const kpiDefs=[
          {lbl:"Conformite globale",val:`${pdfTaux}%`,sub:globalEvol>=0?`+${globalEvol}% vs periode prec.`:`${globalEvol}% vs periode prec.`,vc:pdfTaux>=90?[21,128,61]:pdfTaux>=75?[194,65,12]:[220,38,38]},
          {lbl:"Points suivis",val:String(analyse.total),sub:`${envRows2.length} environnements`,vc:[30,58,95]},
          {lbl:"Depassements",val:String(totDepsAllRaw),sub:"sur toute la periode",vc:totDepsAllRaw>0?[220,38,38]:[21,128,61]},
          {lbl:"Points problematiques",val:String(tops5.length),sub:`${top4pctOfAll}% des depassements`,vc:tops5.length>2?[194,65,12]:tops5.length>0?[220,38,38]:[21,128,61]},
          {lbl:"Variabilite moy.",val:`+/-${madVal}`,sub:"UFC/cm2",vc:[80,90,100]},
        ];
        const kgap=2,kw=(CW-(kpiDefs.length-1)*kgap)/kpiDefs.length;
        kpiDefs.forEach((k,i)=>{
          const kx=ML+i*(kw+kgap);
          doc.setFillColor(250,250,252);doc.setDrawColor(220,215,210);doc.setLineWidth(0.35);
          doc.roundedRect(kx,y,kw,24,1.5,1.5,"FD");
          doc.setFillColor(...k.vc);doc.roundedRect(kx,y,kw,3.5,1.5,1.5,"F");doc.rect(kx,y+2,kw,1.5,"F");
          doc.setFontSize(5.5);doc.setFont("helvetica","bold");doc.setTextColor(120,115,110);
          doc.text(safe(k.lbl.toUpperCase()),kx+kw/2,y+8,{align:"center"});
          doc.setFontSize(13);doc.setFont("helvetica","bold");doc.setTextColor(...k.vc);
          doc.text(safe(k.val),kx+kw/2,y+17,{align:"center"});
          doc.setFontSize(5.5);doc.setFont("helvetica","normal");doc.setTextColor(130,125,120);
          const subL2=doc.splitTextToSize(safe(k.sub),kw-2);doc.text(subL2,kx+kw/2,y+21.5,{align:"center"});
        });
        doc.setTextColor(0,0,0);y+=29;
        sec2(2,"Evolution de la conformite globale");
        if(wkConf2.length>=2){
          const CH2=62,pL2=18,pR2=14,pT2=4,pB2=12;
          const cX2=ML+pL2,cY2=y+pT2,cW2=CW-pL2-pR2,cH2=CH2-pT2-pB2;
          const minT2=Math.max(40,Math.min(...wkConf2.map(w=>w.taux))-10);
          chk2(CH2+6);
          doc.setFillColor(250,250,252);doc.setDrawColor(229,231,235);doc.setLineWidth(0.2);
          doc.roundedRect(ML,y,CW,CH2,2,2,"FD");
          for(let gi=0;gi<=4;gi++){
            const gy=cY2+cH2/4*gi;
            doc.setDrawColor(229,231,235);doc.setLineWidth(0.12);doc.line(cX2,gy,cX2+cW2,gy);
            const yv=100-(100-minT2)/4*gi;
            doc.setFontSize(5.5);doc.setFont("helvetica","normal");doc.setTextColor(156,163,175);
            doc.text(`${Math.round(yv)}%`,cX2-2,gy+1.5,{align:"right"});
          }
          const sY2b=cY2+cH2-(90-minT2)/(100-minT2)*cH2;
          doc.setDrawColor(220,38,38);doc.setLineWidth(0.4);
          for(let dx=cX2;dx<cX2+cW2;dx+=4)doc.line(dx,sY2b,Math.min(dx+2.5,cX2+cW2),sY2b);
          doc.setFontSize(5.5);doc.setFont("helvetica","italic");doc.setTextColor(220,38,38);
          doc.text("Seuil: 90%",cX2+cW2+2,sY2b+1.5);
          doc.setDrawColor(200,200,200);doc.setLineWidth(0.3);
          doc.line(cX2,cY2,cX2,cY2+cH2);doc.line(cX2,cY2+cH2,cX2+cW2,cY2+cH2);
          const stepX2=Math.max(1,Math.ceil(wkConf2.length/9));
          wkConf2.forEach((w,i)=>{
            if(i%stepX2===0||i===wkConf2.length-1){
              const px=cX2+(wkConf2.length>1?i/(wkConf2.length-1):0)*cW2;
              doc.setFontSize(4.8);doc.setTextColor(156,163,175);
              doc.text(safe(String(w.sem||"").slice(0,7)),px,cY2+cH2+4,{align:"center"});
            }
          });
          doc.setDrawColor(140,198,63);doc.setLineWidth(1.2);
          let ppx2=null,ppy2=null;
          wkConf2.forEach((w,i)=>{
            if(w.taux===null){ppx2=null;ppy2=null;return;}
            const px=cX2+(wkConf2.length>1?i/(wkConf2.length-1):0)*cW2;
            const py=cY2+cH2-(w.taux-minT2)/(100-minT2)*cH2;
            if(ppx2!==null)doc.line(ppx2,ppy2,px,py);
            doc.setFillColor(140,198,63);doc.ellipse(px,py,1,1,"F");
            ppx2=px;ppy2=py;
          });
          doc.setFillColor(140,198,63);doc.rect(ML+4,y+CH2-8,10,2.5,"F");
          doc.setFontSize(6);doc.setFont("helvetica","normal");doc.setTextColor(80,80,80);
          doc.text("Taux de conformite global (%)",ML+16,y+CH2-6.5);
          doc.setDrawColor(220,38,38);doc.setLineWidth(0.5);
          doc.line(ML+CW-44,y+CH2-6.5,ML+CW-34,y+CH2-6.5);
          doc.setFontSize(6);doc.setTextColor(220,38,38);doc.text("Seuil cible 90%",ML+CW-32,y+CH2-6.5);
          y+=CH2+6;
          doc.setFontSize(6.5);doc.setFont("helvetica","italic");doc.setTextColor(100,100,100);
          const _cn2=safe("Lecture : La courbe verte montre le % de points conformes chaque semaine. La ligne rouge en pointilles = seuil cible 90%. Si la courbe descend sous cette ligne, cela signifie que trop de points ont depasse leur seuil cette semaine-la et une action corrective est necessaire.");
          const _cnL2=doc.splitTextToSize(_cn2,CW);doc.text(_cnL2,ML,y);y+=_cnL2.length*4+4;
        }else{
          doc.setFontSize(8);doc.setTextColor(130,130,130);
          doc.text("(Minimum 2 bulletins requis pour afficher le graphique)",ML,y);y+=12;
        }
        // ── PAGE 2 ────────────────────────────────────────────────
        doc.addPage();addHdr();y=28;
        sec2(4,"Evolution des points selectionnes (% du seuil)");
        if(toShowPdf.length>0&&chartData3.length>=2){
          const CH3=85,pL3=22,pR3=22,pT3=12,pB3=20;
          const cX3=ML+pL3,cW3=CW-pL3-pR3,cH3=CH3-pT3-pB3;
          const allNorm=chartData3.flatMap(row=>toShowPdf.map(p=>{const v=row[p.id];return(v!==null&&v!==undefined&&typeof v==="number")?(v/(p.seuil||50))*100:0;}));
          const yMax3=Math.min(200,Math.ceil(Math.max(150,...allNorm.filter(v=>v>0))/25)*25);
          chk2(CH3+12);
          doc.setFontSize(6.5);doc.setFont("helvetica","italic");doc.setTextColor(100,100,100);
          const _cn4=safe("Lecture : Chaque courbe = un point de prelevement. On divise la valeur mesuree (UFC/cm2) par le seuil autorise du point, puis on multiplie par 100. Resultat : 0-80% = sain (vert), 80-100% = vigilance (orange), au-dessus de 100% = seuil depasse (rouge, risque).");
          const _cnL4=doc.splitTextToSize(_cn4,CW);doc.text(_cnL4,ML,y);y+=_cnL4.length*4+3;
          const cY3=y+pT3-10;
          doc.setFillColor(250,250,252);doc.setDrawColor(229,231,235);doc.setLineWidth(0.2);
          doc.roundedRect(ML,y,CW,CH3,2,2,"FD");
          for(let gi=0;gi<=4;gi++){
            const gy=cY3+cH3/4*gi;
            doc.setDrawColor(229,231,235);doc.setLineWidth(0.12);doc.line(cX3,gy,cX3+cW3,gy);
            const yv=yMax3-yMax3/4*gi;
            doc.setFontSize(5.5);doc.setFont("helvetica","normal");doc.setTextColor(156,163,175);
            doc.text(`${Math.round(yv)}%`,cX3-2,gy+1.5,{align:"right"});
          }
          const sY3=cY3+cH3-(100/yMax3)*cH3;
          doc.setDrawColor(220,38,38);doc.setLineWidth(0.6);
          for(let dx=cX3;dx<cX3+cW3;dx+=4)doc.line(dx,sY3,Math.min(dx+2.5,cX3+cW3),sY3);
          doc.setFontSize(5.5);doc.setFont("helvetica","italic");doc.setTextColor(220,38,38);
          doc.text("Seuil : 100%",cX3+cW3+2,sY3+1.5);
          doc.setDrawColor(200,200,200);doc.setLineWidth(0.3);
          doc.line(cX3,cY3,cX3,cY3+cH3);doc.line(cX3,cY3+cH3,cX3+cW3,cY3+cH3);
          const stepX3=Math.max(1,Math.ceil(chartData3.length/9));
          chartData3.forEach((row,i)=>{
            if(i%stepX3===0||i===chartData3.length-1){
              const px=cX3+(chartData3.length>1?i/(chartData3.length-1):0)*cW3;
              doc.setFontSize(4.8);doc.setTextColor(156,163,175);
              doc.text(safe(String(row.semaine||"").slice(0,7)),px,cY3+cH3+4,{align:"center"});
            }
          });
          const CC3=[[37,99,235],[220,38,38],[21,128,61],[124,58,237],[194,65,12]];
          toShowPdf.forEach((pt,pi)=>{
            const[cr,cg,cb]=CC3[pi%CC3.length];
            doc.setDrawColor(cr,cg,cb);doc.setLineWidth(pi===0?1.2:0.8);
            let ppx3=null,ppy3=null;
            chartData3.forEach((row,i)=>{
              const val=row[pt.id];
              if(val===null||val===undefined||typeof val!=="number"){ppx3=null;ppy3=null;return;}
              const norm=(val/(pt.seuil||50))*100;
              const px=cX3+(chartData3.length>1?i/(chartData3.length-1):0)*cW3;
              const py=cY3+cH3-(Math.min(norm,yMax3)/yMax3)*cH3;
              if(ppx3!==null)doc.line(ppx3,ppy3,px,py);
              doc.setFillColor(cr,cg,cb);doc.ellipse(px,py,pi===0?1.1:0.8,pi===0?1.1:0.8,"F");
              ppx3=px;ppy3=py;
            });
          });
          const lY3=y+CH3-pB3+2;
          const lIW2=Math.min(35,CW/Math.max(toShowPdf.length,1));
          toShowPdf.forEach((pt,pi)=>{
            const[cr,cg,cb]=CC3[pi%CC3.length];const lx=ML+pi*lIW2;
            doc.setFillColor(cr,cg,cb);doc.rect(lx,lY3-2.5,9,2.5,"F");
            doc.setFontSize(6);doc.setTextColor(55,65,81);doc.setFont("helvetica","bold");
            doc.text(safe(pt.id),lx+11,lY3-0.5);
          });
          doc.setFontSize(5.5);doc.setFont("helvetica","normal");doc.setTextColor(100,100,100);
          const gY3=lY3+5;
          doc.setFillColor(22,163,74);doc.rect(ML,gY3-2,5,2.5,"F");doc.text("< 80% : Sain",ML+7,gY3-0.5);
          doc.setFillColor(234,88,12);doc.rect(ML+50,gY3-2,5,2.5,"F");doc.text("80-100% : Vigilance",ML+57,gY3-0.5);
          doc.setFillColor(220,38,38);doc.rect(ML+110,gY3-2,5,2.5,"F");doc.text("> 100% : Depassement",ML+117,gY3-0.5);
          y+=CH3+12;
        }else{
          doc.setFontSize(8);doc.setTextColor(130,130,130);
          doc.text("(Donnees insuffisantes pour ce graphique)",ML,y);y+=12;
        }
        if(tops5.length>0){
          chk2(30);
          sec2(5,"Points a surveiller - depassements detectes");
          autoTable(doc,{
            startY:y,
            head:[["Rang","Point","Description","Dep.","% total","Barre"]],
            body:tops5.map((p,i)=>[
              String(i+1),safe(p.id),
              safe((p.description||"").slice(0,38)),
              String(p.depassements),
              `${Math.round((p.depassements||0)/totDepsAll*100)}%`,
              "",
            ]),
            styles:{fontSize:8.5,cellPadding:2.5,valign:"middle"},
            headStyles:{fillColor:[30,58,95],textColor:255,fontStyle:"bold",fontSize:8},
            columnStyles:{
              0:{cellWidth:11,halign:"center",fontStyle:"bold",textColor:[140,198,63]},
              1:{cellWidth:19,halign:"center",fontStyle:"bold",textColor:[30,58,95]},
              2:{cellWidth:72},
              3:{cellWidth:16,halign:"center",fontStyle:"bold",textColor:[220,38,38]},
              4:{cellWidth:18,halign:"center"},
              5:{cellWidth:CW-136,halign:"left"},
            },
            alternateRowStyles:{fillColor:[248,250,252]},
            didParseCell:(d)=>{if(d.section==="body"&&d.column.index===5)d.cell.text=[""];},
            didDrawCell:(d)=>{
              if(d.section==="body"&&d.column.index===5){
                const pctVal=tops5[d.row.index]?Math.round((tops5[d.row.index].depassements||0)/totDepsAll*100):0;
                const bMax=d.cell.width-4;
                const bW=bMax*pctVal/Math.max(100,pctVal);
                const bClr=pctVal>=30?[220,38,38]:pctVal>=15?[234,88,12]:[251,191,36];
                doc.setFillColor(235,235,240);doc.rect(d.cell.x+2,d.cell.y+d.cell.height/2-2,bMax,4,"F");
                doc.setFillColor(...bClr);doc.rect(d.cell.x+2,d.cell.y+d.cell.height/2-2,bW,4,"F");
              }
            },
            margin:{left:ML,right:MR},
          });
          y=doc.lastAutoTable.finalY+5;
          chk2(8);
          doc.setFontSize(7.5);doc.setFont("helvetica","italic");doc.setTextColor(70,70,70);
          const topNote=tops5.length>=2
            ?safe(`Ces ${tops5.length} points concentrent ${top4pctOfAll}% des depassements totaux.`)
            :safe("Aucun autre point critique detecte — 1 seul point a eu un depassement sur l'ensemble de la periode.");
          const topNL=doc.splitTextToSize(topNote,CW);doc.text(topNL,ML,y);y+=topNL.length*4.5+6;
        }
        {
          const nbConf2=analyse.pointsStats.filter(p=>p.statut==="conforme").length;
          const nbSurv2=analyse.pointsStats.filter(p=>p.statut==="surveillance").length;
          const nbCrit2=analyse.pointsStats.filter(p=>p.statut==="critique").length;
          const nbTot2=Math.max(1,analyse.pointsStats.length);
          const camSegs=[
            {l:"Conforme",n:nbConf2,pct:Math.round(nbConf2/nbTot2*100),c:[21,128,61]},
            {l:"Surveillance",n:nbSurv2,pct:Math.round(nbSurv2/nbTot2*100),c:[234,88,12]},
            {l:"Critique",n:nbCrit2,pct:Math.round(nbCrit2/nbTot2*100),c:[220,38,38]},
          ].filter(s=>s.n>0);
          if(camSegs.length>0){
            chk2(50);
            doc.setFontSize(9.5);doc.setFont("helvetica","bold");doc.setTextColor(50,50,50);
            doc.text(safe("Repartition globale des statuts"),ML,y);
            doc.setDrawColor(140,198,63);doc.setLineWidth(0.5);doc.line(ML,y+2,W-MR,y+2);
            y+=9;
            const cpX=ML+20,cpY=y+15,cpR=15;
            let cSt=0;
            camSegs.forEach(s=>{const cE=cSt+s.pct*3.6;drawSector(cpX,cpY,cpR,0,cSt,cE,s.c);cSt=cE;});
            camSegs.forEach((s,i)=>{
              const ly2=y+5+i*10;
              doc.setFillColor(...s.c);doc.roundedRect(ML+42,ly2-3,6,6,1,1,"F");
              doc.setFontSize(9.5);doc.setFont("helvetica","bold");doc.setTextColor(...s.c);
              doc.text(`${s.pct}%`,ML+52,ly2+1);
              doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(55,55,55);
              doc.text(safe(`${s.l} — ${s.n} point${s.n>1?"s":""}`),ML+66,ly2+1);
            });
            doc.setFontSize(6.5);doc.setFont("helvetica","italic");doc.setTextColor(110,110,110);
            doc.text(safe("Lecture : Ce graphique montre la proportion de points conformes, en vigilance ou critiques sur toute la periode."),ML,y+36);
            y+=42;
          }
        }
        // ── PAGE 3 ────────────────────────────────────────────────
        doc.addPage();addHdr();y=28;
        sec2(3,"Conformite par environnement");
        if(envRows2.length>0){
          autoTable(doc,{
            startY:y,
            head:[["Environnement","Points","Conf.","Evolution","Commentaires"]],
            body:envRows2.map(e=>[
              safe(`${e.k} - ${e.l}`),`${e.conf}/${e.n}`,`${e.tx}%`,
              e.evol===null?"--":e.evol>0?`^ +${e.evol}%`:e.evol<0?`v ${e.evol}%`:"-> 0%",
              safe(e.comment),
            ]),
            styles:{fontSize:8.5,cellPadding:3,valign:"middle"},
            headStyles:{fillColor:[92,88,82],textColor:255,fontStyle:"bold",fontSize:8},
            columnStyles:{
              0:{cellWidth:72,fontStyle:"bold"},
              1:{cellWidth:22,halign:"center"},
              2:{cellWidth:22,halign:"center",fontStyle:"bold"},
              3:{cellWidth:26,halign:"center",fontStyle:"bold"},
              4:{cellWidth:CW-142},
            },
            alternateRowStyles:{fillColor:[248,250,252]},
            didParseCell:(d)=>{
              if(d.section==="body"&&d.column.index===2){
                const v=parseInt(d.cell.raw)||0;
                d.cell.styles.textColor=v>=95?[21,128,61]:v>=85?[194,65,12]:[220,38,38];
              }
              if(d.section==="body"&&d.column.index===3){
                const raw=String(d.cell.raw||"");
                if(raw.startsWith("^"))d.cell.styles.textColor=[21,128,61];
                else if(raw.startsWith("v"))d.cell.styles.textColor=[220,38,38];
              }
            },
            margin:{left:ML,right:MR},
          });
          y=doc.lastAutoTable.finalY+8;
        }
        chk2(52);
        sec2(6,"Repartition des depassements par environnement et seuil");
        if(depsRws2.length>0){
          const pieX=ML+25,pieY=y+22,pieR=20,pieInR=8;
          let startDeg=0;
          depsRws2.forEach(g=>{
            const endDeg=startDeg+g.pct*3.6;
            drawSector(pieX,pieY,pieR,pieInR,startDeg,endDeg,g.clr);
            if(g.pct>=8){
              const midA=((startDeg+(endDeg-startDeg)/2)-90)*Math.PI/180;
              const midR2=(pieR+pieInR)/2;
              const lx=pieX+midR2*Math.cos(midA);
              const ly=pieY+midR2*Math.sin(midA);
              doc.setFontSize(5.5);doc.setFont("helvetica","bold");doc.setTextColor(255,255,255);
              doc.text(`${g.pct}%`,lx,ly+1.5,{align:"center"});
            }
            startDeg=endDeg;
          });
          doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(80,80,80);
          doc.text(safe(`${totDG2}`),pieX,pieY+2,{align:"center"});
          doc.setFontSize(5.5);doc.setTextColor(130,130,130);doc.setFont("helvetica","normal");
          doc.text("total",pieX,pieY+6,{align:"center"});
          const lgX=ML+53;
          doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(60,60,60);
          doc.text("Categorie",lgX,y+5);doc.text("Nb",lgX+82,y+5,{align:"center"});doc.text("%",lgX+96,y+5,{align:"center"});
          doc.setDrawColor(200,200,200);doc.setLineWidth(0.3);doc.line(lgX,y+7,lgX+104,y+7);
          depsRws2.forEach((g,gi)=>{
            const ry=y+13+gi*10.5;
            doc.setFillColor(...g.clr);doc.roundedRect(lgX,ry-4,5,5.5,1,1,"F");
            doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(55,55,55);
            doc.text(safe(g.label),lgX+7,ry);
            doc.setFont("helvetica","bold");doc.setTextColor(...g.clr);
            doc.text(String(g.deps),lgX+82,ry,{align:"center"});
            doc.setTextColor(100,100,100);doc.setFont("helvetica","normal");
            doc.text(`${g.pct}%`,lgX+96,ry,{align:"center"});
          });
          y+=Math.max(50,depsRws2.length*10.5+16);
          chk2(12);
          doc.setFontSize(6.5);doc.setFont("helvetica","italic");doc.setTextColor(100,100,100);
          const _don=safe("Lecture : Chaque couleur = un type d'environnement avec son propre seuil reglementaire. Rouge = E1 surfaces en contact direct avec le produit (seuil 10 UFC/cm2), Orange = E2 surfaces a proximite (seuil 25), Vert = E3 supports/sols (seuil 50), Bleu = E4 zone peripherique (seuil 100). Le chiffre au centre = total depassements.");
          const _donL=doc.splitTextToSize(_don,CW);doc.text(_donL,ML,y);y+=_donL.length*4+3;
          const critG2=depsRws2.find(g=>g.type==="1");
          if(critG2){
            chk2(10);
            doc.setFontSize(8);doc.setFont("helvetica","italic");doc.setTextColor(220,38,38);
            const cT=safe(`ATTENTION : ${critG2.pct}% des depassements concernent des surfaces en contact direct avec le produit (E1, seuil ${critG2.seuil} UFC/cm2). Action corrective immediate requise.`);
            const cTL=doc.splitTextToSize(cT,CW);doc.text(cTL,ML,y);y+=cTL.length*4.5+5;
          }
        }else{
          doc.setFontSize(8.5);doc.setTextColor(21,128,61);doc.setFont("helvetica","normal");
          doc.text("Aucun depassement detecte sur la periode analysee.",ML,y);y+=10;
        }
        if(keyEvs2.length>0){
          chk2(30);
          sec2(7,"Chronologie des evenements cles");
          autoTable(doc,{
            startY:y,
            head:[["Semaine","Evenement","Detail"]],
            body:keyEvs2.map(e=>[e.sem,e.label,e.detail]),
            styles:{fontSize:8.5,cellPadding:2.5,valign:"middle"},
            headStyles:{fillColor:[92,88,82],textColor:255,fontStyle:"bold",fontSize:8},
            columnStyles:{
              0:{cellWidth:28,halign:"center",fontStyle:"bold",textColor:[30,58,95]},
              1:{cellWidth:54,fontStyle:"bold"},
              2:{cellWidth:CW-82},
            },
            alternateRowStyles:{fillColor:[248,250,252]},
            margin:{left:ML,right:MR},
          });
          y=doc.lastAutoTable.finalY+8;
        }
        if(analyse.mgsEtendues&&analyse.mgsEtendues.length>0){
          chk2(30);
          sec2(8,"Points candidats au retrait du plan de controle");
          doc.setFontSize(7.5);doc.setFont("helvetica","italic");doc.setTextColor(60,100,60);
          const candTxt=safe(`Points a faible activite microbiologique sur ${periodeArr.length} semaine${periodeArr.length!==1?"s":""} - eligibles a une revision du plan de surveillance.`);
          const candL=doc.splitTextToSize(candTxt,CW);doc.text(candL,ML,y);y+=candL.length*4.5+4;
          const cands15=analyse.mgsEtendues.slice(0,15);
          if(analyse.mgsEtendues.length>15){
            chk2(7);
            doc.setFontSize(6.5);doc.setFont("helvetica","italic");doc.setTextColor(130,100,30);
            doc.text(safe(`(${analyse.mgsEtendues.length} points eligibles - liste limitee aux 15 premiers)`),ML,y);y+=5;
          }
          autoTable(doc,{
            startY:y,
            head:[["Point","Description","Sem. stables","Moy. UFC/cm2","% seuil"]],
            body:cands15.map(p=>[
              safe(p.id),safe((p.description||"").slice(0,42)),
              String(p.semStable||p.nbReleves||"-"),
              p.avg!==null&&p.avg!==undefined?String(p.avg):"-",
              p.avgSeuil!==null&&p.avgSeuil!==undefined?`${p.avgSeuil}%`:"-",
            ]),
            styles:{fontSize:8,cellPadding:2.5,valign:"middle"},
            headStyles:{fillColor:[21,128,61],textColor:255,fontStyle:"bold",fontSize:8},
            alternateRowStyles:{fillColor:[240,253,244]},
            columnStyles:{
              0:{cellWidth:20,halign:"center",fontStyle:"bold",textColor:[30,58,95]},
              1:{cellWidth:75},
              2:{cellWidth:24,halign:"center"},
              3:{cellWidth:25,halign:"center"},
              4:{cellWidth:CW-144,halign:"center"},
            },
            margin:{left:ML,right:MR},
          });
          y=doc.lastAutoTable.finalY+7;
        }
        // ── PAGE 4 ────────────────────────────────────────────────
        doc.addPage();addHdr();y=28;
        sec2(9,"Observations IA");
        const nbObsFaible2=observations.filter(o=>o.niveau==="faible").length;
        const obsToShow2=[...observations].filter(o=>o.niveau==="élevé"||o.niveau==="moyen").sort((a,b)=>{const r={"élevé":0,moyen:1};return(r[a.niveau]??3)-(r[b.niveau]??3);}).slice(0,6);
        if(obsToShow2.length>0){
          const iconMap2={"élevé":[220,38,38,"!"],moyen:[234,88,12,"~"],faible:[37,99,235,"i"]};
          obsToShow2.forEach((obs)=>{
            const ic2=iconMap2[obs.niveau]||[107,114,128,"?"];
            const[ir,ig,ib,ico]=ic2;
            const cBg=ir===220?[254,242,242]:ir===234?[255,247,237]:[239,246,255];
            const cBd=ir===220?[252,165,165]:ir===234?[253,186,116]:[147,197,253];
            doc.setFontSize(7.5);doc.setFont("helvetica","normal");
            const obsText2=safe((obs.texte||"").slice(0,300));
            const obsLines2=doc.splitTextToSize(obsText2,CW-18);
            const cardH2=Math.max(17,10+obsLines2.length*4.5+3);
            chk2(cardH2+3);
            doc.setFillColor(...cBg);doc.setDrawColor(...cBd);doc.setLineWidth(0.4);
            doc.roundedRect(ML,y,CW,cardH2,1.5,1.5,"FD");
            doc.setFillColor(ir,ig,ib);doc.ellipse(ML+6,y+cardH2/2,3.5,3.5,"F");
            doc.setFontSize(7);doc.setFont("helvetica","bold");doc.setTextColor(255,255,255);
            doc.text(String(ico),ML+6,y+cardH2/2+1.5,{align:"center"});
            if(obs.point){
              doc.setFontSize(7.5);doc.setFont("helvetica","bold");doc.setTextColor(30,58,95);
              doc.text(safe(obs.point),ML+13,y+6);
            }
            doc.setFontSize(6.5);doc.setFont("helvetica","bold");doc.setTextColor(ir,ig,ib);
            doc.text(safe((obs.niveau||"").toUpperCase()),ML+(obs.point?27:13),y+6);
            doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(50,50,50);
            doc.text(obsLines2,ML+13,y+11);
            y+=cardH2+3;
          });
          y+=3;
          if(nbObsFaible2>0){
            chk2(8);
            doc.setFontSize(7);doc.setFont("helvetica","italic");doc.setTextColor(100,140,100);
            doc.text(safe(`+ ${nbObsFaible2} observation${nbObsFaible2>1?"s":""} de niveau FAIBLE non affichee${nbObsFaible2>1?"s":""} (points conformes, situation normale).`),ML,y);y+=7;
          }
        }else if(nbObsFaible2>0){
          chk2(10);
          doc.setFontSize(8.5);doc.setFont("helvetica","italic");doc.setTextColor(21,128,61);
          doc.text(safe(`Aucune alerte detectee. ${nbObsFaible2} point${nbObsFaible2>1?"s":""} surveille${nbObsFaible2>1?"s":""} — tous conformes.`),ML,y);y+=10;
        }else{
          doc.setFontSize(8);doc.setTextColor(130,130,130);
          doc.text("Aucune observation disponible.",ML,y);y+=10;
        }
        chk2(50);
        sec2(10,"Synthese et conclusions");
        const narrativeP=safe(
          `Sur ${periodeArr.length} semaine${periodeArr.length!==1?"s":""} (${periodeStr}), ${analyse.total} points de prelevement ont ete surveilles dans ${envRows2.length} environnement${envRows2.length>1?"s":""}. `+
          (totDepsAllRaw===0
            ?`Aucun depassement de seuil n'a ete enregistre sur l'ensemble de la periode — la maitrise microbiologique est excellente.`
            :`${totDepsAllRaw} depassement${totDepsAllRaw>1?"s":""} ont ete detecte${totDepsAllRaw>1?"s":""}${tops5.length>0?`, concentre${totDepsAllRaw>1?"s":""} sur ${safe(tops5.map(p=>p.id).join(", "))}`:""}.`+
            (analyse.critiques.length>0?` Une action corrective est requise sur ${analyse.critiques.length>1?"ces points":"ce point"}.`:" La situation est redevenue normale apres cet incident."))
        );
        doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(50,50,50);
        const narrativeL=doc.splitTextToSize(narrativeP,CW);doc.text(narrativeL,ML,y);y+=narrativeL.length*5.2+8;
        chk2(42);
        doc.setFillColor(30,58,95);doc.roundedRect(ML,y,CW,9,1.5,1.5,"F");doc.rect(ML,y+4.5,CW,4.5,"F");
        doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(255,255,255);
        doc.text("BILAN DE LA PERIODE EN 5 POINTS",ML+4,y+5.5);y+=12;
        const bilanPts=[
          {t:`Conformite globale : ${pdfTaux}%${globalEvol!==0?` (${globalEvol>0?"+":""}${globalEvol}% vs periode precedente)`:""}`,c:pdfTaux>=90?[21,128,61]:pdfTaux>=80?[234,88,12]:[220,38,38]},
          {t:`Depassements : ${totDepsAllRaw===0?"Aucun detecte sur la periode — situation ideale":`${totDepsAllRaw} incident${totDepsAllRaw>1?"s":""} detecte${totDepsAllRaw>1?"s":""}`}`,c:totDepsAllRaw>0?[220,38,38]:[21,128,61]},
          {t:`Points surveilles : ${analyse.total} au total — ${analyse.conformeTotal.length} conformes, ${analyse.critiques.length} critique${analyse.critiques.length>1?"s":""}`,c:[30,58,95]},
          {t:`Bulletins : ${analyse.totalBulletins} analyse${analyse.totalBulletins>1?"s":""} sur ${periodeArr.length} semaine${periodeArr.length>1?"s":""}`,c:[92,88,82]},
          {t:`Risque microbiologique global : ${pdfTaux>=95?"FAIBLE — situation sous controle":pdfTaux>=85?"MODERE — vigilance recommandee":"ELEVE — actions correctives urgentes"}`,c:pdfTaux>=95?[21,128,61]:pdfTaux>=85?[234,88,12]:[220,38,38]},
        ];
        bilanPts.forEach((b)=>{
          chk2(9);
          doc.setFillColor(...b.c);doc.ellipse(ML+3.5,y+0.5,2.5,2.5,"F");
          doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(50,50,50);
          const bL=doc.splitTextToSize(safe(b.t),CW-10);doc.text(bL,ML+8,y+0.5);y+=bL.length*4.8+1.5;
        });
        y+=5;
        if(synthèseIA&&!synthèseIA.unavailable&&(synthèseIA.recommendations||[]).filter(r=>r&&r.trim()).length>0){
          chk2(25);
          doc.setFillColor(21,128,61);doc.roundedRect(ML,y,CW,9,1.5,1.5,"F");doc.rect(ML,y+4.5,CW,4.5,"F");
          doc.setFontSize(8);doc.setFont("helvetica","bold");doc.setTextColor(255,255,255);
          doc.text("RECOMMANDATIONS",ML+4,y+5.5);y+=12;
          synthèseIA.recommendations.filter(r=>r&&r.trim()).slice(0,5).forEach((r,ri)=>{
            chk2(8);
            doc.setFontSize(7.5);doc.setFont("helvetica","normal");doc.setTextColor(30,70,30);
            const rL=doc.splitTextToSize(safe(`${ri+1}. ${cleanSynth(r)}`),CW-6);
            doc.text(rL,ML+3,y);y+=rL.length*4.5+2;
          });
          y+=4;
        }
        chk2(55);
        const ficheH=50;
        doc.setFillColor(250,250,252);doc.setDrawColor(92,88,82);doc.setLineWidth(0.8);
        doc.roundedRect(ML,y,CW,ficheH,2,2,"FD");
        doc.setFillColor(92,88,82);doc.roundedRect(ML,y,CW,10,2,2,"F");doc.rect(ML,y+5,CW,5,"F");
        doc.setFontSize(9.5);doc.setFont("helvetica","bold");doc.setTextColor(255,255,255);
        doc.text("FICHE RECAPITULATIVE",ML+CW/2,y+6.5,{align:"center"});
        const ficheRows=[
          ["Societe","InnoFaso SA"],
          ["Localisation","Ouagadougou, Burkina Faso"],
          ["Periode analysee",safe(`${periodeStr} (${periodeArr.length} semaine${periodeArr.length!==1?"s":""})`),],
          ["Bulletins analyses",String(analyse.totalBulletins)],
          ["Points surveilles",String(analyse.total)],
          ["Conformite globale",`${pdfTaux}%`],
          ["Date du rapport",`${dateStr}`],
        ];
        const fCol1=ML+4,fCol2=ML+CW/2;
        ficheRows.forEach((row,ri)=>{
          const ry=y+13+ri*6;
          doc.setFontSize(7.5);doc.setFont("helvetica","bold");doc.setTextColor(92,88,82);
          doc.text(safe(row[0]),fCol1,ry);
          doc.setFont("helvetica","normal");doc.setTextColor(40,40,40);
          doc.text(safe(row[1]),fCol2,ry);
        });
        y+=ficheH+6;
        const totalPg=doc.internal.getNumberOfPages();
        for(let i=1;i<=totalPg;i++){
          doc.setPage(i);
          doc.setFillColor(248,250,252);doc.rect(0,H-11,W,11,"F");
          doc.setDrawColor(210,205,198);doc.setLineWidth(0.3);doc.line(0,H-11,W,H-11);
          doc.setFontSize(7);doc.setFont("helvetica","normal");doc.setTextColor(156,163,175);
          doc.text("Rapport genere automatiquement par InnoFaso IA - Confidentiel",ML,H-5);
          doc.text(`Page ${i} / ${totalPg}`,W-MR,H-5,{align:"right"});
        }
        doc.save(`rapport-ia-innofaso-${new Date().toISOString().slice(0,10)}.pdf`);

      }
    }catch(e){setError("Export "+format+" : "+e.message);}
    finally{setExportLoading(null);}
  };

  const obsFiltrées=useMemo(()=>
    filtreNiveau==="tous"?observations:observations.filter(o=>o.niveau===filtreNiveau),
    [observations,filtreNiveau]
  );
  const nbParNiveau=useMemo(()=>({
    élevé:observations.filter(o=>o.niveau==="élevé").length,
    moyen:observations.filter(o=>o.niveau==="moyen").length,
    faible:observations.filter(o=>o.niveau==="faible").length,
  }),[observations]);

  // Données graphique filtrées
  const seuilPrincipal=useMemo(()=>{
    if(!analyse||selectedPoints.length===0)return 50;
    const pts=Object.values(analyse.pointsMap||{}).filter(p=>selectedPoints.includes(p.id));
    return pts.length>0?pts[0].seuil:50;
  },[analyse,selectedPoints]);

  const allPoints=useMemo(()=>Object.values(analyse?.pointsMap||{}),[analyse]);
  const taux=useMemo(()=>analyse&&analyse.total>0?Math.round(analyse.conformeTotal.length/analyse.total*100):0,[analyse]);
  const maxUfc=useMemo(()=>{if(!analyse)return null;const all=analyse.pointsStats.flatMap(p=>p.vNN);return all.length?Math.max(...all):null;},[analyse]);
  const ptsSorted=useMemo(()=>{if(!analyse)return[];return[...analyse.pointsStats].sort((a,b)=>{const r={critique:0,surveillance:1,conforme:2,inconnu:3};return r[a.statut]!==r[b.statut]?r[a.statut]-r[b.statut]:(b.pctSeuil||0)-(a.pctSeuil||0);});},[analyse]);

  const [showExportMenu,setShowExportMenu]=useState(false);
  const [showZoneDet,setShowZoneDet]=useState(false);
  const [showAllProb,setShowAllProb]=useState(false);
  const [showEvolDet,setShowEvolDet]=useState(false);
  const [showFullTl,setShowFullTl]=useState(false);
  const [showDepDet,setShowDepDet]=useState(false);
  const [showAllObs,setShowAllObs]=useState(false);

  const envStats=useMemo(()=>{
    if(!analyse)return[];
    const wks=analyse.allWeeks;
    const half=Math.max(1,Math.floor(wks.length/2));
    const w1=new Set(wks.slice(0,half));
    const w2=new Set(wks.slice(half));
    return[
      {key:"E1",label:"Matières premières",seuil:10,color:"#1D6FA8"},
      {key:"E2",label:"Production",seuil:25,color:"#92D050"},
      {key:"E3",label:"Conditionnement",seuil:50,color:"#70AD47"},
      {key:"E4",label:"Stockage",seuil:100,color:"#ED7D31"},
    ].map(e=>{
      const pts=analyse.pointsStats.filter(p=>String(p.id||"").charAt(0)===e.key.charAt(1));
      if(!pts.length)return null;
      const conf=pts.filter(p=>p.statut==="conforme").length;
      const taux=Math.round(conf/pts.length*100);
      // evolution : compare 1ère moitié vs 2ème moitié
      let c1=0,t1=0,c2=0,t2=0;
      pts.forEach(p=>{
        (analyse.chartData||[]).forEach(row=>{
          const val=row[p.id];
          if(val===null||val===undefined||typeof val!=="number")return;
          if(w1.has(row.semaine)){t1++;if(val<(p.seuil||50))c1++;}
          else if(w2.has(row.semaine)){t2++;if(val<(p.seuil||50))c2++;}
        });
      });
      const tx1=t1>0?Math.round(c1/t1*100):null;
      const tx2=t2>0?Math.round(c2/t2*100):null;
      const evol=(tx1!==null&&tx2!==null)?tx2-tx1:null;
      return{...e,pts,conf,total:pts.length,taux,evol};
    }).filter(Boolean);
  },[analyse]);

  const topProblems=useMemo(()=>{
    if(!analyse)return[];
    return[...analyse.pointsStats].filter(p=>p.depassements>0).sort((a,b)=>b.depassements-a.depassements).slice(0,4);
  },[analyse]);

  const allProblems=useMemo(()=>{
    if(!analyse)return[];
    return[...analyse.pointsStats].filter(p=>p.depassements>0).sort((a,b)=>b.depassements-a.depassements);
  },[analyse]);

  const weeklyConfFull=useMemo(()=>{
    if(!analyse)return[];
    const envPts={
      E1:analyse.pointsStats.filter(p=>String(p.id||"").charAt(0)==="1"),
      E2:analyse.pointsStats.filter(p=>String(p.id||"").charAt(0)==="2"),
      E3:analyse.pointsStats.filter(p=>String(p.id||"").charAt(0)==="3"),
      E4:analyse.pointsStats.filter(p=>String(p.id||"").charAt(0)==="4"),
    };
    const calcEnv=(pts,row)=>{let c=0,t=0;pts.forEach(p=>{const v=row?.[p.id];if(v!==null&&v!==undefined&&typeof v==="number"){t++;if(v<(p.seuil||50))c++;}});return t>0?Math.round(c/t*100):null;};
    return analyse.allWeeks.map(sem=>{
      const row=(analyse.chartData||[]).find(r=>r.semaine===sem);
      let c=0,t=0;
      analyse.pointsStats.forEach(p=>{const v=row?.[p.id];if(v!==null&&v!==undefined&&typeof v==="number"){t++;if(v<(p.seuil||50))c++;}});
      return{sem,taux:t>0?Math.round(c/t*100):null,tauxE1:calcEnv(envPts.E1,row),tauxE2:calcEnv(envPts.E2,row),tauxE3:calcEnv(envPts.E3,row),tauxE4:calcEnv(envPts.E4,row)};
    });
  },[analyse]);

  const weeklyConf=useMemo(()=>{
    if(!analyse)return[];
    return analyse.allWeeks.map(sem=>{
      const row=(analyse.chartData||[]).find(r=>r.semaine===sem);
      if(!row)return{sem,taux:null};
      let conf=0,tot=0;
      analyse.pointsStats.forEach(p=>{const val=row[p.id];if(val!==null&&val!==undefined&&typeof val==="number"){tot++;if(val<(p.seuil||50))conf++;}});
      return{sem,taux:tot>0?Math.round(conf/tot*100):null};
    });
  },[analyse]);

  const depsBySeuil=useMemo(()=>{
    if(!analyse)return[];
    const groups=[
      {label:">= 100 UFC/cm2",min:100,max:Infinity,pieClr:"#dc2626"},
      {label:"50-100 UFC/cm2",min:50,max:100,pieClr:"#ea580c"},
      {label:"10-50 UFC/cm2",min:10,max:50,pieClr:"#16a34a"},
    ];
    const result=groups.map(g=>{
      const deps=analyse.pointsStats.reduce((a,p)=>{return a+(p.vNN||[]).filter(v=>v>=g.min&&v<g.max).length;},0);
      return{...g,deps};
    }).filter(g=>g.deps>0);
    const tot=result.reduce((a,g)=>a+g.deps,0)||1;
    return result.map(g=>({...g,pct:Math.round(g.deps/tot*100)}));
  },[analyse]);

  const timelineEv=useMemo(()=>{
    if(!analyse||analyse.allWeeks.length===0)return[];
    const wc=analyse.allWeeks.map((sem,i)=>{
      const row=(analyse.chartData||[]).find(r=>r.semaine===sem);
      let deps=0;
      const dPts=[];
      analyse.pointsStats.forEach(p=>{const val=row?.[p.id];if(val!==null&&val!==undefined&&typeof val==="number"&&val>=(p.seuil||50)){deps++;dPts.push(p.id);}});
      return{sem,deps,dPts,i};
    });
    const addSub=(w,prev)=>{
      const isFirst=w.i===0;
      const isLast=w.i===wc.length-1;
      let label="",sub="";
      if(w.deps===0){label="Période stable";sub=isLast?"Situation actuelle":"Aucun dépassement";}
      else if(w.deps>=3){label="Pic de contamination";sub=`${w.deps} dépassement${w.deps>1?"s":""}`;}
      else if(prev&&prev.deps===0){label="1ers dépassements";sub=w.dPts.slice(0,2).join(" et ")||`${w.deps} point(s)`;}
      else if(prev&&prev.deps>w.deps){label="Retour à la normale";sub="Amélioration progressive";}
      else{label=isLast?"Période actuelle":`${w.deps} dépassement${w.deps>1?"s":""}`;sub=isLast?"Maîtrise en cours":w.dPts.slice(0,2).join(", ")||"";}
      return{...w,type:w.deps===0?"ok":w.deps>=3?"bad":"warn",label,sub};
    };
    if(wc.length<=6)return wc.map((w,i)=>addSub(w,i>0?wc[i-1]:null));
    const selected=new Set([wc[0].sem,wc[wc.length-1].sem]);
    const worst=[...wc].sort((a,b)=>b.deps-a.deps)[0];if(worst)selected.add(worst.sem);
    const best=wc.find(w=>w.deps===0);if(best)selected.add(best.sem);
    const mid=wc[Math.floor(wc.length/2)];if(mid)selected.add(mid.sem);
    return wc.filter(w=>selected.has(w.sem)).slice(0,6).map((w,i,arr)=>addSub(w,i>0?arr[i-1]:null));
  },[analyse]);

  return (
    <div style={{height:"100%",overflowY:"auto",background:"var(--bg)",fontFamily:"var(--body-font)"}}>
      <style>{`
        @keyframes rp-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ai-spin{to{transform:rotate(360deg)}}
        .rp-card{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:box-shadow .18s}
        .rp-card:hover{box-shadow:0 3px 12px rgba(0,0,0,.09)}
        .rp-shdr{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1.5px solid var(--border)}
        .rp-snum{font-size:9.5px;font-weight:800;color:#fff;background:#5c5852;width:19px;height:19px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1}
        .rp-stxt{font-size:10.5px;font-weight:800;color:#5c5852;text-transform:uppercase;letter-spacing:.08em;font-family:var(--heading-font)}
        .rp-kpi{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 12px;text-align:center;transition:all .15s;position:relative;overflow:hidden}
        .rp-kpi::after{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--kpi-top,var(--border));border-radius:2px 2px 0 0}
        .rp-kpi:hover{box-shadow:0 4px 12px rgba(0,0,0,.09);transform:translateY(-1px)}
        .rp-kpi-val{font-size:26px;font-weight:800;font-family:var(--num-font);line-height:1;margin-bottom:3px}
        .rp-kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--txt3);margin-bottom:5px}
        .rp-kpi-sub{font-size:10px;color:var(--txt3)}
        .rp-obs{display:flex;gap:10px;padding:9px 12px;border-radius:var(--radius-xs);border:1px solid;margin-bottom:7px;font-size:11.5px;line-height:1.4}
        .rp-obs:last-child{margin-bottom:0}
        .rp-btn-x{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:var(--radius-xs);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--heading-font);transition:all .15s;border:none}
        .rp-btn-primary{background:var(--brand-gradient);color:#fff;box-shadow:0 2px 8px rgba(107,164,36,.3)}
        .rp-btn-primary:hover{opacity:.9;box-shadow:0 4px 14px rgba(107,164,36,.4)}
        .rp-btn-primary:disabled{opacity:.5;cursor:not-allowed}
        .rp-btn-outline{background:var(--card-bg);color:var(--txt2);border:1.5px solid var(--border)!important}
        .rp-btn-outline:hover{border-color:var(--brand)!important;color:var(--brand);background:var(--brand-bg)}
        .rp-btn-outline:disabled{opacity:.5;cursor:not-allowed}
        .rp-emenu{position:absolute;top:calc(100% + 4px);right:0;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 6px 20px rgba(0,0,0,.12);z-index:200;min-width:200px;overflow:hidden}
        .rp-eitem{display:flex;align-items:center;gap:9px;padding:10px 14px;font-size:12.5px;cursor:pointer;color:var(--txt2);transition:background .1s}
        .rp-eitem:hover{background:var(--brand-bg);color:var(--brand)}
        .rp-zrow{display:grid;grid-template-columns:1fr 58px 62px 58px;gap:0;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11.5px}
        .rp-zrow:last-child{border-bottom:none}
        .rp-prow{display:grid;grid-template-columns:58px 1fr 44px 90px;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11.5px}
        .rp-prow:last-child{border-bottom:none}
      `}</style>

      {/* ══ TOP BAR ══ */}
      <div style={{padding:"8px 22px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{fontSize:11,color:"var(--txt3)",fontWeight:600,letterSpacing:".03em"}}>
          Analyse historique et intelligence microbiologique
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {analyse&&analyse.allWeeks.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:"var(--radius-xs)",fontSize:11,color:"var(--txt2)"}}>
              <span style={{color:"var(--brand)"}}>📅</span>
              <strong style={{fontFamily:"var(--num-font)",color:"var(--txt)"}}>{analyse.allWeeks[0]}</strong>
              <span style={{color:"var(--txt3)"}}>{" → "}</span>
              <strong style={{fontFamily:"var(--num-font)",color:"var(--txt)"}}>{analyse.allWeeks[analyse.allWeeks.length-1]}</strong>
              <span style={{color:"var(--txt3)",fontSize:10}}>({analyse.allWeeks.length} sem.)</span>
            </div>
          )}
          <div style={{position:"relative"}}>
            <button className="rp-btn-x rp-btn-primary" onClick={()=>setShowExportMenu(p=>!p)} disabled={exportLoading!==null||!analyse}>
              {exportLoading?<Spinner size={13}/>:<span>📥</span>} Télécharger <span style={{fontSize:9,opacity:.8}}>▾</span>
            </button>
            {showExportMenu&&(
              <div className="rp-emenu">
                <div className="rp-eitem" onClick={()=>{setShowExportMenu(false);handleExport("pdf");}}>
                  <span style={{fontSize:15}}>📄</span> Rapport PDF complet
                </div>
                <div className="rp-eitem" onClick={()=>{setShowExportMenu(false);handleExport("excel");}}>
                  <span style={{fontSize:15}}>📊</span> Export Excel (multi-feuilles)
                </div>
              </div>
            )}
          </div>
          <button className="rp-btn-x rp-btn-outline" style={{padding:"7px 10px",border:"1.5px solid var(--border)"}} onClick={lancerAnalyse} disabled={loading||ls.entries.length===0} title="Relancer l analyse">
            {loading?<Spinner size={12}/>:<span>↺</span>}
          </button>
          <div style={{fontSize:10,color:"var(--txt3)",textAlign:"right",lineHeight:1.5}}>
            <div style={{fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",fontSize:9}}>Actualisation</div>
            <strong style={{color:"var(--txt)",fontFamily:"var(--num-font)",fontSize:11}}>
              {analyseDate?`${analyseDate.toLocaleDateString("fr-FR")} · ${analyseDate.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`:"—"}
            </strong>
          </div>
        </div>
      </div>

      {/* ══ ÉTATS ══ */}
      {ls.entries.length===0&&!loading&&(
        <div style={{padding:"0 22px",marginTop:20}}>
          <div style={{padding:"48px 24px",textAlign:"center",background:"var(--card-bg)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}>
            <div style={{fontSize:36,marginBottom:10}}>📋</div>
            <div style={{fontSize:14,fontWeight:700,color:"var(--txt)",marginBottom:6}}>Aucun bulletin importé</div>
            <div style={{fontSize:12,color:"var(--txt3)"}}>Importez des bulletins depuis la <strong>Cartographie</strong> pour lancer l'analyse.</div>
          </div>
        </div>
      )}
      {error&&<div style={{margin:"10px 22px",padding:"10px 14px",borderRadius:"var(--radius-xs)",background:"var(--red-bg)",border:"1px solid var(--red-bd)",color:"var(--red)",fontSize:12}}>{error}</div>}
      {loading&&(
        <div style={{margin:"10px 22px",display:"flex",alignItems:"center",gap:10,padding:20,background:"var(--card-bg)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}>
          <Spinner size={18}/><span style={{fontSize:13,color:"var(--txt2)"}}>Analyse de {ls.entries.length} bulletins en cours…</span>
        </div>
      )}

      {analyse&&!loading&&(
        <div style={{padding:"14px 22px 48px",display:"flex",flexDirection:"column",gap:16,animation:"rp-fadein .3s ease"}} onClick={()=>showExportMenu&&setShowExportMenu(false)}>

          {/* ══ 1. RÉSUMÉ EXÉCUTIF ══ */}
          <div>
            <div className="rp-shdr">
              <div className="rp-snum">1</div>
              <div className="rp-stxt">{"Résumé Exécutif"}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:12}}>
              {[
                {lbl:"Bulletins analysés",val:analyse.totalBulletins,sub:`${analyse.allWeeks.length} semaine${analyse.allWeeks.length>1?"s":""}`,c:"#5c5852",top:"#5c5852"},
                {lbl:"Points suivis",val:analyse.total,sub:"4 environnements",c:"#5c5852",top:"#5c5852"},
                {lbl:"Conformité globale",val:`${taux}%`,sub:taux>=90?"Bonne maitrise":taux>=70?"Vigilance requise":"Action requise",c:taux>=90?"var(--green)":taux>=70?"var(--orange)":"var(--red)",top:taux>=90?"var(--green)":taux>=70?"var(--orange)":"var(--red)"},
                {lbl:"Dépassements",val:analyse.pointsStats.reduce((a,p)=>a+(p.depassements||0),0),sub:"Sur toute la période",c:"var(--red)",top:"var(--red)"},
                {lbl:"Points problématiques",val:analyse.critiques.length+analyse.aSurveiller.length,sub:"Critiques + surveillance",c:analyse.critiques.length>0?"var(--red)":"var(--orange)",top:analyse.critiques.length>0?"var(--red)":"var(--orange)"},
              ].map((k,i)=>(
                <div key={i} className="rp-kpi" style={{"--kpi-top":k.top}}>
                  <div className="rp-kpi-lbl">{k.lbl}</div>
                  <div className="rp-kpi-val" style={{color:k.c}}>{k.val}</div>
                  <div className="rp-kpi-sub">{k.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ GRID 3 COLONNES : 2 + 3 + 4 ══ */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.15fr",gap:14,alignItems:"start"}}>

            {/* ── 2. CONFORMITÉ PAR ZONE ── */}
            <div className="rp-card">
              <div className="rp-shdr">
                <div className="rp-snum">2</div>
                <div className="rp-stxt">{"Conformité par zone"}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 58px 62px 58px",gap:0,paddingBottom:6,borderBottom:"2px solid var(--border)",marginBottom:2}}>
                {["Zone","Conf.","Évol.","Points"].map((h,i)=>(
                  <div key={i} style={{fontSize:9,fontWeight:700,color:"var(--txt3)",textTransform:"uppercase",letterSpacing:".05em",textAlign:i>0?"center":"left"}}>{h}</div>
                ))}
              </div>
              {envStats.length===0&&<div style={{fontSize:11,color:"var(--txt3)",padding:"12px 0",textAlign:"center"}}>{"Aucune donnée."}</div>}
              {envStats.map((e,i)=>{
                const tc=e.taux>=90?"var(--green)":e.taux>=70?"var(--orange)":"var(--red)";
                const ec=e.evol===null?"var(--txt3)":e.evol>0?"var(--green)":e.evol<0?"var(--red)":"var(--txt3)";
                const ea=e.evol===null?"—":e.evol>0?`↑ +${e.evol}%`:e.evol<0?`↓ ${e.evol}%`:"→ 0%";
                return(
                  <div key={i} className="rp-zrow">
                    <div>
                      <span style={{fontWeight:700,fontSize:10.5,color:e.color,marginRight:4}}>{e.key}</span>
                      <span style={{fontSize:10.5,color:"var(--txt2)"}}>{e.label}</span>
                    </div>
                    <div style={{textAlign:"center",fontWeight:800,fontFamily:"var(--num-font)",color:tc,fontSize:13}}>{e.taux}%</div>
                    <div style={{textAlign:"center",fontSize:11,fontWeight:600,color:ec}}>{ea}</div>
                    <div style={{textAlign:"center",fontSize:11,color:"var(--txt2)"}}>{e.conf}/{e.total}</div>
                  </div>
                );
              })}
              {showZoneDet&&(
                <div style={{marginTop:10,animation:"rp-fadein .2s ease"}}>
                  {envStats.map((e,ei)=>(
                    <div key={ei} style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:e.color,textTransform:"uppercase",letterSpacing:".05em",marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:8,height:8,borderRadius:2,background:e.color,display:"inline-block"}}/>
                        {e.key} — {e.label}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {e.pts.map((p,pi)=>{
                          const sc=p.statut==="conforme"?"var(--green)":p.statut==="critique"?"var(--red)":"var(--orange)";
                          const sb=p.statut==="conforme"?"var(--green-bg)":p.statut==="critique"?"var(--red-bg)":"var(--orange-bg)";
                          const sbd=p.statut==="conforme"?"var(--green-bd)":p.statut==="critique"?"var(--red-bd)":"var(--orange-bd)";
                          return(
                            <div key={pi} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 7px",borderRadius:99,background:sb,border:`1px solid ${sbd}`,fontSize:10}}>
                              <span style={{fontWeight:700,color:"var(--brand)",fontFamily:"var(--num-font)"}}>{p.id}</span>
                              <span style={{color:sc,fontSize:9}}>●</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                <button style={{width:"100%",padding:"7px 12px",background:showZoneDet?"var(--brand-bg)":"none",border:`1px solid ${showZoneDet?"var(--brand-bd)":"var(--border)"}`,borderRadius:"var(--radius-xs)",color:showZoneDet?"var(--brand)":"var(--txt3)",fontSize:11.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"var(--body-font)"}} onClick={()=>setShowZoneDet(p=>!p)}>
                  <span>{showZoneDet?"Masquer le détail":"Voir le détail par zone"}</span>
                  <span style={{fontSize:12,transform:showZoneDet?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block"}}>›</span>
                </button>
              </div>
            </div>

            {/* ── 3. POINTS LES PLUS PROBLÉMATIQUES ── */}
            <div className="rp-card">
              <div className="rp-shdr">
                <div className="rp-snum" style={{background:"#c2410c"}}>3</div>
                <div className="rp-stxt">{"Points les plus problématiques"}</div>
              </div>
              {topProblems.length===0?(
                <div style={{padding:"14px 0",textAlign:"center"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:"var(--green-bg)",border:"1px solid var(--green-bd)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--green)",margin:"0 auto 7px",fontWeight:700,fontSize:14}}>✓</div>
                  <div style={{fontSize:12,color:"var(--green)",fontWeight:700}}>{"Aucun dépassement"}</div>
                  <div style={{fontSize:10,color:"var(--txt3)",marginTop:3}}>{"Tous les points sont conformes"}</div>
                </div>
              ):(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"58px 1fr 44px 90px",gap:8,paddingBottom:6,borderBottom:"2px solid var(--border)",marginBottom:2}}>
                    {["Point","Desc.","Dép.","% des dép."].map((h,i)=>(
                      <div key={i} style={{fontSize:9,fontWeight:700,color:"var(--txt3)",textTransform:"uppercase",letterSpacing:".04em",textAlign:i>1?"center":"left"}}>{h}</div>
                    ))}
                  </div>
                  {!showAllProb&&allProblems.length>4&&<div style={{fontSize:10,color:"var(--txt3)",textAlign:"right",marginBottom:4}}>{allProblems.length-4} autre(s) point(s) masqué(s)</div>}
                  {(showAllProb?allProblems:topProblems).map((p,i)=>{
                    const totD=allProblems.reduce((a,pp)=>a+(pp.depassements||0),0)||1;
                    const pct=Math.round((p.depassements||0)/totD*100);
                    const bClr=i===0?"var(--red)":i===1?"var(--orange)":"#f59e0b";
                    return(
                      <div key={i} className="rp-prow">
                        <div style={{fontFamily:"var(--num-font)",fontWeight:700,color:"var(--brand)",fontSize:10.5}}>{p.id}</div>
                        <div style={{fontSize:10,color:"var(--txt2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.description||"").slice(0,20)}</div>
                        <div style={{textAlign:"center",fontWeight:800,color:"var(--red)",fontFamily:"var(--num-font)",fontSize:13}}>{p.depassements}</div>
                        <div>
                          <div style={{height:5,borderRadius:3,background:"var(--border)",overflow:"hidden",marginBottom:1}}>
                            <div style={{height:"100%",width:`${pct}%`,background:bClr,borderRadius:3}}/>
                          </div>
                          <div style={{fontSize:9,color:"var(--txt3)",textAlign:"right"}}>{pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                    <button style={{width:"100%",padding:"7px 12px",background:showAllProb?"var(--red-bg)":"none",border:`1px solid ${showAllProb?"var(--red-bd)":"var(--border)"}`,borderRadius:"var(--radius-xs)",color:showAllProb?"var(--red)":"var(--txt3)",fontSize:11.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"var(--body-font)"}} onClick={()=>setShowAllProb(p=>!p)}>
                      <span>{showAllProb?`Masquer (${allProblems.length} points)`:`Voir tous les points (${allProblems.length})`}</span>
                      <span style={{fontSize:12,transform:showAllProb?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block"}}>›</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── 4. ÉVOLUTION DE LA CONFORMITÉ ── */}
            <div className="rp-card">
              <div className="rp-shdr">
                <div className="rp-snum" style={{background:"var(--brand)"}}>4</div>
                <div className="rp-stxt">{"Évolution de la conformité"}</div>
              </div>
              {weeklyConf.filter(w=>w.taux!==null).length>=2?(
                <ResponsiveContainer width="100%" height={185}>
                  <LineChart data={weeklyConf.filter(w=>w.taux!==null)} margin={{top:4,right:36,left:-16,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="sem" tick={{fontSize:8,fill:"var(--txt3)",fontFamily:"var(--num-font)"}} tickFormatter={v=>String(v||"").slice(0,7)} tickLine={false} axisLine={{stroke:"var(--border)"}} interval="preserveStartEnd"/>
                    <YAxis domain={[Math.max(0,Math.min(...weeklyConf.filter(w=>w.taux!==null).map(w=>w.taux))-15),100]} tick={{fontSize:8,fill:"var(--txt3)"}} tickFormatter={v=>`${v}%`} tickLine={false} axisLine={false}/>
                    <Tooltip formatter={(v)=>[`${v}%`,"Conformite"]} labelStyle={{fontWeight:700,fontSize:11}} itemStyle={{fontSize:11}}/>
                    <ReferenceLine y={90} stroke="var(--red)" strokeDasharray="5 3" strokeWidth={1.5} label={{value:"Seuil 90%",position:"right",fontSize:8.5,fill:"var(--red)"}}/>
                    <Line type="monotone" dataKey="taux" stroke="var(--brand)" strokeWidth={2.5} dot={{r:3,fill:"var(--brand)"}} activeDot={{r:5}} name="Conformite globale"/>
                  </LineChart>
                </ResponsiveContainer>
              ):(
                <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--txt3)",fontSize:12}}>
                  {"Minimum 2 bulletins pour afficher la courbe."}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4,fontSize:10,color:"var(--txt3)"}}>
                <span style={{width:14,height:2.5,background:"var(--brand)",display:"inline-block",borderRadius:2}}/>
                {"Conformité globale"}
              </div>
              {showEvolDet&&weeklyConfFull.filter(w=>w.taux!==null).length>=2&&(
                <div style={{marginTop:12,animation:"rp-fadein .2s ease"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--txt3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Par environnement</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={weeklyConfFull.filter(w=>w.taux!==null)} margin={{top:4,right:36,left:-16,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="sem" tick={{fontSize:7,fill:"var(--txt3)"}} tickFormatter={v=>String(v||"").slice(0,7)} tickLine={false} axisLine={{stroke:"var(--border)"}} interval="preserveStartEnd"/>
                      <YAxis domain={[50,100]} tick={{fontSize:7,fill:"var(--txt3)"}} tickFormatter={v=>`${v}%`} tickLine={false} axisLine={false}/>
                      <Tooltip formatter={(v,n)=>[v!==null?`${v}%`:"—",n]} labelStyle={{fontWeight:700,fontSize:10}} itemStyle={{fontSize:10}}/>
                      <ReferenceLine y={90} stroke="var(--red)" strokeDasharray="4 2" strokeWidth={1}/>
                      {[{k:"tauxE1",c:"#1D6FA8",l:"E1"},{k:"tauxE2",c:"#5a9e2f",l:"E2"},{k:"tauxE3",c:"#70AD47",l:"E3"},{k:"tauxE4",c:"#ED7D31",l:"E4"}]
                        .filter(e=>weeklyConfFull.some(w=>w[e.k]!==null))
                        .map(e=>(
                          <Line key={e.k} type="monotone" dataKey={e.k} stroke={e.c} strokeWidth={1.5} dot={false} name={e.l} connectNulls/>
                        ))
                      }
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:4}}>
                    {[{c:"#1D6FA8",l:"E1 — Matières premières"},{c:"#5a9e2f",l:"E2 — Production"},{c:"#70AD47",l:"E3 — Conditionnement"},{c:"#ED7D31",l:"E4 — Stockage"}]
                      .map((e,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:9.5,color:"var(--txt3)"}}>
                          <span style={{width:12,height:2,background:e.c,display:"inline-block",borderRadius:2}}/>
                          {e.l}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                <button style={{width:"100%",padding:"7px 12px",background:showEvolDet?"var(--brand-bg)":"none",border:`1px solid ${showEvolDet?"var(--brand-bd)":"var(--border)"}`,borderRadius:"var(--radius-xs)",color:showEvolDet?"var(--brand)":"var(--txt3)",fontSize:11.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"var(--body-font)"}} onClick={()=>setShowEvolDet(p=>!p)}>
                  <span>{showEvolDet?"Masquer le détail":"Voir l'évolution par environnement"}</span>
                  <span style={{fontSize:12,transform:showEvolDet?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block"}}>›</span>
                </button>
              </div>
            </div>
          </div>

          {/* ══ 5. CHRONOLOGIE ══ */}
          {timelineEv.length>=2&&(
            <div className="rp-card">
              <div className="rp-shdr">
                <div className="rp-snum" style={{background:"#7c3aed"}}>5</div>
                <div className="rp-stxt">{"Chronologie des événements clés"}</div>
              </div>
              <div style={{position:"relative",paddingBottom:22}}>
                {/* Ligne de temps */}
                <div style={{position:"absolute",bottom:12,left:0,right:0,height:3,background:"linear-gradient(90deg,var(--brand),#5c5852)",borderRadius:2,zIndex:0}}/>
                {/* Cartes au-dessus */}
                <div style={{display:"flex",justifyContent:"space-between",gap:8,position:"relative",zIndex:1,marginBottom:6}}>
                  {timelineEv.map((w,i)=>{
                    const dC=w.type==="ok"?"var(--green)":w.type==="bad"?"var(--red)":"var(--orange)";
                    const bC=w.type==="ok"?"var(--green-bg)":w.type==="bad"?"var(--red-bg)":"var(--orange-bg)";
                    const bdC=w.type==="ok"?"var(--green-bd)":w.type==="bad"?"var(--red-bd)":"var(--orange-bd)";
                    const ico=w.type==="ok"?"✓":w.type==="bad"?"⊗":"⚠";
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{padding:"6px 8px",borderRadius:6,background:bC,border:`1px solid ${bdC}`,textAlign:"center",width:"100%",boxSizing:"border-box",minHeight:54}}>
                          <div style={{fontSize:9.5,fontWeight:800,color:dC,marginBottom:1}}>{ico} {w.sem}</div>
                          <div style={{fontSize:10,fontWeight:600,color:"var(--txt)",lineHeight:1.3,marginBottom:1}}>{w.label}</div>
                          {w.sub&&<div style={{fontSize:8.5,color:"var(--txt3)",lineHeight:1.3}}>{w.sub}</div>}
                        </div>
                        <div style={{width:12,height:12,borderRadius:"50%",background:dC,border:"2.5px solid var(--card-bg)",boxShadow:`0 0 0 2px ${dC}`}}/>
                      </div>
                    );
                  })}
                </div>
              </div>
              {showFullTl&&(
                <div style={{marginTop:12,animation:"rp-fadein .2s ease"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--txt3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Toutes les semaines</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    {weeklyConf.map((w,i)=>{
                      const c=w.taux===null?"var(--txt3)":w.taux>=90?"var(--green)":w.taux>=70?"var(--orange)":"var(--red)";
                      const bg=w.taux===null?"var(--border)":w.taux>=90?"var(--green-bg)":w.taux>=70?"var(--orange-bg)":"var(--red-bg)";
                      const bd=w.taux===null?"var(--border)":w.taux>=90?"var(--green-bd)":w.taux>=70?"var(--orange-bd)":"var(--red-bd)";
                      return(
                        <div key={i} style={{padding:"4px 8px",borderRadius:6,background:bg,border:`1px solid ${bd}`,textAlign:"center",minWidth:56}}>
                          <div style={{fontSize:8.5,fontWeight:600,color:"var(--txt3)"}}>{String(w.sem||"").slice(0,7)}</div>
                          <div style={{fontSize:11,fontWeight:800,color:c,fontFamily:"var(--num-font)"}}>{w.taux!==null?`${w.taux}%`:"—"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"center",marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                <button style={{padding:"7px 22px",background:showFullTl?"var(--brand-bg)":"none",border:`1px solid ${showFullTl?"var(--brand-bd)":"var(--border)"}`,borderRadius:"var(--radius-xs)",color:showFullTl?"var(--brand)":"var(--txt3)",fontSize:11.5,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"var(--body-font)"}} onClick={()=>setShowFullTl(p=>!p)}>
                  <span>{showFullTl?"Masquer":"Voir la chronologie complète"}</span>
                  <span style={{fontSize:12,transform:showFullTl?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block"}}>›</span>
                </button>
              </div>
            </div>
          )}

          {/* ══ GRID 2 COLONNES : 6 + 7 ══ */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>

            {/* ── 6. RÉPARTITION DES DÉPASSEMENTS ── */}
            <div className="rp-card">
              <div className="rp-shdr">
                <div className="rp-snum" style={{background:"#dc2626"}}>6</div>
                <div className="rp-stxt">{"Répartition des dépassements par seuil"}</div>
              </div>
              {depsBySeuil.length===0?(
                <div style={{padding:"18px 0",textAlign:"center"}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:"var(--green-bg)",border:"1px solid var(--green-bd)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--green)",margin:"0 auto 8px",fontWeight:700,fontSize:18}}>✓</div>
                  <div style={{fontSize:12,color:"var(--green)",fontWeight:700}}>{"Aucun dépassement"}</div>
                  <div style={{fontSize:10.5,color:"var(--txt3)",marginTop:3}}>{"Tous les points respectent leur seuil."}</div>
                </div>
              ):(
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{flexShrink:0}}>
                    <ResponsiveContainer width={130} height={130}>
                      <PieChart>
                        <Pie
                          data={depsBySeuil}
                          dataKey="deps"
                          innerRadius={34}
                          outerRadius={56}
                          paddingAngle={3}
                          label={({cx,cy,midAngle,innerRadius,outerRadius,pct})=>{
                            const RADIAN=Math.PI/180;
                            const r=innerRadius+(outerRadius-innerRadius)*1.55;
                            const x=cx+r*Math.cos(-midAngle*RADIAN);
                            const y=cy+r*Math.sin(-midAngle*RADIAN);
                            return pct>0?<text x={x} y={y} fill="var(--txt2)" textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700}>{`${pct}%`}</text>:null;
                          }}
                          labelLine={false}
                        >
                          {depsBySeuil.map((entry,i)=><Cell key={i} fill={entry.pieClr}/>)}
                        </Pie>
                        <Tooltip formatter={(v)=>[v,"Depassements"]} itemStyle={{fontSize:11}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 42px 38px",gap:0,paddingBottom:5,borderBottom:"1px solid var(--border)",marginBottom:3}}>
                      {["Seuil","Dép.",""].map((h,i)=>(
                        <div key={i} style={{fontSize:9,fontWeight:700,color:"var(--txt3)",textTransform:"uppercase",textAlign:i>0?"center":"left"}}>{h}</div>
                      ))}
                    </div>
                    {depsBySeuil.map((g,i)=>(
                      <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 42px 38px",gap:0,padding:"4px 0",borderBottom:i<depsBySeuil.length-1?"1px solid var(--border)":"none",fontSize:11}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{width:8,height:8,borderRadius:2,background:g.pieClr,flexShrink:0}}/>
                          <span style={{color:"var(--txt2)",fontSize:10.5}}>{g.label}</span>
                        </div>
                        <div style={{textAlign:"center",fontWeight:700,color:g.pieClr,fontFamily:"var(--num-font)"}}>{g.deps}</div>
                        <div style={{textAlign:"center",color:"var(--txt3)",fontSize:10}}>{g.pct}%</div>
                      </div>
                    ))}
                    {showDepDet&&(
                      <div style={{marginTop:8,animation:"rp-fadein .2s ease"}}>
                        {depsBySeuil.map((g,gi)=>{
                          const pts=analyse.pointsStats.filter(p=>(p.vNN||[]).some(v=>v>=g.min&&v<g.max));
                          return pts.length>0&&(
                            <div key={gi} style={{marginBottom:6}}>
                              <div style={{fontSize:9,fontWeight:700,color:g.pieClr,marginBottom:3,textTransform:"uppercase"}}>{g.label}</div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                                {pts.map((p,pi)=>(
                                  <span key={pi} style={{padding:"2px 6px",borderRadius:99,background:"var(--border)",fontSize:9.5,fontFamily:"var(--num-font)",color:"var(--txt2)",fontWeight:600}}>{p.id}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                      <button style={{width:"100%",padding:"6px 10px",background:showDepDet?"var(--red-bg)":"none",border:`1px solid ${showDepDet?"var(--red-bd)":"var(--border)"}`,borderRadius:"var(--radius-xs)",color:showDepDet?"var(--red)":"var(--txt3)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"var(--body-font)"}} onClick={()=>setShowDepDet(p=>!p)}>
                        <span>{showDepDet?"Masquer":"Voir le détail par point"}</span>
                        <span style={{fontSize:12,transform:showDepDet?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block"}}>›</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 7. OBSERVATIONS IA ── */}
            <div className="rp-card">
              <div className="rp-shdr">
                <div className="rp-snum" style={{background:"#7c3aed"}}>7</div>
                <div className="rp-stxt">{"Observations IA"}</div>
                <span style={{marginLeft:"auto",fontSize:10,color:"var(--txt3)",fontWeight:600}}>{observations.length} obs.</span>
              </div>
              {(showAllObs?observations:observations.slice(0,4)).map((obs,i)=>(
                <div key={i} className="rp-obs" style={{background:obs.bgVar,borderColor:obs.borderVar}}>
                  <div style={{width:26,height:26,borderRadius:7,background:obs.colorVar,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{obs.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                      {obs.point&&<span style={{fontFamily:"var(--num-font)",fontWeight:700,color:"var(--brand)",fontSize:10.5}}>{obs.point}</span>}
                      <span style={{padding:"1px 6px",borderRadius:99,fontSize:9,fontWeight:700,textTransform:"uppercase",background:obs.colorVar,color:"#fff"}}>{obs.niveau}</span>
                    </div>
                    <div style={{fontSize:11.5,color:"var(--txt)",lineHeight:1.5}}>{obs.texte}</div>
                  </div>
                </div>
              ))}
              {observations.length===0&&<div style={{textAlign:"center",padding:"14px 0",color:"var(--txt3)",fontSize:12}}>{"Aucune observation."}</div>}
              {observations.length>4&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                  <button style={{width:"100%",padding:"7px 12px",background:showAllObs?"rgba(124,58,237,.07)":"none",border:`1px solid ${showAllObs?"#7c3aed":"var(--border)"}`,borderRadius:"var(--radius-xs)",color:showAllObs?"#7c3aed":"var(--txt3)",fontSize:11.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"var(--body-font)"}} onClick={()=>setShowAllObs(p=>!p)}>
                    <span>{showAllObs?`Masquer (${observations.length} obs.)`:`Voir toutes les observations (${observations.length})`}</span>
                    <span style={{fontSize:12,transform:showAllObs?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block"}}>›</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ══ FOOTER — BILAN IA ══ */}
          <div style={{background:"linear-gradient(90deg,rgba(92,88,82,.06),var(--card-bg))",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontWeight:700,fontSize:11,color:"#5c5852",marginBottom:4,textTransform:"uppercase",letterSpacing:".05em",fontFamily:"var(--heading-font)"}}>{"Bilan IA de la période"}</div>
              <div style={{fontSize:11.5,color:"var(--txt2)",lineHeight:1.55}}>
                {synthèseIA&&!synthèseIA.unavailable&&synthèseIA.summary
                  ?(synthèseIA.summary.slice(0,210)+(synthèseIA.summary.length>210?"…":""))
                  :(`Sur ${analyse.allWeeks.length} semaine${analyse.allWeeks.length>1?"s":""} analysée${analyse.allWeeks.length>1?"s":""}, conformite globale de ${taux}%. ${analyse.critiques.length>0?`${analyse.critiques.length} point(s) critique(s) requierent une attention.`:"Maitrise satisfaisante sur la periode."}`)}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}