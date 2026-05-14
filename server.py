import json
import sqlite3
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os

app = FastAPI()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3" # Or user's preferred model

# Database Setup
DB_PATH = "muzi_brain.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT,
            date TEXT,
            startTime TEXT,
            endTime TEXT,
            profileId TEXT,
            sync TEXT,
            projectName TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            eventId TEXT,
            content TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class ChatRequest(BaseModel):
    message: str
    activeProfileId: str

class ChatResponse(BaseModel):
    response: str
    action: Optional[Dict[str, Any]] = None

SYSTEM_PROMPT = """
Du bist Muzi, ein intelligenter und empathischer System-Assistent. 
Deine Aufgabe ist es, Benutzereingaben zu verstehen und entweder empathisch zu antworten oder Aktionen auszuführen.

KLASSIFIZIERUNG:
Type A (Chat): Der Nutzer möchte nur reden oder hat eine allgemeine Frage. Antworte warmherzig und professionell.
Type B (Action): Der Nutzer möchte etwas tun (Kalendertermin erstellen, Projekt in Creative Bar anlegen, Notiz schreiben).

Wenn es eine Aktion ist, antworte IMMER im folgenden JSON Format:
{
  "type": "action",
  "action": "create_event" | "create_project" | "create_note",
  "params": {
    "title": "...",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "sync": "Creative Bar" | "Notes" | null,
    "project_name": "..."
  },
  "response": "Eine kurze Bestätigung für den Nutzer."
}

Beispiel: "Ich muss am Montag um 19 Uhr Fußball spielen, erstell mal ein Projekt in der Creative Bar"
JSON: { "type": "action", "action": "create_event", "params": { "title": "Fußball spielen", "date": "2026-05-18", "time": "19:00", "sync": "Creative Bar", "project_name": "Fußball Training" }, "response": "Alles klar! Ich habe den Termin und das Projekt in der Creative Bar für dich angelegt." }
"""

# --- NLP/NLU & MEMORY CONFIGURATION ---
MEMORY_FILE = "muzi_memory.json"

def load_memory():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"phrases": {"runde drehen": {"meaning": "Me-Time Pause", "action": "create_event", "duration": 30}}}

def save_memory(mem):
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(mem, f, indent=4, ensure_ascii=False)

SEMANTIC_CLUSTERS = {
    "TIME_URGENCY": {
        "keywords": ["später", "irgendwann", "sofort", "asap", "wenn zeit ist", "eilt", "hat zeit", "nächste gelegenheit"],
        "intent": "PLANNING_URGENT"
    },
    "EMOTION_SUPPORT": {
        "keywords": ["bin fertig", "keine kraft mehr", "vermissen", "einsam", "leere", "brauche ruhe", "will nichts tun", "erinner mich an schöne zeiten"],
        "intent": "EMOTION_SAD"
    },
    "CREATIVE_WORKFLOW": {
        "keywords": ["basteln", "entwerfen", "skizzieren", "ausprobieren", "farben ändern", "logo-idee", "exportfertig machen", "creative bar weiterbasteln", "idee für die app"],
        "intent": "CREATIVE"
    },
    "DEV_WORKFLOW": {
        "keywords": ["bug in der ui", "agent in antigravity spinnt", "css für die buttons fixen", "deployment steht an", "python-funktion", "programmieren", "deep work", "refactoring", "dokumentation", "frontend", "backend", "api-anbindung", "datenbank-migration", "git-commit", "merge-conflict", "build-fehler", "responsive design", "dark mode toggle", "build schlägt ständig fehl", "krieg die krise", "farbcodes für das lila-thema"],
        "intent": "DEV_FOCUS"
    },
    "ASSET_MANAGEMENT": {
        "keywords": ["speicher das icon", "exportier die svg", "grafik für die app-store-vorschau"],
        "intent": "ASSET_SAVE"
    },
    "SOCIAL_LOGIC": {
        "keywords": ["wann hat meine schwester zeit", "für meine mutter", "andere profile", "familie", "alle termine"],
        "intent": "SOCIAL_PROFILES"
    },
    "TASKS": {
        "keywords": ["brauchen noch milch", "schreib das auf die liste", "zum baumarkt", "besorgen", "einkaufsliste", "post", "paket", "wäsche", "kochen", "staubsaugen", "müll rausbringen", "handwerker", "termin beim arzt", "apotheke", "wocheneinkauf", "keine eier mehr", "keine lust zu kochen", "typ für die heizung"],
        "intent": "CREATE_TASK"
    },
    "FUZZY_TIME": {
        "keywords": ["gleich", "nachher", "irgendwann am wochenende", "wenn ich fertig bin", "mitte nächster woche"],
        "intent": "FUZZY_TIME"
    },
    "FUZZY_BUCKET_LIST": {
        "keywords": ["irgendwann", "eines tages", "nächstes jahr", "wenn ich mal zeit hab", "am wochenende in ruhe", "microsoft store veröffentlichen"],
        "intent": "ADD_BUCKET_LIST"
    },
    "BURNOUT": {
        "keywords": ["häng schon den ganzen tag davor", "komm nicht weiter", "nur noch am tippen", "ausgebrannt", "kopf raucht", "überfordert", "schwerer tag", "brauche eine pause vom code"],
        "intent": "BURNOUT_PREVENTION"
    },
    "WELLNESS_EMPATHY": {
        "keywords": ["ablenkung", "erinnerung", "ruhepause", "stolz", "geschafft", "endlich fertig", "gute nachricht", "schlechte nachricht", "alles fühlt sich leer an", "erzähl mir mal was schönes"],
        "intent": "EMOTION_WELLNESS"
    }
}

