"""Sahal Backend API Tests"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('TEST_BACKEND_URL', 'http://localhost:8000').rstrip('/')
API = f"{BASE_URL}/api"

SUFFIX = uuid.uuid4().hex[:6]
MERCHANT_EMAIL = f"test_merchant_{SUFFIX}@test.com"
SHOPPER_EMAIL = f"test_shopper_{SUFFIX}@test.com"
DRIVER_EMAIL = f"test_driver_{SUFFIX}@test.com"
PASSWORD = "Test1234!"

state = {}


def _post(path, **kw):
    return requests.post(f"{API}{path}", timeout=30, **kw)


def _get(path, **kw):
    return requests.get(f"{API}{path}", timeout=30, **kw)


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


# ----- Registration -----
def test_register_shopper():
    r = _post("/auth/register", json={
        "email": SHOPPER_EMAIL, "password": PASSWORD,
        "name": "Test Shopper", "role": "shopper"
    })
    assert r.status_code == 200, r.text
    state["shopper_token"] = r.json()["token"]
    state["shopper_id"] = r.json()["user"]["user_id"]


def test_register_merchant():
    r = _post("/auth/register", json={
        "email": MERCHANT_EMAIL, "password": PASSWORD,
        "name": "Test Merchant", "role": "merchant"
    })
    assert r.status_code == 200, r.text
    state["merchant_id"] = r.json()["user"]["user_id"]


def test_merchant_login_blocked_until_approved():
    r = _post("/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    assert r.status_code == 403


def test_admin_approves_merchant():
    r = requests.patch(
        f"{API}/admin/users/{state['merchant_id']}/approve",
        params={"is_approved": True},
        headers=auth(state["admin_token"]), timeout=30
    )
    assert r.status_code == 200, r.text


def test_merchant_login_after_approval():
    r = _post("/auth/login", json={"email": MERCHANT_EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    state["merchant_token"] = r.json()["token"]


def test_duplicate_register_fails():
    r = _post("/auth/register", json={
        "email": SHOPPER_EMAIL, "password": PASSWORD,
        "name": "X", "role": "shopper"
    })
    assert r.status_code == 400


# ----- Store flow -----
def test_create_store():
    r = _post("/stores", json={"name": "Test Store", "description": "desc"},
              headers=auth(state["merchant_token"]))
    assert r.status_code == 200, r.text
    state["store_id"] = r.json()["store_id"]


def test_admin_approves_store():
    r = requests.patch(
        f"{API}/stores/{state['store_id']}/status",
        params={"status": "approved"},
        headers=auth(state["admin_token"]), timeout=30
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


# ----- Cart -----
def test_add_to_cart():
    r = requests.post(
        f"{API}/cart",
        params={"product_id": state["product_id"], "quantity": 2},
        headers=auth(state["shopper_token"]), timeout=30
    )
    assert r.status_code == 200


def test_get_cart():
    r = _get("/cart", headers=auth(state["shopper_token"]))
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ----- Admin -----
def test_admin_analytics():
    r = _get("/admin/analytics", headers=auth(state["admin_token"]))
    assert r.status_code == 200


def test_shopper_cannot_access_admin():
    r = _get("/admin/users", headers=auth(state["shopper_token"]))
    assert r.status_code == 403


def test_me_requires_auth():
    r = _get("/auth/me")
    assert r.status_code == 401
