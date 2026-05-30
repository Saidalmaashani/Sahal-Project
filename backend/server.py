"""
سهل (Sahal) - منصة التجارة الإلكترونية
Backend API - FastAPI + MongoDB
"""
import os
import uuid
import logging
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt as _bcrypt
import jwt as pyjwt

# Optional integrations (تحميل اختياري لتجنب أخطاء عند عدم وجود المكتبات)
try:
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False

# ==================== CONFIG ====================
ROOT_DIR = Path(__file__).parent
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sahal_db')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production-' + secrets.token_hex(16))
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_HOURS = 24 * 7  # أسبوع

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Database
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Password hashing


# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Sahal API", version="1.0.0")
api_router = APIRouter(prefix="/api")


# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    role: str  # admin, merchant, shopper, driver
    password_hash: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_approved: bool = True  # auto-approved لكل الأدوار ما عدا merchant
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None
    referral_earnings: float = 0.0
    created_at: str
    auth_provider: Optional[str] = "local"  # local or google


class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str = "shopper"
    phone: Optional[str] = None
    address: Optional[str] = None
    referral_code: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class Store(BaseModel):
    store_id: str
    merchant_id: str
    name: str
    description: Optional[str] = ""
    status: str = "pending"  # pending, approved, rejected
    created_at: str


class StoreCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class Product(BaseModel):
    product_id: str
    merchant_id: str
    store_id: Optional[str] = None
    name: str
    description: str
    price: float
    stock: int
    category: str
    images: List[str] = []
    created_at: str


class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    stock: int
    category: str
    images: List[str] = []


class CartItem(BaseModel):
    cart_item_id: str
    user_id: str
    product_id: str
    quantity: int
    added_at: str


class Order(BaseModel):
    order_id: str
    user_id: str
    items: List[dict]
    total_amount: float
    status: str = "pending"  # pending, confirmed, shipped, delivered, cancelled
    payment_status: str = "pending"  # pending, paid, failed
    delivery_address: str
    driver_id: Optional[str] = None
    created_at: str
    updated_at: str


class CheckoutRequest(BaseModel):
    items: List[dict]
    delivery_address: str


class DeliveryDriver(BaseModel):
    driver_id: str
    user_id: str
    vehicle_type: str
    vehicle_number: str
    license_number: str
    is_available: bool = True
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    location_updated_at: Optional[str] = None
    created_at: str


class DeliveryDriverCreate(BaseModel):
    vehicle_type: str
    vehicle_number: str
    license_number: str


class ChatMessage(BaseModel):
    message_id: str
    user_id: str
    message: str
    response: str
    created_at: str


# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_jwt_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRES_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    authorization: Optional[str] = Header(None),
    request: Request = None
) -> dict:
    """يدعم Bearer token أو session_id من header"""
    # 1) Bearer token (JWT)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        payload = decode_jwt_token(token)
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    # 2) Session ID (OAuth)
    if request:
        session_id = request.headers.get("X-Session-ID") or request.cookies.get("session_id")
        if session_id:
            session = await db.user_sessions.find_one({"session_id": session_id}, {"_id": 0})
            if session:
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

    raise HTTPException(status_code=401, detail="Not authenticated")


# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(payload: UserRegister):
    # تحقق من وجود الإيميل
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم بالفعل")

    # تحقق من صحة الدور
    if payload.role not in ["admin", "merchant", "shopper", "driver"]:
        raise HTTPException(status_code=400, detail="دور غير صالح")

    # التجار يحتاجون موافقة الإدارة
    is_approved = payload.role != "merchant"

    # تحقق من رمز الإحالة لو موجود
    referred_by = None
    if payload.referral_code:
        referrer = await db.users.find_one(
            {"referral_code": payload.referral_code.upper()},
            {"_id": 0, "user_id": 1}
        )
        if referrer:
            referred_by = referrer["user_id"]

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    referral_code = f"SAHAL{uuid.uuid4().hex[:6].upper()}"

    user = User(
        user_id=user_id,
        email=payload.email.lower(),
        name=payload.name,
        role=payload.role,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        address=payload.address,
        is_approved=is_approved,
        referral_code=referral_code,
        referred_by=referred_by,
        referral_earnings=0.0,
        created_at=datetime.now(timezone.utc).isoformat(),
        auth_provider="local"
    )
    await db.users.insert_one(user.model_dump())

    # سجل الإحالة
    if referred_by:
        await db.referrals.insert_one({
            "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
            "referrer_id": referred_by,
            "referred_id": user_id,
            "referred_name": payload.name,
            "referred_email": payload.email.lower(),
            "status": "pending",
            "reward_amount": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # JWT
    token = create_jwt_token(user_id, payload.role)

    # إرجاع بدون كلمة المرور
    user_dict = user.model_dump()
    user_dict.pop("password_hash", None)

    return {"user": user_dict, "token": token}


@api_router.post("/auth/login")
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")

    if not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")

    # تحقق من الموافقة (للتجار)
    if user["role"] == "merchant" and not user.get("is_approved"):
        raise HTTPException(status_code=403, detail="حسابك بانتظار موافقة الإدارة")

    token = create_jwt_token(user["user_id"], user["role"])

    user.pop("_id", None)
    user.pop("password_hash", None)

    return {"user": user, "token": token}


@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    return user


@api_router.post("/auth/logout")
async def logout(request: Request):
    # حذف الـ session لو فيه
    session_id = request.headers.get("X-Session-ID") or request.cookies.get("session_id")
    if session_id:
        await db.user_sessions.delete_one({"session_id": session_id})
    return {"message": "تم تسجيل الخروج"}



@api_router.post("/auth/google")
async def google_auth(request: Request):
    body = await request.json()
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")
    import httpx
    async with httpx.AsyncClient() as http:
        token_resp = await http.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Google auth failed")
        access_token = token_resp.json().get("access_token")
        user_resp = await http.get("https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"})
        if user_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to get user info")
        user_info = user_resp.json()
        email = user_info.get("email", "").lower()
        name = user_info.get("name", "مستخدم")
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id, email=email, name=name, role="shopper",
            is_approved=True, referral_code=f"SAHAL{uuid.uuid4().hex[:6].upper()}",
            created_at=datetime.now(timezone.utc).isoformat(), auth_provider="google"
        )
        await db.users.insert_one(new_user.model_dump())
        user = new_user.model_dump()
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_jwt_token(user["user_id"], user["role"])
    return {"user": user, "token": token}