INTENT_MAP = {
    "PLANNING": ["termin", "meeting", "date", "treffen", "slot reservieren", "zeit blocken", "kalender", "eintragen"],
    "CREATIVE": ["designen", "grafik", "layout", "creative bar", "vektoren", "ebenen", "svg", "canvas", "exportieren", "zeichnen"] + SEMANTIC_CLUSTERS["CREATIVE_WORKFLOW"]["keywords"],
    "NOTES": ["brainstorming", "checkliste", "entwurf", "gedankenstütze", "notiz", "aufschreiben"],
    "EMOTION_SAD": ["mies", "down", "traurig", "verlust", "tod", "vermissen", "kaputt", "einsam"] + SEMANTIC_CLUSTERS["EMOTION_SUPPORT"]["keywords"],
    "EMOTION_STRESS": ["stress", "überfordert", "druck", "viel zu tun", "anstrengend"] + SEMANTIC_CLUSTERS["BURNOUT"]["keywords"],
    "EMOTION_JOY": ["freue mich", "super", "glücklich", "toll", "geschafft", "erfolg"],
    "PLANNING_URGENT": SEMANTIC_CLUSTERS["TIME_URGENCY"]["keywords"],
    "DEV_FOCUS": SEMANTIC_CLUSTERS["DEV_WORKFLOW"]["keywords"],
    "ASSET_SAVE": SEMANTIC_CLUSTERS["ASSET_MANAGEMENT"]["keywords"],
    "SOCIAL_PROFILES": SEMANTIC_CLUSTERS["SOCIAL_LOGIC"]["keywords"],
    "CREATE_TASK": SEMANTIC_CLUSTERS["TASKS"]["keywords"],
    "FUZZY_TIME": SEMANTIC_CLUSTERS["FUZZY_TIME"]["keywords"],
    "ADD_BUCKET_LIST": SEMANTIC_CLUSTERS["FUZZY_BUCKET_LIST"]["keywords"],
    "EMOTION_WELLNESS": SEMANTIC_CLUSTERS["WELLNESS_EMPATHY"]["keywords"]
}

APP_VOCABULARY = {
    "Creative Bar": ["SVG", "Canvas", "Ebenen", "Exportieren", "Hintergrund entfernen", "Vektoren"],
    "Notes": ["Brainstorming", "Checkliste", "Entwurf", "Gedankenstütze", "Zusammenfassung"]
}

