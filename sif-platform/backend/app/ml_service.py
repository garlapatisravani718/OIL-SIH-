"""Model service. main.py only calls analyze_text(). To plug in a real model,
set MODEL_PATH to a joblib sklearn pipeline (text -> predict_proba) or edit predict_sif()."""
import os, re

MODEL_PATH = os.getenv("MODEL_PATH", "models/sif_model.joblib")
_model = None
if os.path.exists(MODEL_PATH):
    import joblib
    _model = joblib.load(MODEL_PATH)

RULES = {
    "Energy Isolation": ["energized", "energised", "electrical panel", "isolation", "lockout", "loto", "live wire", "de-energ"],
    "Hot Work": ["hot work", "welding", "grinding", "cutting", "spark", "flame"],
    "Confined Space": ["confined space", "tank entry", "vessel entry", "gas test", "manhole", "tank"],
    "Line of Fire": ["suspended load", "below a suspended", "under the load", "line of fire", "crane", "lifting", "falling object", "sling"],
    "Work at Height": ["harness", "scaffold", "fall from", "at height", "ladder", "roof"],
}
HAZARD = {
    "Energy Isolation": "Stored/live electrical energy", "Hot Work": "Fire / explosion ignition source",
    "Confined Space": "Toxic or oxygen-deficient atmosphere", "Line of Fire": "Struck by moving or falling object",
    "Work at Height": "Fall from height", "Other": "General workplace hazard",
}
BARRIER_WORDS = ["without", "no barricade", "not barricaded", "not verified", "not completed", "bypassed",
                 "missing", "not performed", "no permit", "not tested", "not isolated", "no isolation"]
ACTIVITIES = ["hot work", "maintenance", "electrical work", "confined space", "lifting", "drilling", "housekeeping"]


def _sentences(t):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if s.strip()]


def predict_sif(text: str, rule: str, barrier_hits: int):
    """Returns (is_sif, confidence 0-1). Replace with the real model."""
    if _model is not None:
        p = float(_model.predict_proba([text])[0][1])
        return p >= 0.5, max(p, 1 - p)
    score = 0.15 + (0.4 if rule != "Other" else 0) + min(barrier_hits, 2) * 0.17
    if re.search(r"housekeeping|papers|walkway|stationery", text.lower()) and rule == "Other":
        score = 0.1
    score = min(score, 0.97)
    return score >= 0.5, round(max(score, 1 - score), 2)


def analyze_text(text: str, activity: str = "") -> dict:
    low = text.lower()
    scores = {r: sum(k in low for k in kws) for r, kws in RULES.items()}
    rule = max(scores, key=scores.get) if max(scores.values()) > 0 else "Other"
    barriers = [b for b in BARRIER_WORDS if b in low]
    is_sif, conf = predict_sif(text, rule, len(barriers))
    priority = "High" if is_sif and conf >= 0.8 else "Medium" if is_sif else "Low"
    sents = _sentences(text)
    act = next((s for s in sents if re.search(r"\b(without|started|entered|working|worker|bypass)", s.lower())), "")
    cond = next((s for s in sents if re.search(r"\b(open|energi[sz]ed|leak|damaged|missing|blocked|no barricade)", s.lower())), "")
    if not activity:
        activity = next((a.title() for a in ACTIVITIES if a in low), "General")
    return {
        "sif": is_sif, "confidence": conf, "priority": priority, "life_saving_rule": rule,
        "hazard": HAZARD[rule], "unsafe_action": act, "unsafe_condition": cond,
        "barrier_failure": ", ".join(barriers) if barriers else "None detected",
        "potential_consequence": "Serious injury / fatality" if is_sif else "Minor injury or none",
        "keywords": sorted({k for kws in RULES.values() for k in kws if k in low} | set(barriers)),
        "evidence": [s for s in sents if any(k in s.lower() for k in RULES.get(rule, []) + BARRIER_WORDS)][:3],
    }
