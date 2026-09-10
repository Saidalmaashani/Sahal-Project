"""Sahal Backend API Tests — ضد خادم uvicorn حقيقي على قاعدة بيانات معزولة (sahal_test)"""
import os
import uuid

import requests

# يُضبط بواسطة conftest (الذي يشغّل الخادم قبل استيراد هذا الملف)
BASE_URL = os.environ.get('TEST_BACKEND_URL', 'http://localhost:8000').rstrip('/')
API = f"{BASE_URL}/api"

SUFFIX = uuid.uuid4().hex[:6]
MERCHANT_EMAIL = f"test_merchant_{SUFFIX}@test.com"
SHOPPER_EMAIL = f"test_shopper_{SUFFIX}@test.com"
PASSWORD = "Test1234!"

state = {}


def _post(path, **kw):
    return requests.post(f"{API}{path}", timeout=30, **kw)


def _get(path, **kw):
    return requests.get(f"{API}{path}", timeout=30, **kw)


def _patch(path, **kw):
    return requests.patch(f"{API}{path}", timeout=30, **kw)


def _register(role, email):
    return _post("/auth/register", json={
        "email": email, "password": PASSWORD,
        "name": f"User {email}", "role": role,
    })


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ----- Seed & Admin Login -----
def test_seed_admin():
    r = _post("/seed/admin")
    assert r.status_code == 200