@api_router.post("/auth/session")
async def oauth_session(request: Request):
    """تبادل session_id من Emergent OAuth"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

    # في النسخة الحقيقية: استدعاء Emergent Auth API للتحقق
    # هنا نعمل mock للتطوير المحلي
    # TODO: استبدل بـ HTTP call حقيقي لـ Emergent Auth
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.get(
                "https://auth.emergentagent.com/api/session",
                headers={"X-Session-ID": session_id}
            )
            if r.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            data = r.json()
            email = data.get("email", "").lower()
            name = data.get("name", "مستخدم")
            picture = data.get("picture", "")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

    # ابحث أو أنشئ المستخدم
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id,
            email=email,
            name=name,
            role="shopper",
            is_approved=True,
            referral_code=f"SAHAL{uuid.uuid4().hex[:6].upper()}",
            created_at=datetime.now(timezone.utc).isoformat(),
            auth_provider="google"
        )
        await db.users.insert_one(new_user.model_dump())
        user = new_user.model_dump()

    # خزّن الجلسة
    await db.user_sessions.insert_one({
        "session_id": session_id,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_jwt_token(user["user_id"], user["role"])
    return {"user": user, "token": token}


# ==================== STORE ENDPOINTS ====================

@api_router.post("/stores")
async def create_store(
    payload: StoreCreate,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "merchant":
        raise HTTPException(status_code=403, detail="فقط التجار يمكنهم إنشاء متاجر")

    # تحقق إن التاجر ما عنده متجر بالفعل
    existing_store = await db.stores.find_one({"merchant_id": user["user_id"]})
    if existing_store:
        raise HTTPException(status_code=400, detail="لديك متجر بالفعل. يمكن لكل تاجر إنشاء متجر واحد فقط.")

    store_id = f"store_{uuid.uuid4().hex[:12]}"
    store = Store(
        store_id=store_id,
        merchant_id=user["user_id"],
        name=payload.name,
        description=payload.description,
        status="pending",
        created_at=datetime.now(timezone.utc).isoformat()
    )
    await db.stores.insert_one(store.model_dump())
    return store


@api_router.get("/stores")
async def list_stores():
    """قائمة المتاجر المعتمدة (عامة)"""
    stores = await db.stores.find({"status": "approved"}, {"_id": 0}).to_list(1000)
    return stores


@api_router.get("/stores/my")
async def my_stores(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    stores = await db.stores.find({"merchant_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return stores


@api_router.patch("/stores/{store_id}/status")
async def update_store_status(
    store_id: str,
    status: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="حالة غير صالحة")

    result = await db.stores.update_one(
        {"store_id": store_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="المتجر غير موجود")
    return {"message": "تم تحديث حالة المتجر"}


# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/products")
async def create_product(
    payload: ProductCreate,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "merchant":
        raise HTTPException(status_code=403, detail="فقط التجار يمكنهم إضافة منتجات")

    # يجب أن يكون لدى التاجر متجر معتمد
    approved_store = await db.stores.find_one({
        "merchant_id": user["user_id"],
        "status": "approved"
    }, {"_id": 0})

    if not approved_store:
        raise HTTPException(status_code=400, detail="تحتاج لمتجر معتمد قبل إضافة المنتجات")

    product_id = f"prod_{uuid.uuid4().hex[:12]}"
    product = Product(
        product_id=product_id,
        merchant_id=user["user_id"],
        store_id=approved_store["store_id"],
        name=payload.name,
        description=payload.description,
        price=payload.price,
        stock=payload.stock,
        category=payload.category,
        images=payload.images,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    await db.products.insert_one(product.model_dump())
    return product


@api_router.get("/products")
async def list_products(category: Optional[str] = None, search: Optional[str] = None):
    """قائمة المنتجات العامة"""
    query = {}
    if category and category != "all":
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    products = await db.products.find(query, {"_id": 0}).limit(200).to_list(200)
    return products


@api_router.get("/products/my")
async def my_products(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    products = await db.products.find({"merchant_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return products


@api_router.get("/products/recommendations/me")
async def get_recommendations(
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """توصيات مدعومة بـ AI - حالياً ترجع منتجات عشوائية شائعة"""
    user = await get_current_user(authorization, request)

    # نسخة بسيطة: أحدث 8 منتجات
    products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    return products


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return product


# ==================== CART ENDPOINTS ====================

@api_router.post("/cart")
async def add_to_cart(
    product_id: str,
    quantity: int = 1,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)

    # تحقق من المنتج
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    # ادمج لو موجود سابقاً
    existing = await db.cart_items.find_one({
        "user_id": user["user_id"],
        "product_id": product_id
    })

    if existing:
        await db.cart_items.update_one(
            {"cart_item_id": existing["cart_item_id"]},
            {"$inc": {"quantity": quantity}}
        )
    else:
        cart_item = CartItem(
            cart_item_id=f"cart_{uuid.uuid4().hex[:12]}",
            user_id=user["user_id"],
            product_id=product_id,
            quantity=quantity,
            added_at=datetime.now(timezone.utc).isoformat()
        )
        await db.cart_items.insert_one(cart_item.model_dump())

    return {"message": "Added to cart"}


@api_router.get("/cart")
async def get_cart(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    cart_items = await db.cart_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)

    # أضف تفاصيل المنتج
    for item in cart_items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        item["product"] = product

    return cart_items


@api_router.delete("/cart/{cart_item_id}")
async def remove_from_cart(
    cart_item_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    await db.cart_items.delete_one({
        "cart_item_id": cart_item_id,
        "user_id": user["user_id"]
    })
    return {"message": "Removed from cart"}


# ==================== ORDER & PAYMENT ENDPOINTS ====================

@api_router.post("/checkout")
async def checkout(
    checkout_data: CheckoutRequest,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)

    # احسب المجموع
    total = 0.0
    for item in checkout_data.items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item['product_id']} not found")
        total += product["price"] * item["quantity"]

    # أنشئ الطلب
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    order = Order(
        order_id=order_id,
        user_id=user["user_id"],
        items=checkout_data.items,
        total_amount=total,
        status="pending",
        payment_status="pending",
        delivery_address=checkout_data.delivery_address,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat()
    )
    await db.orders.insert_one(order.model_dump())

    # Stripe checkout (اختياري)
    if STRIPE_AVAILABLE and STRIPE_API_KEY:
        host_url = str(request.base_url).rstrip('/')
        origin = request.headers.get('origin', host_url)
        success_url = f"{origin}/order-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/cart"
        webhook_url = f"{host_url}/api/webhook/stripe"

        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        checkout_request = CheckoutSessionRequest(
            amount=total,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"order_id": order_id, "user_id": user["user_id"]},
            payment_methods=["card"]
        )
        session = await stripe_checkout.create_checkout_session(checkout_request)

        await db.payment_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "order_id": order_id,
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "amount": total,
            "currency": "usd",
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        await db.cart_items.delete_many({"user_id": user["user_id"]})

        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "order_id": order_id
        }
    else:
        # Mock للتطوير
        await db.cart_items.delete_many({"user_id": user["user_id"]})
        mock_session = f"cs_mock_{uuid.uuid4().hex[:12]}"
        await db.payment_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "order_id": order_id,
            "session_id": mock_session,
            "user_id": user["user_id"],
            "amount": total,
            "currency": "usd",
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        # تأكيد الطلب فوراً في وضع التطوير
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"payment_status": "paid", "status": "confirmed"}}
        )
        await db.payment_transactions.update_one(
            {"session_id": mock_session},
            {"$set": {"payment_status": "paid"}}
        )
        # معالجة مكافأة الإحالة
        await _process_referral_reward(user["user_id"], total)
        
        return {
            "checkout_url": f"/order-success?session_id={mock_session}",
            "session_id": mock_session,
            "order_id": order_id
        }


@api_router.get("/payment/status/{session_id}")
async def get_payment_status(session_id: str):
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="معاملة غير موجودة")

    if STRIPE_AVAILABLE and STRIPE_API_KEY and not session_id.startswith("cs_mock_"):
        webhook_url = "https://placeholder.com/webhook"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status = await stripe_checkout.get_checkout_status(session_id)

        if transaction["payment_status"] != "paid" and status.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid"}}
            )
            order_id = status.metadata.get("order_id")
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"payment_status": "paid", "status": "confirmed"}}
            )
            # Referral reward
            user_id = status.metadata.get("user_id")
            if user_id:
                await _process_referral_reward(user_id, status.amount_total / 100)

        return status.model_dump()
    else:
        # Mock: نعتبر الدفع نجح بعد ثانية
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid"}}
        )
        await db.orders.update_one(
            {"order_id": transaction["order_id"]},
            {"$set": {"payment_status": "paid", "status": "confirmed"}}
        )
        await _process_referral_reward(transaction["user_id"], transaction["amount"])
        return {
            "session_id": session_id,
            "payment_status": "paid",
            "amount_total": int(transaction["amount"] * 100),
            "currency": transaction["currency"],
            "metadata": {"order_id": transaction["order_id"]}
        }


async def _process_referral_reward(user_id: str, amount: float):
    """معالجة مكافأة الإحالة عند أول شراء"""
    buyer = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if buyer and buyer.get("referred_by"):
        paid_count = await db.orders.count_documents({
            "user_id": user_id,
            "payment_status": "paid"
        })
        if paid_count == 1:
            reward = round(amount * 0.10, 2)
            await db.users.update_one(
                {"user_id": buyer["referred_by"]},
                {"$inc": {"referral_earnings": reward}}
            )
            await db.referrals.update_one(
                {"referred_id": user_id},
                {"$set": {"status": "rewarded", "reward_amount": reward}}
            )


@api_router.get("/orders")
async def get_orders(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)

    if user["role"] == "admin":
        orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    elif user["role"] == "merchant":
        products = await db.products.find({"merchant_id": user["user_id"]}, {"_id": 0}).to_list(1000)
        product_ids = [p["product_id"] for p in products]
        all_orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
        orders = [o for o in all_orders if any(item["product_id"] in product_ids for item in o["items"])]
    else:
        orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)

    return orders


@api_router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] not in ["admin", "merchant", "driver"]:
        raise HTTPException(status_code=403, detail="غير مصرح")

    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "تم تحديث الطلب"}


# ==================== DELIVERY ENDPOINTS ====================

@api_router.post("/drivers")
async def register_driver(
    driver_data: DeliveryDriverCreate,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="فقط السائقون يمكنهم التسجيل")

    existing = await db.delivery_drivers.find_one({"user_id": user["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="ملف السائق موجود مسبقاً")

    driver_id = f"driver_{uuid.uuid4().hex[:12]}"
    driver = DeliveryDriver(
        driver_id=driver_id,
        user_id=user["user_id"],
        vehicle_type=driver_data.vehicle_type,
        vehicle_number=driver_data.vehicle_number,
        license_number=driver_data.license_number,
        is_available=True,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    await db.delivery_drivers.insert_one(driver.model_dump())
    return driver


@api_router.get("/drivers/my")
async def get_my_driver_profile(
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="ملف السائق غير موجود")
    return driver


@api_router.get("/deliveries")
async def get_deliveries(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)

    if user["role"] == "driver":
        driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if not driver:
            return []
        # Driver sees: their own assigned orders + available unassigned confirmed orders
        orders = await db.orders.find(
            {"$or": [
                {"driver_id": driver["driver_id"]},
                {"payment_status": "paid", "status": "confirmed", "driver_id": None}
            ]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
    else:
        orders = await db.orders.find(
            {"payment_status": "paid", "status": {"$in": ["confirmed", "shipped"]}},
            {"_id": 0}
        ).to_list(1000)

    # أضف موقع التاجر لكل طلب
    for order in orders:
        if order.get("items"):
            first_product = await db.products.find_one(
                {"product_id": order["items"][0]["product_id"]}, {"_id": 0}
            )
            if first_product:
                merchant = await db.users.find_one(
                    {"user_id": first_product["merchant_id"]}, {"_id": 0}
                )
                if merchant and merchant.get("lat") and merchant.get("lng"):
                    order["merchant_lat"] = merchant["lat"]
                    order["merchant_lng"] = merchant["lng"]

    return orders


@api_router.post("/deliveries/{order_id}/assign")
async def assign_delivery(
    order_id: str,
    driver_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"driver_id": driver_id, "status": "shipped"}}
    )
    return {"message": "Driver assigned"}


@api_router.post("/drivers/location")
async def update_driver_location(
    lat: float,
    lng: float,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    result = await db.delivery_drivers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "current_lat": lat,
            "current_lng": lng,
            "location_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="ملف السائق غير موجود")
    return {"message": "تم تحديث الموقع"}


@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(
    order_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")

    # تحقق من الصلاحية
    is_owner = order["user_id"] == user["user_id"]
    is_admin = user["role"] == "admin"
    is_driver = False
    if user["role"] == "driver":
        my_driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
        is_driver = my_driver and my_driver["driver_id"] == order.get("driver_id")

    if not (is_owner or is_admin or is_driver):
        raise HTTPException(status_code=403, detail="غير مصرح")

    driver_location = None
    driver_info = None
    if order.get("driver_id"):
        driver = await db.delivery_drivers.find_one({"driver_id": order["driver_id"]}, {"_id": 0})
        if driver:
            if driver.get("current_lat") is not None:
                driver_location = {
                    "lat": driver["current_lat"],
                    "lng": driver["current_lng"],
                    "updated_at": driver.get("location_updated_at")
                }
            driver_user = await db.users.find_one({"user_id": driver["user_id"]}, {"_id": 0})
            driver_info = {
                "name": driver_user.get("name") if driver_user else None,
                "phone": driver_user.get("phone") if driver_user else None,
                "vehicle_type": driver.get("vehicle_type"),
                "vehicle_number": driver.get("vehicle_number")
            }

    return {
        "order_id": order_id,
        "status": order["status"],
        "delivery_address": order["delivery_address"],
        "total_amount": order["total_amount"],
        "driver_location": driver_location,
        "driver_info": driver_info,
        "created_at": order["created_at"],
        "updated_at": order["updated_at"]
    }




@api_router.post("/deliveries/{order_id}/complete")
async def complete_delivery(order_id: str, authorization: Optional[str] = Header(None), request: Request = None):
    """المندوب يُكمل التوصيل"""
    user = await get_current_user(authorization, request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")
    driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="ملف المندوب غير موجود")
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    if order.get("driver_id") != driver["driver_id"]:
        raise HTTPException(status_code=403, detail="هذا الطلب ليس لك")
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "delivered", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # المندوب أصبح متاحاً مجدداً
    await db.delivery_drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {"is_available": True}}
    )
    return {"message": "تم التوصيل بنجاح"}

@api_router.post("/deliveries/{order_id}/accept")
async def accept_delivery(order_id: str, authorization: Optional[str] = Header(None), request: Request = None):
    """المندوب يقبل طلب توصيل تلقائياً"""
    user = await get_current_user(authorization, request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")
    
    driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="ملف المندوب غير موجود")
    
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    
    if order.get("driver_id"):
        raise HTTPException(status_code=400, detail="تم قبول هذا الطلب من مندوب آخر")
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"driver_id": driver["driver_id"], "status": "shipped", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.delivery_drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {"is_available": False}}
    )
    return {"message": "تم قبول الطلب بنجاح"}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/users")
async def get_all_users(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api_router.patch("/admin/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    is_approved: bool,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_approved": is_approved}}
    )
    return {"message": "تم التحديث"}


@api_router.get("/admin/analytics")
async def get_analytics(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] not in ["admin", "merchant"]:
        raise HTTPException(status_code=403, detail="Access denied")

    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})

    if user["role"] == "merchant":
        products = await db.products.find({"merchant_id": user["user_id"]}, {"_id": 0}).to_list(1000)
        product_ids = [p["product_id"] for p in products]
        all_orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
        merchant_orders = [o for o in all_orders if any(item["product_id"] in product_ids for item in o["items"])]
        total_revenue = sum(o["total_amount"] for o in merchant_orders if o["payment_status"] == "paid")
    else:
        paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(1000)
        total_revenue = sum(o["total_amount"] for o in paid_orders)

    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": total_revenue
    }


@api_router.get("/admin/stores")
async def get_all_stores_admin(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    stores = await db.stores.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for s in stores:
        m = await db.users.find_one({"user_id": s["merchant_id"]}, {"_id": 0, "password_hash": 0})
        if m:
            s["merchant_name"] = m.get("name")
            s["merchant_email"] = m.get("email")
    return stores


@api_router.get("/admin/drivers")
async def get_all_drivers(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    drivers = await db.delivery_drivers.find({}, {"_id": 0}).to_list(1000)
    for d in drivers:
        u = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            d["name"] = u.get("name")
            d["email"] = u.get("email")
            d["phone"] = u.get("phone")
    return drivers


@api_router.get("/admin/deliveries")
async def get_all_deliveries(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    orders = await db.orders.find(
        {"payment_status": "paid", "status": {"$in": ["confirmed", "shipped", "delivered"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    for order in orders:
        if order.get("driver_id"):
            d = await db.delivery_drivers.find_one({"driver_id": order["driver_id"]}, {"_id": 0})
            if d:
                u = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0})
                order["driver_name"] = u.get("name") if u else None
                order["driver_vehicle"] = f"{d.get('vehicle_type')} - {d.get('vehicle_number')}"
    return orders



@api_router.get("/merchants/profile")
async def get_merchant_profile(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "merchant":
        raise HTTPException(status_code=403, detail="Merchants only")
    return {"lat": user.get("lat"), "lng": user.get("lng")}

@api_router.patch("/merchants/profile")
async def update_merchant_profile(data: dict, authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "merchant":
        raise HTTPException(status_code=403, detail="Merchants only")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"lat": data.get("lat"), "lng": data.get("lng")}}
    )
    return {"message": "تم تحديث الموقع"}

# ==================== REFERRAL ENDPOINTS ====================

@api_router.get("/referrals/my")
async def get_my_referrals(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)

    if not user.get("referral_code"):
        referral_code = f"SAHAL{uuid.uuid4().hex[:6].upper()}"
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"referral_code": referral_code, "referral_earnings": user.get("referral_earnings", 0.0)}}
        )
        user["referral_code"] = referral_code

    referrals = await db.referrals.find(
        {"referrer_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    return {
        "referral_code": user["referral_code"],
        "total_referred": len(referrals),
        "total_rewarded": sum(1 for r in referrals if r.get("status") == "rewarded"),
        "total_earnings": user.get("referral_earnings", 0.0),
        "referrals": referrals
    }


@api_router.get("/referrals/leaderboard")
async def get_referral_leaderboard():
    pipeline = [
        {"$match": {"referral_code": {"$exists": True, "$ne": None}}},
        {"$lookup": {
            "from": "referrals",
            "localField": "user_id",
            "foreignField": "referrer_id",
            "as": "my_referrals"
        }},
        {"$project": {
            "_id": 0,
            "name": 1,
            "user_id": 1,
            "referral_code": 1,
            "referral_earnings": {"$ifNull": ["$referral_earnings", 0.0]},
            "total_referred": {"$size": "$my_referrals"},
            "total_rewarded": {
                "$size": {
                    "$filter": {
                        "input": "$my_referrals",
                        "cond": {"$eq": ["$$this.status", "rewarded"]}
                    }
                }
            }
        }},
        {"$match": {"total_referred": {"$gt": 0}}},
        {"$sort": {"referral_earnings": -1, "total_referred": -1}},
        {"$limit": 10}
    ]
    return await db.users.aggregate(pipeline).to_list(10)


# ==================== CHAT ENDPOINTS ====================

@api_router.post("/chat")
async def send_chat_message(
    message: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)

    if LLM_AVAILABLE and EMERGENT_LLM_KEY:
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"support_{user['user_id']}",
                system_message="أنت مساعد خدمة العملاء لمنصة سهل. ساعد المستخدمين بود واحترافية. أجب دائماً بالعربية."
            ).with_model("openai", "gpt-4o-mini")
            response = await chat.send_message(UserMessage(text=message))
        except Exception as e:
            logger.error(f"Chat error: {e}")
            response = "عذراً، أواجه مشكلة في معالجة طلبك حالياً. سيتواصل معك فريق الدعم قريباً."
    else:
        # Fallback ردود بسيطة
        responses = {
            "السلام": "وعليكم السلام ورحمة الله! كيف يمكنني مساعدتك في سهل؟",
            "مرحبا": "مرحباً بك في سهل! كيف يمكنني مساعدتك؟",
            "طلب": "يمكنك مراجعة طلباتك من قائمة 'طلباتي'. هل تحتاج مساعدة محددة؟",
            "default": "شكراً لتواصلك. لو احتجت مساعدة محددة في طلباتك أو حسابك، تواصل مع فريق الدعم."
        }
        response = next((v for k, v in responses.items() if k in message), responses["default"])

    await db.chat_messages.insert_one({
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "message": message,
        "response": response,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"response": response}


@api_router.get("/chat/history")
async def get_chat_history(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    messages = await db.chat_messages.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return messages


# ==================== SEED ====================

@api_router.post("/seed/admin")
async def seed_admin():
    admin = await db.users.find_one({"role": "admin"})
    if admin:
        return {"message": "Admin already exists"}

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    admin = User(
        user_id=user_id,
        email="admin@sahal.com",
        name="مدير سهل",
        role="admin",
        password_hash=hash_password("admin123"),
        is_approved=True,
        referral_code=f"SAHAL{uuid.uuid4().hex[:6].upper()}",
        referral_earnings=0.0,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    await db.users.insert_one(admin.model_dump())
    return {
        "message": "Admin created",
        "email": "admin@sahal.com",
        "password": "admin123"
    }


@api_router.get("/health")
async def health_check():
    """نقطة فحص صحة الخادم"""
    return {"status": "ok", "service": "sahal-api"}


# ==================== INCLUDE ROUTER ====================

app.include_router(api_router)

# CORS - استخدم origins محددة في الإنتاج بدل *
# allow_credentials=True لا يعمل مع allow_origins=['*'] في المتصفحات
cors_origins_raw = os.environ.get('CORS_ORIGINS', '')
cors_origins = [o.strip() for o in cors_origins_raw.split(',') if o.strip()]
if not cors_origins:
    cors_origins = ['*']
allow_creds = cors_origins != ['*']
app.add_middleware(
    CORSMiddleware,
    allow_credentials=allow_creds,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@app.get("/")
async def root():
    return {"name": "Sahal API", "version": "1.0.0", "docs": "/docs"}
