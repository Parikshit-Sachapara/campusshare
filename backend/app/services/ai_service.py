import os
import json
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..models import (
    Resource,
    Booking,
    Profile,
    TrainingRecord,
    ResourceCategory,
    Department,
    ResourceStatus,
    BookingStatus,
    UserRole,
)
from .eligibility_service import EligibilityService

# 10-minute in-memory cache for AI / deterministic recommendations
# Key: (normalized_query, user_department_code, timeframe_days) -> (expiry_timestamp, payload)
_AI_RECOMMENDATION_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}

# Domain dictionary for deterministic requirement extraction
DOMAIN_KEYWORD_RULES = [
    {
        "domain": "Robotics & Automation",
        "triggers": ["robot", "robotics", "line-following", "autonomous", "motor", "rover", "drone", "actuator", "chassis", "car"],
        "categories": ["Robotics", "Electronics", "Manufacturing"],
        "resource_keywords": ["robotics", "arduino", "raspberry", "oscilloscope", "3d printer", "workstation"],
        "reason_template": "Essential for sensor integration, motor control logic, and chassis rapid prototyping.",
    },
    {
        "domain": "Cinematography & Media",
        "triggers": ["photo", "photography", "video", "film", "cinema", "documentary", "podcast", "camera", "shoot", "interview", "audio"],
        "categories": ["Photography", "Audio/Visual"],
        "resource_keywords": ["canon", "dslr", "tripod", "mic", "wireless", "projector", "studio"],
        "reason_template": "High-fidelity capture hardware and studio acoustics ideal for multimedia production.",
    },
    {
        "domain": "Embedded Systems & IoT",
        "triggers": ["embed", "iot", "sensor", "hardware", "circuit", "pcb", "microcontroller", "arduino", "esp32", "breadboard", "signal"],
        "categories": ["Electronics", "Laboratories"],
        "resource_keywords": ["arduino", "raspberry", "oscilloscope", "electronics main", "faraday"],
        "reason_template": "Provides ESD-safe bench stations, logic analyzers, and rapid prototyping microcontrollers.",
    },
    {
        "domain": "Rapid Fabrication & 3D Design",
        "triggers": ["3d", "print", "sla", "cad", "manufacturing", "rapid", "prototype", "laser", "enclosure", "fabricat"],
        "categories": ["Manufacturing", "Computing"],
        "resource_keywords": ["formlabs", "3d printer", "precision mobile workstation"],
        "reason_template": "Precision stereolithography and workstation compute power for CAD modeling and physical parts.",
    },
    {
        "domain": "Presentation & Academic Symposium",
        "triggers": ["seminar", "presentation", "conference", "symposium", "talk", "demo", "defense", "lecture"],
        "categories": ["Classrooms", "Audio/Visual"],
        "resource_keywords": ["aryabhata", "epson", "projector", "wireless pro"],
        "reason_template": "Acoustically tuned auditorium space with dual projection and conference microphone arrays.",
    },
    {
        "domain": "Applied Physics & Optics",
        "triggers": ["optics", "physics", "laser", "photon", "spectro", "wavelength", "mirror"],
        "categories": ["Laboratories"],
        "resource_keywords": ["optical rail", "physics", "spectro"],
        "reason_template": "Vibration-damped optical rails and spectral instruments calibrated for precise light measurements.",
    },
    {
        "domain": "Campus Athletics",
        "triggers": ["sport", "game", "badminton", "tournament", "racquet", "match", "court"],
        "categories": ["Sports"],
        "resource_keywords": ["badminton", "sports"],
        "reason_template": "Tournament-grade equipment sets for campus recreational and competitive sports.",
    },
]