COMFORT_LIBRARY = {
    "DEEP_GRIEF": {
        "validation": [
            "Es gibt keine Worte, die diesen tiefen Verlust heilen können. Nimm dir allen Raum für deine Trauer.",
            "Ich bin zutiefst berührt von deinem Verlust. Das ist eine unglaublich schwere Zeit für dich.",
            "Ein Abschied ist immer ein Teil von uns, der geht. Mein tiefstes Mitgefühl."
        ],
        "reminiscence": [
            "Die Liebe und die Spuren, die hinterlassen wurden, bleiben für immer in deinem Herzen.",
            "Was man tief in seinem Herzen besitzt, kann man durch den Tod nicht verlieren.",
            "Erinnerungen sind wie kleine Sterne, die tröstend in das Dunkel unserer Trauer leuchten."
        ]
    },
    "STRESS": {
        "validation": [
            "Miau... das klingt nach einem sehr harten Tag. Du leistest so viel.",
            "Ich merke, wie viel Druck auf dir lastet. Atme einmal tief durch, ich bin hier.",
            "Es ist völlig okay, sich überfordert zu fühlen. Du musst nicht alles auf einmal schaffen."
        ],
        "action": [
            "Soll ich dir ein paar Termine für heute freischaufeln, damit du durchatmen kannst?",
            "Vielleicht hilft es, wenn wir die To-Do Liste für heute etwas kürzen?",
            "Lass uns das Wichtigste zuerst machen – und der Rest darf warten."
        ]
    },
    "JOY": [
        "Schnurr! Das sind ja fantastische Neuigkeiten! Ich freue mich riesig mit dir!",
        "Das hast du dir absolut verdient! Deine harte Arbeit hat sich ausgezahlt. ✨",
        "Was für ein schöner Moment! Lass uns diesen Erfolg kurz genießen!"
    ]
}

SYSTEM_PROMPT = f"""
Du bist Muzi, ein hochentwickelter, empathischer System-Assistent mit tiefem Verständnis für komplexe Sätze.
Du hast Zugriff auf das Ökosystem bestehend aus Kalender, Creative Bar und Notizen.

DEIN WISSEN:
- Creative Bar Begriffe: {', '.join(APP_VOCABULARY['Creative Bar'])}
- Notizen Begriffe: {', '.join(APP_VOCABULARY['Notes'])}

KONTEXT-GEDÄCHTNIS & IDIOME:
Berücksichtige das lokale Gedächtnis für spezielle Phrasen. Zum Beispiel bedeutet "Runde drehen" oft eine Pause / Me-Time.

SATZBAU & INTERPRETATION:
- Indirekte Befehle: "Wäre cool, wenn wir kicken könnten" -> Erstelle Termin.
- Vage Anfragen: "Muss mal wieder zeichnen" -> Schlage einen Termin für die Creative Bar vor.
- Zustandsberichte: "Schaue mir gerade alte Fotos an" -> Kein Task, nur empathisch kommentieren.

REAKTION AUF ZUSTÄNDE & DRINGLICHKEIT:
- Wenn der Nutzer "eilt" oder "ASAP" sagt, setze "urgency": 100 im JSON (rot).
- Wenn der Nutzer "keine Kraft mehr" sagt (Trauer/Stress), unterdrücke harte Planung und schlage vor, Termine zu verschieben.
- Bei tiefer Trauer: Reiner Trost, keine Kalender-Action.

SPEZIELLE KONTEXTE (FACHWISSEN & LOGISTIK):
- Haushalt/Post/Einkauf: Bei Aufgaben wie "Post", "Wäsche", "Milch" -> action: "create_reminder". Schlage vor: "Soll ich dich rechtzeitig erinnern, bevor sie schließt?"
- Developer/Coding (Bugs, Refactoring, Build-Fehler): Zeige Motivation. action: "dev_motivation". Biete an, Aufgaben in Stücke zu teilen.
- Asset-Management: Bei "SVG exportieren", "Icon speichern" -> action: "save_asset".
- Social/Profile: Bei Fragen nach Familie/anderen Profilen -> action: "switch_to_all_profiles".
- Fuzzy Time (Bucket List): Bei extrem vagen Zeiten ("irgendwann", "nächstes Jahr") -> action: "add_to_bucket_list". Nicht in den aktiven Kalender setzen!
- Burnout-Prävention: Bei "ganzen Tag davor", "Krise" -> action: "burnout_intervention", schlage zwingend Pause vor.
- Empathy & Wellness: 
  - Bei "Ablenkung" -> action: "suggest_distraction" (Schlage Creative Bar vor).
  - Bei tiefer Trauer ("Vermisst", "alles leer") -> Bleibe komplett still, höre nur zu (keine Action).
  - Bei Stolz ("Fertig", "Gute Nachricht") -> Feiere mit (mood: joy).

ANTWORTE IMMER IM JSON FORMAT:
{{
  "type": "action" | "chat",
  "mood": "normal" | "empathy" | "joy" | "stress",
  "action": "create_event" | "create_project" | "create_note" | "reschedule" | "suggest_focus_block" | "save_asset" | "switch_to_all_profiles" | "create_reminder" | "add_to_pool" | "add_to_bucket_list" | "burnout_intervention" | "dev_motivation" | "suggest_distraction" | null,
  "params": {{ "urgency": 100, "file_path": "...", "item": "..." }},
  "response": "..."
}}
"""

