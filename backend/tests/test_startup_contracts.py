from sqlalchemy import BigInteger

from app.main import app
from app.models import Project


def test_project_amount_uses_bigint_for_large_financing_values():
    assert isinstance(Project.__table__.c.amount.type, BigInteger)


def test_admin_dictionaries_route_is_registered():
    paths = {route.path for route in app.routes}
    assert "/api/v1/admin/dictionaries" in paths
