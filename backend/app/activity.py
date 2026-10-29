import json
from .models import Activity


def log(db, user, module, action, summary, details=None):
    """Records who did what, and when. The clinic admin sees every entry as an alert."""
    db.add(Activity(clinic_id=user.clinic_id, user_id=user.id, user_name=user.full_name, role=user.role, module=module, action=action,
                    summary=summary[:400], details=json.dumps(details, default=str) if details else None))
