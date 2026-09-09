"""Sahal Backend API Tests — يعمل على قاعدة بيانات معزولة (sahal_test) عبر TestClient"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

# يجب أن يأتي بعد conftest (الذي يضبط env وقاعدة بيانات الاختبار)
from server import app, db, MONGO_URL

BASE = os.environ.get("TEST_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

SUFFIX = uuid.uuid4().hex[:6]
MERCHANT_EMAIL = f"test_merchant_{SUFFIX}@test.com"
SHOPPER_EMAIL = f"test_shopper_{SUFFIX}@test.com"
DRIVER_EMAIL = f"test_driver_{SUFFIX}@test.com"
PASSWORD = "Test1234!"

state = {}

client = TestClient(app)


@pytest.fixture(scope="session")
def _seed_admin():
    r = client.post("/api/seed/admin")
    assert r.status_code == 200, r.text
    r = client.post("/api/auth/login", json={"email": "admin@sahal.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    state["admin_token"] = r.json()["token"]
    state["admin_id"] = r.json()["user"]["user_id"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ----- Security: منع إنشاء admin ذاتياً -----
@pytest.mark.usefixtures("_seed_admin")
def test_register_as_admin_is_forbidden():
    r = client.post("/api/auth/register", json={
        "email": f"evil_admin_{SUFFIX}@test.com", "password": PASSWORD,
        "name": "Evil", "role": "admin"
    })
    assert r.status_code == 400, r.text


@pytest.mark.usefixtures("_seed_admin")
def test_register_invalid_role_rejected():
    r = client.post("/api/auth/register", json={
        "email": f"bad_role_{SUFFIX}@test.com", "password": PASSWORD,
        "name": "X", "role": "superadmin"
    })
    assert r.status_code == 400


# ----- Seed & Admin Login -----
@pytest.mark.usefixtures("_seed_admin")
def test_admin_me():
    r = client.get("/api/auth/me", headers=auth(state["admin_token"]))
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


@pytest.mark.usefixtures("_seed_admin")
def test_seed_admin_idempotent():
    r = client.post("/api/seed/admin")
    assert r.status_code == 200
    assert "exists" in r.json()["message"].lower()


# ----- Registration -----
@pytest.mark.usefixtures("_seed_admin")
def test_register_shopper():
    r = client.post("/api/auth/register", json={
        "email": SHOPPER_EMAIL, "password": PASSWORD,
        "name": "Test Shopper", "role": "shopper"
    })
    assert r.status_code == 200, r.text
    state["shopper_token"] = r.json()["token"]
    state["shopper_id"] = r.json()["user"]["user_id"]


@pytest.mark.usefixtures("_seed_admin")
def test_register_merchant_and_approval_flow():
    r = client.post("/api/auth/register", json={
        "email": MERCHANT_EMAIL, "password": PASSWORD,
        "name": "Test Merchant", "role": "merchant"
    })
    assert r.status_code == 200, r.text
    state["merchant_id"] = r.json()["user"]["user_id"]

    r = client.post("/api/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    assert r.status_code == 403  # بانتظار موافقة الإدارة

    r = client.patch(
        f"{API}/admin/users/{state['merchant_id']}/approve",
        params={"is_approved": True},
        headers=auth(state["admin_token"]),
    )
    assert r.status_code == 200, r.text

    r = client.post("/api/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    state["merchant_token"] = r.json()["token"]


@pytest.mark.usefixtures("_seed_admin")
def test_duplicate_register_fails():
    client.post("/api/auth/register", json={
        "email": SHOPPER_EMAIL, "password": PASSWORD,
        "name": "X", "role": "shopper"
    })
    r = client.post("/api/auth/register", json={
        "email": SHOPPER_EMAIL, "password": PASSWORD,
        "name": "X", "role": "shopper"
    })
    assert r.status_code == 400


# ----- Store + Product flow -----
@pytest.mark.usefixtures("_seed_admin")
def test_store_and_product_flow():
    r = client.post("/api/auth/register", json={
        "email": MERCHANT_EMAIL, "password": PASSWORD,
        "name": "Merchant 2", "role": "merchant"
    })
    mid = r.json()["user"]["user_id"]
    client.patch(f"{API}/admin/users/{mid}/approve", params={"is_approved": True},
                 headers=auth(state["admin_token"]))
    r = client.post("/api/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    mtok = r.json()["token"]

    # إنشاء متجر ثم موافقته ثم إنشاء منتج
    r = client.post("/api/stores", json={"name": "Test Store", "description": "desc"},
                    headers=auth(mtok))
    assert r.status_code == 200, r.text
    store_id = r.json()["store_id"]

    # لا يمكن إضافة منتج قبل موافقة المتجر
    r = client.post("/api/products", json={"name": "P", "price": 10, "stock": 5, "category": "C"},
                    headers=auth(mtok))
    assert r.status_code == 400

    r = client.patch(f"{API}/stores/{store_id}/status", params={"status": "approved"},
                     headers=auth(state["admin_token"]))
    assert r.status_code == 200

    r = client.post("/api/products", json={"name": "Test Product", "price": 19.99,
                                           "stock": 5, "category": "Electronics", "images": []},
                    headers=auth(mtok))
    assert r.status_code == 200, r.text
    state["product_id"] = r.json()["product_id"]
    state["merchant_token"] = mtok

    r = client.get("/api/products")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ----- Cart -----
@pytest.mark.usefixtures("_seed_admin")
def test_cart_flow():
    # تجهيز منتج
    _make_product()
    r = client.post(f"{API}/cart",
                    params={"product_id": state["product_id"], "quantity": 2},
                    headers=auth(state["shopper_token"]))
    assert r.status_code == 200

    # كمية غير صالحة
    r = client.post(f"{API}/cart",
                    params={"product_id": state["product_id"], "quantity": -1},
                    headers=auth(state["shopper_token"]))
    assert r.status_code == 400

    r = client.get("/api/cart", headers=auth(state["shopper_token"]))
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.usefixtures("_seed_admin")
def test_checkout_mock_and_stock_atomicity():
    _make_product()
    # نأخذ الكمية الكاملة في السلة ثم نعدّل عليها
    client.post(f"{API}/cart",
                params={"product_id": state["product_id"], "quantity": 5},
                headers=auth(state["shopper_token"]))

    # checkout بكمية أكبر من المخزون → 400 ويبقى المخزون كما هو
    r = client.post("/api/checkout", json={
        "items": [{"product_id": state["product_id"], "quantity": 99}],
        "delivery_address": "Ruwī, Masqat",
    }, headers=auth(state["shopper_token"]))
    assert r.status_code == 400

    # checkout صحيح → mock يؤكد الطلب فوراً
    r = client.post("/api/checkout", json={
        "items": [{"product_id": state["product_id"], "quantity": 2}],
        "delivery_address": "Ruwī, Masqat",
    }, headers=auth(state["shopper_token"]))
    assert r.status_code == 200, r.text
    assert r.json()["checkout_url"].startswith("/order-success")  # mock في التطوير
    session_id = r.json()["session_id"]

    r = client.get(f"{API}/payment/status/{session_id}", headers=auth(state["shopper_token"]))
    assert r.status_code == 200
    assert r.json()["payment_status"] == "paid"


def _make_product():
    """ينشئ منتجاً ضمن متجر معتمد (اختصاراً لمسارات الاختبارات)"""
    if state.get("product_id"):
        return
    m_email = f"mk_{SUFFIX}@test.com"
    client.post("/api/auth/register", json={"email": m_email, "password": PASSWORD,
                                            "name": "MK", "role": "merchant"})
    login = client.post("/api/auth/login", json={"email": m_email, "password": PASSWORD})
    mtok = login.json()["token"]
    mid = login.json()["user"]["user_id"]
    client.patch(f"{API}/admin/users/{mid}/approve", params={"is_approved": True},
                 headers=auth(state["admin_token"]))
    store = client.post("/api/stores", json={"name": "MK Store", "description": ""},
                        headers=auth(mtok)).json()
    client.patch(f"{API}/stores/{store['store_id']}/status", params={"status": "approved"},
                 headers=auth(state["admin_token"]))
    prod = client.post("/api/products", json={"name": "MK Product", "price": 10.0,
                                              "stock": 10, "category": "C", "images": []},
                       headers=auth(mtok)).json()
    state["product_id"] = prod["product_id"]
    state["merchant_token"] = mtok

    # متسوق ثانٍ لفحص تسريب التوصيلات
    if not state.get("shopper_token"):
        state["shopper_token"] = client.post("/api/auth/register", json={
            "email": SHOPPER_EMAIL, "password": PASSWORD,
            "name": "Shopper", "role": "shopper"
        }).json()["token"]


# ----- Deliveries: لا تسريب -----
@pytest.mark.usefixtures("_seed_admin")
def test_deliveries_not_leaked_to_other_users():
    _make_product()
    # متسوق A يطلب
    tok_a = client.post("/api/auth/register", json={
        "email": f"a_{SUFFIX}@t.com", "password": PASSWORD, "name": "A", "role": "shopper"
    }).json()["token"]
    r = client.post("/api/checkout", json={
        "items": [{"product_id": state["product_id"], "quantity": 1}],
        "delivery_address": "Addr A",
    }, headers=auth(tok_a))
    assert r.status_code == 200

    # متسوق B لا يرى أبداً طلبات A في /deliveries
    tok_b = client.post("/api/auth/register", json={
        "email": f"b_{SUFFIX}@t.com", "password": PASSWORD, "name": "B", "role": "shopper"
    }).json()["token"]
    r = client.get("/api/deliveries", headers=auth(tok_b))
    assert r.status_code == 200
    for order in r.json():
        assert order["user_id"] == tok_b or order["user_id"] != tok_a  # لا يحتوي طلبات A أبداً
        assert order["delivery_address"] != "Addr A"


# ----- Payment status يحتاج تسجيل دخول -----
@pytest.mark.usefixtures("_seed_admin")
def test_payment_status_requires_auth():
    r = client.get(f"{API}/payment/status/cs_mock_whatever")
    assert r.status_code in (401, 403)


# ----- Admin protections -----
@pytest.mark.usefixtures("_seed_admin")
def test_shopper_cannot_access_admin():
    r = client.get("/api/admin/users", headers=auth(state["shopper_token"]))
    assert r.status_code == 403


@pytest.mark.usefixtures("_seed_admin")
def test_me_requires_auth():
    r = client.get("/api/auth/me")
    assert r.status_code == 401


# ----- Order status state machine -----
@pytest.mark.usefixtures("_seed_admin")
def test_order_status_transitions_enforced():
    _make_product()
    tok = client.post("/api/auth/register", json={
        "email": f"s_{SUFFIX}@t.com", "password": PASSWORD, "name": "S", "role": "shopper"
    }).json()["token"]
    checkout = client.post("/api/checkout", json={
        "items": [{"product_id": state["product_id"], "quantity": 1}],
        "delivery_address": "Addr",
    }, headers=auth(tok)).json()
    order_id = checkout["order_id"]

    # قفزة غير قانونية: pending → delivered مرفوضة
    r = client.patch(f"{API}/orders/{order_id}/status", params={"status": "delivered"},
                     headers=auth(state["merchant_token"]))
    assert r.status_code in (400, 403)

    # تاجر آخر لا يملك الطلب → مرفوض
    other_tok = client.post("/api/auth/register", json={
        "email": f"other_m_{SUFFIX}@t.com", "password": PASSWORD, "name": "O", "role": "merchant"
    }).json()["token"]
    r = client.patch(f"{API}/orders/{order_id}/status", params={"status": "cancelled"},
                     headers=auth(other_tok))
    assert r.status_code == 403