class AiService:
    """
    CampusShare AI Project Buddy Engine.
    Provides intelligent resource discovery, requirement synthesis, real database matching,
    7-day availability verification, and alternative suggestions.
    """

    @classmethod
    def recommend_for_project(
        cls,
        db: Session,
        user: Profile,
        query: str,
        timeframe_days: int = 7,
    ) -> Dict[str, Any]:
        clean_query = query.strip()
        norm_key = f"{clean_query.lower()}:{user.department_id}:{timeframe_days}"
        now_ts = time.time()

        # 1. Check in-memory 10-minute cache
        if norm_key in _AI_RECOMMENDATION_CACHE:
            expiry, cached_data = _AI_RECOMMENDATION_CACHE[norm_key]
            if now_ts < expiry:
                return cached_data

        # 2. Extract structured needs
        extracted_needs, used_llm = cls._extract_requirements(clean_query)

        # 3. Match against REAL database resources
        recommendations, alternatives = cls._match_and_rank_resources(
            db=db,
            user=user,
            query=clean_query,
            needs=extracted_needs,
            timeframe_days=timeframe_days,
        )

        response_payload = {
            "query": clean_query,
            "badge": "AI-assisted" if used_llm else "Smart matching",
            "mode": "ai" if used_llm else "deterministic",
            "needs": extracted_needs,
            "recommendations": recommendations,
            "alternatives": alternatives,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }

        # Cache for 600 seconds (10 minutes)
        _AI_RECOMMENDATION_CACHE[norm_key] = (now_ts + 600, response_payload)
        return response_payload

    @classmethod
    def _extract_requirements(cls, query: str) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Attempts LLM-based structured requirement extraction if an API key is configured.
        Strict 8-second timeout; cleanly falls back to deterministic extraction.
        """
        llm_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("LLM_API_KEY")
        if llm_key:
            try:
                # Synchronous / urllib call with 8s timeout to avoid external dependencies
                import urllib.request
                prompt = (
                    "Extract resource needs for this university project inquiry as JSON array with format:\n"
                    '[{"keyword": "...", "category": "...", "priority": "high"|"medium"}].\n'
                    f"User inquiry: {query}"
                )
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={llm_key}"
                data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    resp_json = json.loads(resp.read().decode("utf-8"))
                    text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    clean_text = text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    parsed = json.loads(clean_text)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        return parsed, True
            except Exception:
                # Clean fallback to deterministic rules
                pass

        # Deterministic extraction
        query_lower = query.lower()
        needs: List[Dict[str, Any]] = []
        matched_rules = []

        for rule in DOMAIN_KEYWORD_RULES:
            if any(t in query_lower for t in rule["triggers"]):
                matched_rules.append(rule)
                for cat in rule["categories"]:
                    needs.append({
                        "keyword": rule["domain"],
                        "category": cat,
                        "priority": "high" if len(needs) == 0 else "medium",
                    })

        if not needs:
            # Fallback default
            needs.append({
                "keyword": "General Project Equipment",
                "category": "Electronics",
                "priority": "medium",
            })

        return needs, False

    @classmethod
    def _match_and_rank_resources(
        cls,
        db: Session,
        user: Profile,
        query: str,
        needs: List[Dict[str, Any]],
        timeframe_days: int = 7,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        all_resources = db.query(Resource).filter(
            Resource.status != ResourceStatus.ARCHIVED
        ).all()

        query_lower = query.lower()
        target_categories = {n.get("category", "").lower() for n in needs}

        scored_resources: List[Tuple[float, Resource, str]] = []

        for res in all_resources:
            score = 0.0
            match_reasons = []

            cat_name = res.category.name.lower() if res.category else ""
            res_name = res.name.lower()
            res_desc = (res.description or "").lower()

            # Category match
            if any(tc in cat_name for tc in target_categories):
                score += 35.0
                match_reasons.append(f"Belongs to target discipline {res.category.name}")

            # Specific rule keyword matches
            for rule in DOMAIN_KEYWORD_RULES:
                if any(t in query_lower for t in rule["triggers"]):
                    for kw in rule["resource_keywords"]:
                        if kw in res_name or kw in res_desc:
                            score += 25.0
                            match_reasons.append(rule["reason_template"])
                            break

            # Direct query word matches
            words = [w for w in query_lower.split() if len(w) > 3]
            for w in words:
                if w in res_name:
                    score += 15.0
                elif w in res_desc:
                    score += 5.0

            # Active status bonus
            if res.status == ResourceStatus.AVAILABLE:
                score += 10.0

            if score > 0:
                chosen_reason = match_reasons[0] if match_reasons else f"Matches project keyword and required {res.category.name if res.category else 'facility'} specs."
                scored_resources.append((score, res, chosen_reason))

        # Sort descending by score
        scored_resources.sort(key=lambda x: x[0], reverse=True)

        now = datetime.now(timezone.utc)
        recommendations = []
        alternatives = []

        # Check real availability and student eligibility for top candidates
        for score, res, reason in scored_resources[:6]:
            # 1. Check user eligibility
            is_eligible = True
            eligibility_note = "Eligible for immediate booking."

            rule = res.rule
            if rule:
                if rule.allowed_roles and user.role.value not in rule.allowed_roles:
                    is_eligible = False
                    eligibility_note = f"Restricted to {', '.join(rule.allowed_roles)} roles."
                elif rule.allowed_department_ids and (user.department_id not in rule.allowed_department_ids if user.department_id else True):
                    is_eligible = False
                    eligibility_note = "Reserved for specific academic departments."
                elif rule.required_training_id:
                    has_training = db.query(TrainingRecord).filter(
                        TrainingRecord.user_id == user.id,
                        TrainingRecord.training_id == rule.required_training_id,
                        TrainingRecord.expires_at > now,
                    ).first()
                    if not has_training:
                        is_eligible = False
                        t_name = rule.required_training.name if rule.required_training else "safety certification"
                        eligibility_note = f"Requires '{t_name}'."
            elif res.is_restricted and user.role != UserRole.ADMIN:
                is_eligible = False
                eligibility_note = "Restricted campus facility; requires department authorization."

            # 2. Check real slots in next 7 days
            next_free_slot = None
            free_slots = EligibilityService.suggest_next_free_slots(
                db=db,
                resource=res,
                start_ts=now + timedelta(hours=2),
                duration_minutes=res.slot_minutes or 60,
                count=1,
            )
            if free_slots:
                first_slot = free_slots[0]
                try:
                    s_dt = datetime.fromisoformat(first_slot["start_ts"])
                    e_dt = datetime.fromisoformat(first_slot["end_ts"])
                    next_free_slot = {
                        "start": s_dt.strftime("%a, %b %d %I:%M %p"),
                        "end": e_dt.strftime("%I:%M %p"),
                        "start_iso": first_slot["start_ts"],
                        "end_iso": first_slot["end_ts"],
                    }
                except Exception:
                    next_free_slot = {
                        "start": "Tomorrow, 10:00 AM",
                        "end": "11:00 AM",
                        "start_iso": first_slot["start_ts"],
                        "end_iso": first_slot["end_ts"],
                    }

            is_available = (res.status == ResourceStatus.AVAILABLE) and (next_free_slot is not None)
            first_img = res.images[0].url if res.images else None

            rec_item = {
                "id": str(res.id),
                "name": res.name,
                "category": res.category.name if res.category else "General",
                "department": res.department.code if res.department else "GEN",
                "location": res.location,
                "type": res.resource_type.value if hasattr(res.resource_type, "value") else str(res.resource_type),
                "image_url": first_img,
                "score": round(score, 1),
                "reason": reason,
                "is_eligible": is_eligible,
                "eligibility_note": eligibility_note,
                "is_available": is_available,
                "next_free_slot": next_free_slot,
                "requires_approval": res.approval_required,
                "requires_training": res.training_required,
            }

            if is_available and is_eligible:
                recommendations.append(rec_item)
            else:
                # Marked as alternative or secondary option with clear reason
                alternatives.append(rec_item)

        # Ensure at least up to 4 recommendations
        if len(recommendations) < 3 and alternatives:
            needed = 3 - len(recommendations)
            recommendations.extend(alternatives[:needed])
            alternatives = alternatives[needed:]

        return recommendations[:5], alternatives[:3]

    @classmethod
    def get_recommended_for_you(cls, db: Session, user: Profile, limit: int = 4) -> List[Dict[str, Any]]:
        """
        Generates personalized 'Recommended for you' row for student dashboard
        based on department, past bookings, and high-utilization campus assets.
        """
        now = datetime.now(timezone.utc)
        query = db.query(Resource).filter(
            Resource.status == ResourceStatus.AVAILABLE
        )
        if user.department_id:
            query = query.filter(
                or_(
                    Resource.department_id == user.department_id,
                    Resource.is_restricted.is_(False),
                )
            )

        resources = query.order_by(Resource.popularity_count.desc()).limit(limit).all()

        results = []
        for r in resources:
            first_img = r.images[0].url if r.images else None
            results.append({
                "id": str(r.id),
                "name": r.name,
                "category": r.category.name if r.category else "General",
                "department": r.department.code if r.department else "GEN",
                "location": r.location,
                "type": r.resource_type.value if hasattr(r.resource_type, "value") else str(r.resource_type),
                "image_url": first_img,
                "deposit_amount": float(r.deposit_amount or 0.0),
                "approval_required": r.approval_required,
                "requires_training": r.training_required,
                "match_reason": f"Popular in {r.department.name if r.department else 'Campus'} workflows",
            })
        return results

    @classmethod
    def get_similar_resources(cls, db: Session, resource_id: uuid.UUID, limit: int = 4) -> List[Dict[str, Any]]:
        """
        Finds similar resources sharing the same category or department for resource detail view.
        """
        target = db.query(Resource).filter_by(id=resource_id).first()
        if not target:
            return []

        similar = db.query(Resource).filter(
            Resource.id != resource_id,
            Resource.status != ResourceStatus.ARCHIVED,
            or_(
                Resource.category_id == target.category_id,
                Resource.department_id == target.department_id,
            ),
        ).order_by(Resource.popularity_count.desc()).limit(limit).all()

        results = []
        for r in similar:
            first_img = r.images[0].url if r.images else None
            results.append({
                "id": str(r.id),
                "name": r.name,
                "category": r.category.name if r.category else "General",
                "department": r.department.code if r.department else "GEN",
                "location": r.location,
                "type": r.resource_type.value if hasattr(r.resource_type, "value") else str(r.resource_type),
                "image_url": first_img,
                "approval_required": r.approval_required,
            })
        return results
