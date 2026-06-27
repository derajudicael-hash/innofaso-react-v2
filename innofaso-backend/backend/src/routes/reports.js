const express = require("express");
const auth    = require("../middleware/auth");

const router = express.Router();

// ── Moteur de synthèse par règles microbiologiques ───────────────────────────
// Génère summary + insights + recommendations sans clé API ni internet.
// Utilisé en priorité. Si GROQ_API_KEY est définie, Groq est tenté en premier
// et ce moteur sert de fallback automatique.
function synthèseParRègles({ bulletinRef, kpis, pointsCritiques = [], pointsSurveillance = [], pointsStables = [], pointsARetirer = [] }) {
  const total     = kpis?.total     ?? 0;
  const conformes = kpis?.conformes ?? 0;
  const surv      = kpis?.surv      ?? 0;
  const crits     = kpis?.crits     ?? 0;
  const taux      = kpis?.taux      ?? 0;
  const ref       = bulletinRef || "Analyse périodique";

  // ── RÉSUMÉ EXÉCUTIF ────────────────────────────────────────────────────────
  let summary;
  if (crits > 0) {
    const zones = pointsCritiques.slice(0, 2).map(p => p.description || p.id).join(" et ");
    summary =
      `L'analyse "${ref}" couvre ${total} points de prélèvement. ` +
      `Le taux de conformité global s'établit à ${taux}% (${conformes}/${total} points conformes). ` +
      `${crits} point(s) critique(s) ${zones ? `(${zones}) ` : ""}présentent des dépassements répétés du seuil réglementaire ` +
      `et nécessitent une intervention corrective immédiate. ` +
      `Une revue du plan de nettoyage-désinfection est indispensable pour les zones concernées.`;
  } else if (surv > 0) {
    const zones = pointsSurveillance.slice(0, 2).map(p => p.description || p.id).join(" et ");
    summary =
      `L'analyse "${ref}" couvre ${total} points de prélèvement avec un taux de conformité de ${taux}%. ` +
      `Aucun point critique n'est détecté. ` +
      `${surv} point(s) ${zones ? `(${zones}) ` : ""}présentent une tendance haussière des UFC ` +
      `nécessitant une vigilance accrue. La maîtrise microbiologique globale est satisfaisante.`;
  } else {
    summary =
      `L'analyse "${ref}" couvre ${total} points de prélèvement. ` +
      `Le taux de conformité global est de ${taux}% (${conformes}/${total}). ` +
      `Aucun dépassement de seuil n'est détecté. La maîtrise microbiologique est conforme ` +
      `aux exigences des normes NF EN ISO 18593 et CE 2073/2005.`;
  }

  // ── OBSERVATIONS / INSIGHTS ────────────────────────────────────────────────
  const insights = [];

  if (crits > 0 && pointsCritiques.length > 0) {
    const noms = pointsCritiques.slice(0, 3).map(p => p.description || p.id).join(", ");
    const deps  = pointsCritiques[0]?.depassements ?? "";
    insights.push(
      `${crits} point(s) critique(s) identifié(s) : ${noms}. ` +
      `${deps ? `Le plus impacté cumule ${deps} dépassement(s) sur la période. ` : ""}` +
      `Ces dépassements répétés indiquent une défaillance du plan de nettoyage-désinfection ` +
      `ou une recontamination croisée dans la zone concernée.`
    );
  }

  if (surv > 0 && pointsSurveillance.length > 0) {
    const noms = pointsSurveillance.slice(0, 2).map(p => p.description || p.id).join(", ");
    insights.push(
      `${surv} point(s) en tendance haussière : ${noms}. ` +
      `Les valeurs UFC progressent sans dépasser le seuil réglementaire à ce jour, ` +
      `mais la dynamique observée justifie un renforcement préventif de la surveillance ` +
      `et une vérification des procédures de nettoyage sur ces postes.`
    );
  }

  if (pointsARetirer.length > 0) {
    const noms = pointsARetirer.slice(0, 2).map(p => p.description || p.id).join(", ");
    insights.push(
      `${pointsARetirer.length} point(s) candidat(s) au retrait du plan de contrôle : ${noms}. ` +
      `Ces points affichent une stabilité prolongée (≥ 5 semaines consécutives) ` +
      `avec des valeurs systématiquement inférieures à 50 % du seuil réglementaire, ` +
      `ce qui justifie une révision du plan de surveillance conformément aux principes HACCP.`
    );
  }

  if (insights.length < 3 && pointsStables.length > 0) {
    const nb   = pointsStables.length;
    const noms = pointsStables.slice(0, 2).map(p => p.description || p.id).join(", ");
    insights.push(
      `${nb} point(s) stable(s) confirmé(s) (ex : ${noms}). ` +
      `Ces zones affichent des valeurs UFC bien en dessous des seuils réglementaires ` +
      `sur l'ensemble de la période, témoignant de l'efficacité des procédures ` +
      `de nettoyage-désinfection en place.`
    );
  }

  if (insights.length < 3) {
    if (taux >= 95) {
      insights.push(
        `Taux de conformité excellent à ${taux}%. ` +
        `La performance microbiologique respecte les exigences des normes CE 2073/2005 ` +
        `et NF EN ISO 18593. Les pratiques d'hygiène en place sont efficaces ` +
        `et peuvent servir de référence pour les autres zones de production.`
      );
    } else if (taux >= 75) {
      insights.push(
        `Taux de conformité de ${taux}% — performance globalement satisfaisante. ` +
        `Des marges de progrès existent sur les ${total - conformes} point(s) hors conformité. ` +
        `Un audit ciblé des procédures de nettoyage permettrait d'améliorer ce résultat.`
      );
    } else {
      insights.push(
        `Taux de conformité de ${taux}% — en dessous du seuil cible de 90%. ` +
        `Un audit complet des procédures de nettoyage-désinfection, ` +
        `de la qualification du personnel et des produits désinfectants utilisés ` +
        `est fortement recommandé pour identifier les causes de non-conformité.`
      );
    }
  }

  // ── RECOMMANDATIONS ────────────────────────────────────────────────────────
  const recommendations = [];

  if (crits > 0) {
    recommendations.push(
      `Déclencher immédiatement une action corrective (fiche CAPA) pour les ${crits} point(s) critique(s) : ` +
      `audit du plan de nettoyage, vérification des concentrations de désinfectant, ` +
      `inspection des surfaces et formation/sensibilisation du personnel de zone.`
    );
  } else if (surv > 0) {
    recommendations.push(
      `Renforcer la fréquence de surveillance sur les ${surv} point(s) en hausse : ` +
      `passer à un contrôle hebdomadaire jusqu'à stabilisation des valeurs ` +
      `en dessous de 80 % du seuil réglementaire. ` +
      `Documenter les actions préventives dans le registre HACCP.`
    );
  } else {
    recommendations.push(
      `Maintenir la fréquence actuelle de surveillance et documenter les bonnes pratiques ` +
      `identifiées sur les zones conformes afin de les capitaliser dans le manuel qualité ` +
      `et de former les nouvelles équipes.`
    );
  }

  if (pointsARetirer.length > 0) {
    recommendations.push(
      `Soumettre à validation du responsable qualité la proposition de retrait de ` +
      `${pointsARetirer.length} point(s) du plan de contrôle. ` +
      `Leur stabilité prolongée justifie une révision du plan selon les principes HACCP, ` +
      `permettant de concentrer les ressources sur les zones à risque effectif.`
    );
  } else if (taux < 90) {
    recommendations.push(
      `Organiser une revue mensuelle du tableau de bord qualité microbiologique ` +
      `pour suivre la progression du taux de conformité et valider l'efficacité ` +
      `des actions correctives mises en œuvre.`
    );
  } else {
    recommendations.push(
      `Partager ce bilan de conformité lors de la prochaine réunion qualité mensuelle ` +
      `et enregistrer les résultats dans le système de management qualité (SMQ) ` +
      `pour traçabilité et revue de direction.`
    );
  }

  recommendations.push(
    `Archiver ce rapport dans le SMQ InnoFaso et transmettre un résumé exécutif ` +
    `aux responsables de production et de qualité. ` +
    `Pour toute valeur UFC proche du seuil (>80 %), anticiper un prélèvement ` +
    `de confirmation avant le prochain bulletin officiel.`
  );

  return {
    summary,
    insights:        insights.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

// ── Route POST /api/reports/from-bulletin ────────────────────────────────────
router.post("/from-bulletin", auth, async (req, res) => {
  const { bulletinRef, kpis, pointsCritiques, pointsSurveillance, pointsStables, pointsARetirer } = req.body;
  const payload = { bulletinRef, kpis, pointsCritiques, pointsSurveillance, pointsStables, pointsARetirer };

  // Si une clé Groq est configurée, on la tente en premier (qualité supérieure).
  // En cas d'échec ou d'absence de clé, le moteur par règles prend le relais
  // automatiquement — l'IA fonctionne toujours, même sans internet.
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
      const GROQ_MODEL = "llama3-8b-8192";

      const critiquesText    = (pointsCritiques   || []).map(p => `- ${p.description || p.id} (${p.depassements || 0} dépass., dernière: ${p.derniere ?? "—"} UFC/cm², seuil: ${p.seuil})`).join("\n");
      const surveillanceText = (pointsSurveillance|| []).map(p => `- ${p.description || p.id} (tendance: ${p.tendance}, dernière: ${p.derniere ?? "—"} UFC/cm²)`).join("\n");
      const stablesText      = (pointsStables     || []).slice(0, 3).map(p => `- ${p.description || p.id} (moy: ${p.avg} UFC/cm², ${p.nbReleves} relevés)`).join("\n");
      const retraitText      = (pointsARetirer    || []).map(p => `- ${p.description || p.id} (${p.semStable || p.nbReleves} sem. stables, moy: ${p.avg} UFC/cm²)`).join("\n");

      const prompt = `Tu es expert en microbiologie alimentaire et hygiène industrielle (normes NF EN ISO 18593, CE 2073/2005).
Analyse ce rapport InnoFaso SA (Burkina Faso) et génère une synthèse professionnelle.

RAPPORT : ${bulletinRef || "Analyse périodique"}
KPIs : ${kpis?.total ?? 0} points | Conformes : ${kpis?.conformes ?? 0} (${kpis?.taux ?? 0}%) | En surveillance : ${kpis?.surv ?? 0} | Critiques : ${kpis?.crits ?? 0}
${critiquesText    ? `\nPOINTS CRITIQUES :\n${critiquesText}` : "\nAucun point critique."}
${surveillanceText ? `\nEN SURVEILLANCE :\n${surveillanceText}` : ""}
${stablesText      ? `\nPOINTS STABLES :\n${stablesText}` : ""}
${retraitText      ? `\nCANDIDATS RETRAIT :\n${retraitText}` : ""}

Réponds UNIQUEMENT en JSON valide :
{"summary":"Résumé 2-3 phrases professionnel en français.","insights":["Obs 1","Obs 2","Obs 3"],"recommendations":["Action 1","Action 2","Action 3"]}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let groqRes;
      try {
        groqRes = await fetch(GROQ_URL, {
          method:  "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 1024, temperature: 0.3 }),
          signal:  controller.signal,
        });
      } finally { clearTimeout(timer); }

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const content  = groqData.choices?.[0]?.message?.content?.trim();
        if (content) {
          try {
            const match = content.match(/\{[\s\S]*\}/);
            return res.json({ synthesis: JSON.parse(match ? match[0] : content) });
          } catch { /* JSON invalide → fallback règles */ }
        }
      }
    } catch { /* timeout ou réseau → fallback règles */ }
  }

  // Moteur par règles — toujours disponible, zéro dépendance externe
  res.json({ synthesis: synthèseParRègles(payload) });
});

module.exports = router;
