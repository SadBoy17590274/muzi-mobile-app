import json
import random

# Core vocabulary and variations for Muzi AI Training

SUBJECTS = ["Ich", "Wir", "Man", "Können wir"]
VERBS_CREATIVE = ["basteln", "entwerfen", "skizzieren", "ausprobieren", "ändern", "exportfertig machen", "designen", "malen"]
VERBS_PLAN = ["kicken", "treffen", "besprechen", "telefonieren", "essen", "brainstormen"]
TIME_VAGUE = ["später", "irgendwann mal", "nächste woche", "wenn zeit ist", "bei gelegenheit", "demnächst"]
TIME_URGENT = ["sofort", "asap", "noch heute", "dringend", "gleich"]
EMOTION_DOWN = ["bin fertig", "habe keine kraft mehr", "bin leer", "fühle mich down", "brauche ruhe", "will nichts tun"]
MEMORY_PHRASES = ["gehe eine runde drehen", "mache kurz die augen zu", "muss mal kurz raus", "brauche luft"]

def generate_sentence(intent_type):
    if intent_type == "CREATIVE_VAGUE":
        s = random.choice(SUBJECTS)
        v = random.choice(VERBS_CREATIVE)
        t = random.choice(TIME_VAGUE)
        return f"{s} muss {t} mal wieder was {v}."
        
    elif intent_type == "PLANNING_INDIRECT":
        v = random.choice(VERBS_PLAN)
        return f"Wäre cool, wenn wir am Freitag {v} könnten."
        
    elif intent_type == "PLANNING_URGENT":
        v = random.choice(VERBS_PLAN)
        t = random.choice(TIME_URGENT)
        return f"Wir müssen {t} {v}, das eilt!"
        
    elif intent_type == "EMOTION_SAD":
        e = random.choice(EMOTION_DOWN)
        return f"Heute geht gar nichts, ich {e}."
        
    elif intent_type == "MEMORY_METIME":
        m = random.choice(MEMORY_PHRASES)
        return f"Ich {m}."

def generate_dataset(num_samples=1000):
    intents = ["CREATIVE_VAGUE", "PLANNING_INDIRECT", "PLANNING_URGENT", "EMOTION_SAD", "MEMORY_METIME"]
    dataset = []
    
    for _ in range(num_samples):
        intent = random.choice(intents)
        sentence = generate_sentence(intent)
        
        # Simple rule-based labeling
        action = "none"
        if intent == "CREATIVE_VAGUE": action = "suggest_creative_slot"
        elif intent == "PLANNING_INDIRECT": action = "create_event"
        elif intent == "PLANNING_URGENT": action = "create_event_urgent"
        elif intent == "EMOTION_SAD": action = "reschedule"
        elif intent == "MEMORY_METIME": action = "create_event_metime"
        
        dataset.append({
            "text": sentence,
            "intent": intent,
            "expected_action": action
        })
        
    return dataset

if __name__ == "__main__":
    data = generate_dataset(1000)
    with open("muzi_training_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"Erfolgreich {len(data)} Trainingssätze generiert in 'muzi_training_data.json'.")
    print("Beispiel:")
    print(json.dumps(data[0], indent=2, ensure_ascii=False))
