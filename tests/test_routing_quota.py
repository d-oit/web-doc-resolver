import os
import sqlite3

from scripts.routing_memory import RoutingMemory


def test_routing_memory_db_init():
    db_path = "test_routing.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    RoutingMemory(db_path=db_path)
    assert os.path.exists(db_path)

    # Check if table exists
    conn = sqlite3.connect(db_path)
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='provider_quota_usage'"
    )
    assert cursor.fetchone() is not None
    conn.close()
    os.remove(db_path)


def test_increment_provider_usage():
    db_path = "test_increment.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    rm = RoutingMemory(db_path=db_path)
    rm.increment_provider_usage("exa_mcp")

    usage = rm.get_exa_monthly_usage()
    assert usage == 1

    rm.increment_provider_usage("exa_mcp")
    usage = rm.get_exa_monthly_usage()
    assert usage == 2

    os.remove(db_path)


def test_unknown_provider_usage():
    db_path = "test_unknown.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    rm = RoutingMemory(db_path=db_path)
    usage = rm.get_exa_monthly_usage()
    assert usage == 0

    os.remove(db_path)


def test_different_month_reset():
    db_path = "test_month.db"
    if os.path.exists(db_path):
        os.remove(db_path)

    rm = RoutingMemory(db_path=db_path)

    # Manually insert a record for a different month
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO provider_quota_usage (provider, year_month, call_count, updated_at) VALUES (?, ?, ?, ?)",
        ("exa_mcp", "2000-01", 10, 0),
    )
    conn.commit()
    conn.close()

    # Current month should still be 0
    usage = rm.get_exa_monthly_usage()
    assert usage == 0

    # Increment for current month
    rm.increment_provider_usage("exa_mcp")
    assert rm.get_exa_monthly_usage() == 1

    os.remove(db_path)
