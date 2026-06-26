const express = require("express");
const auth    = require("../middleware/auth");

const router = express.Router();

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

// POST /api/reports/from-bulletin
// Synthèse IA (Groq) à partir des statistiques microbiologiques calculées côté
// frontend. Si GROQ_API_KEY est absent ou si l'appel échoue, on répond toujours
// 200 avec { synthesis: { unavailable: true } } — le frontend affiche un
// message de repli plutôt qu'une erreur.
router.post("/from-bulletin", auth, async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.json({ synthesis: { unavailable: true } });
  }

  try {
    const {
      bulletinRef,
      kpis,
      pointsCritiques = [],
      pointsSurveillance = [],
      pointsStables = [],
      pointsARetirer = [],
    } = req.body;

    const critiquesText = pointsCritiques
      .map(p => `- ${p.description || p.id} (${p.depassements || 0} dépass., dernière: ${p.derniere ?? "—"} UFC/cm², seuil: ${p.seuil})`)
      .join("\n");

    const surveillanceText = pointsSurveillance
      .map(p => `- ${p.description || p.id} (tendance: ${p.tendance}, dernière: ${p.derniere ?? "—"} UFC/cm²)`)
      .join("\n");

    const stablesText = pointsStables
      .slice(0, 3)
      .map(p => `- ${p.description || p.id} (moy: ${p.avg} UFC/cm², ${p.nbReleves} relevés)`)
      .join("\n");

    const retraitText = pointsARetirer
      .map(p => `- ${p.description || p.id} (${p.semStable || p.nbReleves} sem. stables, moy: ${p.avg} UFC/cm²)`)
      .join("\n");

    const prompt = `Tu es expert en microbiologie alimentaire et hygiène industrielle (normes NF EN ISO 18593, CE 2073/2005).

Analyse ce rapport de surveillance pour InnoFaso SA (Burkina Faso) et génère une synthèse professionnelle.

RAPPORT : ${bulletinRef || "Analyse périodique"}
KPIs : ${kpis?.total ?? 0} points | Conformes : ${kpis?.conformes ?? 0} (${kpis?.taux ?? 0}%) | En surveillance : ${kpis?.surv ?? 0} | Critiques : ${kpis?.crits ?? 0}

${critiquesText ? `POINTS CRITIQUES :\n${critiquesText}` : "Aucun point critique."}
${surveillanceText ? `\nEN SURVEILLANCE :\n${surveillanceText}` : ""}
${stablesText ? `\nPOINTS STABLES :\n${stablesText}` : ""}
${retraitText ? `\nCANDIDATS RETRAIT :\n${retraitText}` : ""}

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
{
  "summary": "Résumé exécutif 2-3 phrases, ton professionnel, en français.",
  "insights": ["Observation 1", "Observation 2", "Observation 3"],
  "recommendations": ["Action 1", "Action 2", "Action 3"]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let groqRes;
    try {
      groqRes = await fetch(GROQ_URL, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body:   JSON.stringify({
          model:       GROQ_MODEL,
          messages:    [{ role: "user", content: prompt }],
          max_tokens:  1024,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => "");
      console.error(`Groq API error ${groqRes.status}:`, errBody);
      return res.json({ synthesis: { unavailable: true } });
    }

    const groqData = await groqRes.json();
    const content  = groqData.choices?.[0]?.message?.content?.trim();
    if (!content) return res.json({ synthesis: { unavailable: true } });

    let synthesis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      synthesis = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      // Réponse non-JSON : on l'encapsule en summary brut
      synthesis = { summary: content.slice(0, 600), insights: [], recommendations: [] };
    }

    res.json({ synthesis });
  } catch (err) {
    console.error("POST /api/reports/from-bulletin error:", err.message);
    res.json({ synthesis: { unavailable: true } });
  }
});

module.exports = router;
