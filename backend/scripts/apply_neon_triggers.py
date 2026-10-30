import os
import sys

# Ensure backend is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text

def apply_triggers():
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "init_triggers.sql")
    with open(script_path, "r", encoding="utf-8") as f:
        sql = f.read()

    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    print("Neon Triggers, GiST Exclusion Constraints, and Extensions applied successfully!")

if __name__ == "__main__":
    apply_triggers()
