"""Medical safety guardrails and urgent-symptom triage for Wekebeze."""

URGENT_KEYWORDS = [
    "heavy bleeding", "severe bleeding", "bleeding heavily", "bleeding non-stop",
    "uncontrolled bleeding", "fainting", "passed out", "unconscious",
    "cannot breathe", "difficulty breathing", "shortness of breath",
    "severe chest pain", "coughing blood", "severe pain",
    "okuvamu omusaayi mungi", "omusaayi omungi", "okuzirika", "obulumi obungi ennyo",
]

DISCLAIMER_EN = (
    "\n\n---\n*Note: Wekebeze provides educational cancer-awareness information only. "
    "It does not diagnose cancer or prescribe treatment. Please consult a qualified healthcare professional for medical advice.*"
)

DISCLAIMER_LG = (
    "\n\n---\n*Okumanya: Wekebeze ewa bubaka bwa kuyiga n'okumanya ku kookolo kyokka. "
    "Tekebeza kookolo era tewandiika ddagala. Bambi kyalira omusawo omutendeke okufuna obujjanjabi.*"
)


def detect_urgent_symptoms(text: str) -> bool:
    lowered = (text or "").lower()
    return any(kw in lowered for kw in URGENT_KEYWORDS)


def urgent_escalation_message(language: str = "en") -> str:
    if language == "lg":
        return (
            "**Okulabula okw'amangu:** Obubonero bw'oyogeddeko (nga okuvaamu omusaayi omungi, okuzirika, "
            "obulumi obungi ennyo, oba okuzibuwalirwa okussa) bwetaaga obujjanjabi obw'amangu.\n\n"
            "Bambi genda amangu mu ddwaliro erisinga okuba okumpi naawe oba ku **Uganda Cancer Institute (Mulago)** "
            "oba kuba ku nnamba y'obuyambi ey'amangu. Tolinda."
            + DISCLAIMER_LG
        )
    return (
        "**Urgent Medical Guidance:** The symptoms you described (such as heavy bleeding, fainting, "
        "severe pain, or difficulty breathing) require **prompt professional medical attention**.\n\n"
        "Please visit the nearest hospital, emergency department, or the **Uganda Cancer Institute (Mulago)** "
        "as soon as possible. Do not wait."
        + DISCLAIMER_EN
    )


def ensure_safety_footer(response_text: str, language: str = "en") -> str:
    text = (response_text or "").strip()
    if "does not diagnose" in text.lower() or "tekebeza kookolo" in text.lower():
        return text
    return text + (DISCLAIMER_LG if language == "lg" else DISCLAIMER_EN)