def test_admin_login():
    r = _post("/auth/login", json={"email": "admin@sahal.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    state["admin_token"] = data["token"]


def test_admin_me():
    r = _get("/auth/me", headers=auth(state["admin_token"]))
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


# ----- Security: منع إنشاء admin ذاتياً والأدوار غير الصالحة -----
def test_register_as_admin_is_forbidden():
    r = _register("admin", f"evil_admin_{SUFFIX}@test.com")
    assert r.status_code == 400, r.text


def test_register_invalid_role_rejected():
    r = _register("superadmin", f"bad_role_{SUFFIX}@test.com")
    assert r.status_code == 400


# ----- Registration -----
def test_register_shopper():
    r = _register("shopper", SHOPPER_EMAIL)
    assert r.status_code == 200, r.text
    state["shopper_token"] = r.json()["token"]
    state["shopper_id"] = r.json()["user"]["user_id"]


def test_register_merchant():
    r = _register("merchant", MERCHANT_EMAIL)
    assert r.status_code == 200, r.text
    state["merchant_id"] = r.json()["user"]["user_id"]


def test_merchant_login_blocked_until_approved():
    r = _post("/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    assert r.status_code == 403


def test_admin_approves_merchant():
    r = _patch(
        f"/admin/users/{state['merchant_id']}/approve",
        params={"is_approved": True},
        headers=auth(state["admin_token"]),
    )
    assert r.status_code == 200, r.text


def test_merchant_login_after_approval():
    r = _post("/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    state["merchant_token"] = r.json()["token"]


def test_duplicate_register_fails():
    r = _register("shopper", SHOPPER_EMAIL)
    assert r.status_code == 400


# ----- Store flow -----
def test_create_store():
    r = _post("/stores", json={"name": "Test Store", "description": "desc"},
              headers=auth(state["merchant_token"]))
    assert r.status_code == 200, r.text
    state["store_id"] = r.json()["store_id"]


def test_admin_approves_store():
    r = _patch(
        f"/stores/{state['store_id']}/status",
        params={"status": "approved"},
        headers=auth(state["admin_token"]),
    )
    assert r.status_code == 200


# ----- Product flow -----
def test_create_product():
    r = _post("/products", json={
        "name": "Test Product", "description": "d",
        "price": 19.99, "stock": 5, "category": "Electronics",
        "images": []
    }, headers=auth(state["merchant_token"]))
    assert r.status_code == 200, r.text
    state["product_id"] = r.json()["product_id"]


def test_get_products():
    r = _get("/products")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


# ----- Cart -----
def test_add_to_cart():
    r = requests.post(
        f"{API}/cart",
        params={"product_id": state["product_id"], "quantity": 2},
        headers=auth(state["shopper_token"]), timeout=30
    )
    assert r.status_code == 200


def test_add_to_cart_rejects_invalid_quantity():
    r = requests.post(
        f"{API}/cart",
        params={"product_id": state["product_id"], "quantity": 0},
        headers=auth(state["shopper_token"]), timeout=30
    )
    assert r.status_code == 400


def test_get_cart():
    r = _get("/cart", headers=auth(state["shopper_token"]))
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ----- Payment: تسجيل الدخول مطلوب + المخزون يُحجز بشكل ذرّي -----
def test_payment_status_requires_auth():
    r = _get("/payment/status/cs_mock_whatever")
    assert r.status_code in (401, 403)


def test_checkout_rejects_excess_stock():
    r = _post("/checkout", json={
        "items": [{"product_id": state["product_id"], "quantity": 99}],
        "delivery_address": "Ruwī, Masqat",
    }, headers=auth(state["shopper_token"]))
    assert r.status_code == 400


def test_checkout_mock_marks_paid():
    r = _post("/checkout", json={
        "items": [{"product_id": state["product_id"], "quantity": 2}],
        "delivery_address": "Ruwī, Masqat",
    }, headers=auth(state["shopper_token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["checkout_url"].startswith("/order-success")
    assert data["order_id"]
    state["order_id"] = data["order_id"]
    state["session_id"] = data["session_id"]

    r = _get(f"/payment/status/{state['session_id']}", headers=auth(state["shopper_token"]))
    assert r.status_code == 200
    assert r.json()["payment_status"] == "paid"


# ----- Deliveries: لا تسريب لطلبات الآخرين -----
def test_deliveries_not_leaked_between_shoppers():
    # تاجر آخر يحاول رؤية الطلبات أيضاً لحماية صحيحة
    other_merchant = _register("merchant", f"other_m_{SUFFIX}@test.com")
    om_id = other_merchant.json()["user"]["user_id"]
    _patch(f"/admin/users/{om_id}/approve", params={"is_approved": True},
           headers=auth(state["admin_token"]))
    other_m_tok = _post("/auth/login", json={
        "email": f"other_m_{SUFFIX}@test.com", "password": PASSWORD}).json()["token"]

    # تاجر لا يملك منتجات هذا الطلب → لا يرى شيئاً
    r = _get("/deliveries", headers=auth(other_m_tok))
    assert r.status_code == 200
    for order in r.json():
        assert order["order_id"] != state["order_id"]

    # متسوق آخر لا يرى طلبات المتسوق الأساسي إطلاقاً
    other_shopper = _register("shopper", f"other_s_{SUFFIX}@test.com").json()["token"]
    r = _get("/deliveries", headers=auth(other_shopper))
    assert r.status_code == 200
    for order in r.json():
        assert order["order_id"] != state["order_id"]


# ----- Order status: آلة حالات + صلاحيات حسب الدور -----
def test_shopper_cannot_change_status():
    r = _patch(
        f"/orders/{state['order_id']}/status", params={"status": "cancelled"},
        headers=auth(state["shopper_token"]),
    )
    assert r.status_code == 403


def test_merchant_cannot_skip_state():
    # pending → delivered قفزة غير قانونية
    r = _patch(
        f"/orders/{state['order_id']}/status", params={"status": "delivered"},
        headers=auth(state["merchant_token"]),
    )
    assert r.status_code == 400


def test_other_merchant_cannot_confirm():
    other_m = _register("merchant", f"om2_{SUFFIX}@test.com").json()
    _patch(f"/admin/users/{other_m['user']['user_id']}/approve",
           params={"is_approved": True}, headers=auth(state["admin_token"]))
    tok = _post("/auth/login", json={
        "email": f"om2_{SUFFIX}@test.com", "password": PASSWORD}).json()["token"]
    r = _patch(
        f"/orders/{state['order_id']}/status", params={"status": "cancelled"},
        headers=auth(tok),
    )
    assert r.status_code == 403


def test_merchant_can_confirm_own_order():
    r = _patch(
        f"/orders/{state['order_id']}/status", params={"status": "confirmed"},
        headers=auth(state["merchant_token"]),
    )
    assert r.status_code == 200, r.text


# ----- Admin protections -----
def test_admin_analytics():
    r = _get("/admin/analytics", headers=auth(state["admin_token"]))
    assert r.status_code == 200


def test_shopper_cannot_access_admin():
    r = _get("/admin/users", headers=auth(state["shopper_token"]))
    assert r.status_code == 403


def test_me_requires_auth():
    r = _get("/auth/me")
    assert r.status_code == 401