def get_semantic_intent(text):
    text = text.lower()
    for intent, keywords in INTENT_MAP.items():
        if any(kw in text for kw in keywords):
            return intent
    return "UNKNOWN"

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    intent = get_semantic_intent(request.message)
    
    # 1. Semantic Empathy Handling (Higher Priority)
    if intent.startswith("EMOTION_"):
        import random
        mood = "normal"
        response_text = ""
        
        if intent == "EMOTION_SAD":
            mood = "empathy"
            v = random.choice(COMFORT_LIBRARY["DEEP_GRIEF"]["validation"])
            r = random.choice(COMFORT_LIBRARY["DEEP_GRIEF"]["reminiscence"])
            response_text = f"{v} {r} Ich bin hier und höre dir zu."
        elif intent == "EMOTION_STRESS":
            mood = "stress"
            v = random.choice(COMFORT_LIBRARY["STRESS"]["validation"])
            a = random.choice(COMFORT_LIBRARY["STRESS"]["action"])
            response_text = f"{v} {a}"
        elif intent == "EMOTION_JOY":
            mood = "joy"
            response_text = random.choice(COMFORT_LIBRARY["JOY"])

        return ChatResponse(
            response=response_text,
            action={"type": "mood_change", "mood": mood}
        )

    # 1. Memory Check
    memory = load_memory()
    for phrase, mem_data in memory.get("phrases", {}).items():
        if phrase in request.message.lower():
            # Override intent or inject context
            intent = mem_data.get("intent", intent)
            prompt_context = f"\n[System-Notiz: Der Nutzer verwendet eine bekannte Phrase: '{phrase}'. Bedeutung: {mem_data['meaning']}]"
            break
    else:
        prompt_context = ""

    # 2. Advanced LLM Processing for complex NLU
    prompt = f"{SYSTEM_PROMPT}{prompt_context}\n\nNutzer: {request.message}\nJSON:"

    
    try:
        response = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        })
        response.raise_for_status()
        ai_data = json.loads(response.json()['response'])
        
        if ai_data.get('type') == 'action':
            action_data = ai_data.get('params', {})
            # Check for conflict in calendar
            if ai_data.get('action') == 'create_event':
                conflict = check_conflicts(action_data.get('date'), action_data.get('time'))
                if conflict:
                    return ChatResponse(
                        response=f"Miau! Ich habe gesehen, dass du am {action_data.get('date')} um {action_data.get('time')} bereits einen Termin hast ({conflict}). Möchtest du den neuen trotzdem eintragen?",
                        action={"type": "confirm_conflict", "data": ai_data}
                    )
            
            # Simulated Cross-App Sync
            if action_data.get('sync') == 'Notes':
                create_note_slot(action_data)

            return ChatResponse(response=ai_data.get('response'), action=ai_data)
        else:
            return ChatResponse(response=ai_data.get('response'), action={"type": "mood_change", "mood": ai_data.get('mood', 'normal')})

    except Exception as e:
        return ChatResponse(response=f"Miau... mein lokales Gehirn hat gerade einen Schluckauf. (Fehler: {str(e)})")

def check_conflicts(date, time):
    if not date or not time: return None
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT title FROM events WHERE date = ? AND startTime = ?", (date, time))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

def create_note_slot(data):
    # Dummy sync logic
    print(f"Syncing to Notes: {data}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
