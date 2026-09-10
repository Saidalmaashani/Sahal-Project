"""
سهل (Sahal) - منصة التجارة الإلكترونية
Backend API - FastAPI + MongoDB
"""
import os
import uuid
import logging
import secrets
import hashlib
import hmac
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
import asyncio
import json
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt as _bcrypt
import jwt as pyjwt
import httpx
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

# ==================== CONFIG ====================
ROOT_DIR = Path(__file__).parent
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sahal_db')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production-' + secrets.token_hex(16))
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_HOURS = 24 * 7  # أسبوع

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
BACKEND_URL    = os.environ.get('BACKEND_URL', '')  # e.g. https://sahal-backend.onrender.com
FRONTEND_URL   = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
SMTP_HOST      = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT      = int(os.environ.get('SMTP_PORT', '587'))
SMTP_EMAIL     = os.environ.get('SMTP_EMAIL', '')
SMTP_PASSWORD  = os.environ.get('SMTP_PASSWORD', '')

# Environment & feature flags
ENV                 = os.environ.get('ENV', 'development')
ALLOW_MOCK_PAYMENTS = os.environ.get('ALLOW_MOCK_PAYMENTS', 'true').lower() in ('1', 'true', 'yes')
ADMIN_SETUP_TOKEN   = os.environ.get('ADMIN_SETUP_TOKEN', '')

def _mock_payments_allowed() -> bool:
    """الدفع التجريبي: مسموح في التطوير، وفي الإنتاج فقط ما دامت
    بوابة Stripe غير مفعلة (مرحلة الاختبار). ينطفئ تلقائياً عند ربط Stripe."""
    if ENV == "development":
        return ALLOW_MOCK_PAYMENTS
    return ALLOW_MOCK_PAYMENTS and not STRIPE_API_KEY
ADMIN_INITIAL_PASSWORD = os.environ.get('ADMIN_INITIAL_PASSWORD', '')

# VAPID keys for Web Push Notifications
VAPID_PRIVATE_KEY  = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY   = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL        = os.environ.get('VAPID_EMAIL', 'mailto:admin@sahal.com')
ANTHROPIC_API_KEY  = os.environ.get('ANTHROPIC_API_KEY', '')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL   = os.environ.get('OPENROUTER_MODEL', 'google/gemma-4-31b-it:free')
OPENROUTER_FALLBACK_MODELS = [
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nex-agi/nex-n2.5-pro:free',
]

PLATFORM_FEE = 0.07   # 7% إجمالي
ADMIN_FEE    = 0.02   # 2% للمدير
DRIVER_FEE   = 0.05   # 5% للمندوب

# Order status machine (لا يسمح بقفزات غير قانونية بين الحالات)
ORDER_STATUS_TRANSITIONS = {
    "pending":   {"confirmed", "cancelled"},
    "confirmed": {"confirmed", "shipped", "cancelled"},
    "shipped":   {"delivered"},
    "delivered": set(),
    "cancelled": set(),
}
MAX_CART_QUANTITY = 99

# Roles المسموح بالتسجيل الذاتي (admin يُنشأ فقط عبر seed/الإدارة)
REGISTERABLE_ROLES = {"shopper", "merchant", "driver"}


# ==================== WEBSOCKET MANAGER ====================

class ConnectionManager:
    def __init__(self):
        # notifications: {user_id: set of WebSocket}
        self.notifications: dict[str, set] = {}
        # chat: {order_id: set of WebSocket}
        self.chat: dict[str, set] = {}
        # tracking: {order_id: set of WebSocket}
        self.tracking: dict[str, set] = {}

    def _add(self, store: dict, key: str, ws: WebSocket):
        store.setdefault(key, set()).add(ws)

    def _remove(self, store: dict, key: str, ws: WebSocket):
        store.get(key, set()).discard(ws)
        if not store.get(key):
            store.pop(key, None)

    async def _send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data, ensure_ascii=False))
        except Exception:
            pass

    # --- Notifications ---
    def connect_notification(self, user_id: str, ws: WebSocket):
        self._add(self.notifications, user_id, ws)

    def disconnect_notification(self, user_id: str, ws: WebSocket):
        self._remove(self.notifications, user_id, ws)

    async def broadcast_notification(self, user_id: str, data: dict):
        for ws in list(self.notifications.get(user_id, set())):
            await self._send(ws, {"type": "notification", **data})

    # --- Chat ---
    def connect_chat(self, order_id: str, ws: WebSocket):
        self._add(self.chat, order_id, ws)

    def disconnect_chat(self, order_id: str, ws: WebSocket):
        self._remove(self.chat, order_id, ws)

    async def broadcast_chat(self, order_id: str, data: dict):
        for ws in list(self.chat.get(order_id, set())):
            await self._send(ws, {"type": "chat_message", **data})

    # --- Tracking ---
    def connect_tracking(self, order_id: str, ws: WebSocket):
        self._add(self.tracking, order_id, ws)

    def disconnect_tracking(self, order_id: str, ws: WebSocket):
        self._remove(self.tracking, order_id, ws)

    async def broadcast_tracking(self, order_id: str, data: dict):
        for ws in list(self.tracking.get(order_id, set())):
            await self._send(ws, {"type": "tracking_update", **data})


ws_manager = ConnectionManager()

# Uploads directory
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

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
DISABLE_RATE_LIMIT = os.environ.get('SAHAL_DISABLE_RATE_LIMIT', 'false').lower() in ('1', 'true', 'yes')
limiter = Limiter(key_func=get_remote_address)
limiter.enabled = not DISABLE_RATE_LIMIT
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
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
    logo: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: str


class StoreCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    logo: Optional[str] = None


class Product(BaseModel):
    product_id: str
    merchant_id: str
    store_id: Optional[str] = None
    name: str
    description: str
    merchant_price: float        # السعر الذي حدده التاجر
    price: float                 # سعر العميل = merchant_price * 1.08
    admin_fee: float             # 4% من merchant_price
    driver_fee: float            # 4% من merchant_price
    stock: int
    category: str
    brand: Optional[str] = ""
    sku: Optional[str] = ""
    weight: Optional[float] = None
    images: List[str] = []
    created_at: str


class ProductCreate(BaseModel):
    name: str
    description: str
    price: float          # السعر الذي يدخله التاجر (merchant_price)
    stock: int
    category: str
    brand: Optional[str] = ""
    sku: Optional[str] = ""
    weight: Optional[float] = None
    images: List[str] = []


class Review(BaseModel):
    review_id: str
    product_id: str
    user_id: str
    user_name: str
    rating: int          # 1-5
    comment: str
    created_at: str


class ReviewCreate(BaseModel):
    rating: int
    comment: str


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
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    driver_id: Optional[str] = None
    created_at: str
    updated_at: str


class CheckoutRequest(BaseModel):
    items: List[dict]
    delivery_address: str
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class Notification(BaseModel):
    notification_id: str
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool = False
    link: Optional[str] = None
    created_at: str


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


async def _ahash_password(password: str) -> str:
    """bcrypt blocking — يشتغل خارج event loop ليحافظ على استجابة الخادم"""
    return await asyncio.to_thread(hash_password, password)


async def _averify_password(plain: str, hashed: str) -> bool:
    return await asyncio.to_thread(verify_password, plain, hashed)


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
@limiter.limit("3/minute")
async def register(payload: UserRegister, request: Request):
    # تحقق من وجود الإيميل
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم بالفعل")

    # تحقق من صحة الدور — admin غير مسموح بالتسجيل الذاتي
    if payload.role not in REGISTERABLE_ROLES:
        raise HTTPException(status_code=400, detail="دور غير صالح")

    # رقم الهاتف إجباري
    if not payload.phone or not payload.phone.strip():
        raise HTTPException(status_code=400, detail="رقم الهاتف مطلوب")

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
        password_hash=await _ahash_password(payload.password),
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
@limiter.limit("5/minute")
async def login(payload: UserLogin, request: Request):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")

    if not user.get("password_hash") or not await _averify_password(payload.password, user["password_hash"]):
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
    session_id = request.headers.get("X-Session-ID") or request.cookies.get("session_id")
    if session_id:
        await db.user_sessions.delete_one({"session_id": session_id})
    return {"message": "تم تسجيل الخروج"}


# ==================== PASSWORD RESET ====================

def _send_email_sync(to: str, subject: str, html_body: str) -> bool:
    """يرسل إيميل عبر SMTP — يرجع True عند النجاح (sync core, يعمل في thread)"""
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From']    = f"سهل Sahal <{SMTP_EMAIL}>"
    msg['To']      = to
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to, msg.as_string())
    return True


async def _send_email(to: str, subject: str, html_body: str) -> bool:
    """يرسل إيميل عبر SMTP — يرجع True عند النجاح"""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False
    try:
        return await asyncio.to_thread(_send_email_sync, to, subject, html_body)
    except Exception as e:
        logger.error(f"Email error: {e}")
        return False


@api_router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request):
    body = await request.json()
    email = (body.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مطلوب")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    # نفس الرد بغض النظر عن وجود المستخدم (أمان)
    generic_msg = "إذا كان البريد مسجلاً ستصلك رسالة إعادة تعيين خلال دقائق"

    if not user or not user.get("password_hash"):
        return {"message": generic_msg}

    # احذف أي رموز قديمة وأنشئ رمزاً جديداً
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await db.password_resets.delete_many({"email": email})
    await db.password_resets.insert_one({
        "token_hash": token_hash, "user_id": user["user_id"],
        "email": email, "expires_at": expires_at, "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"

    html = f"""
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F8F9FA;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:linear-gradient(135deg,#4338CA,#7C3AED);width:56px;height:56px;border-radius:14px;line-height:56px;font-size:28px;font-weight:700;color:#fff">س</div>
        <h2 style="color:#0F172A;margin:8px 0 0;font-size:22px">سهل</h2>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px">
        <h3 style="color:#4338CA;margin-top:0">إعادة تعيين كلمة المرور</h3>
        <p style="color:#475569">مرحباً {user['name']}،</p>
        <p style="color:#475569">تلقّينا طلباً لإعادة تعيين كلمة المرور لحسابك. اضغط على الزر أدناه:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="{reset_url}" style="background:#4338CA;color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
            إعادة تعيين كلمة المرور
          </a>
        </div>
        <p style="color:#94A3B8;font-size:12px;border-top:1px solid #E2E8F0;padding-top:12px;margin-bottom:0">
          ⏱️ الرابط صالح لمدة ساعة واحدة فقط.<br>
          إذا لم تطلب هذا، تجاهل هذه الرسالة بأمان.
        </p>
      </div>
    </div>
    """

    email_sent = await _send_email(email, "إعادة تعيين كلمة المرور — سهل", html)

    result: dict = {"message": generic_msg}
    if not email_sent:
        # وضع التطوير فقط — أرجع الرابط مباشرة إذا SMTP غير مضبوط
        # في الإنتاج لا نُعيد أي رابط (يمنع استيلاء الحسابات)
        if ENV != "production":
            result["reset_url"] = reset_url
            result["dev_note"] = "SMTP not configured — use reset_url directly"
    return result


@api_router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request):
    body = await request.json()
    token       = (body.get("token") or "").strip()
    new_password = (body.get("password") or "").strip()

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="البيانات غير مكتملة")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 8 أحرف على الأقل")

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    doc = await db.password_resets.find_one({"token_hash": token_hash, "used": False})
    if not doc:
        raise HTTPException(status_code=400, detail="الرابط غير صالح أو تم استخدامه مسبقاً")

    if datetime.now(timezone.utc) > datetime.fromisoformat(doc["expires_at"]):
        raise HTTPException(status_code=400, detail="انتهت صلاحية الرابط — اطلب رابطاً جديداً")

    await db.users.update_one(
        {"user_id": doc["user_id"]},
        {"$set": {"password_hash": await _ahash_password(new_password)}}
    )
    await db.password_resets.update_one({"token_hash": token_hash}, {"$set": {"used": True}})

    return {"message": "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن."}


# ==================== USER PROFILE ====================

@api_router.get("/users/profile")
async def get_profile(authorization: Optional[str] = Header(None), request: Request = None):
    """جلب الملف الشخصي للمستخدم الحالي"""
    user = await get_current_user(authorization, request)
    return user


@api_router.patch("/users/profile")
async def update_profile(
    payload: UserProfileUpdate,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """تحديث بيانات الملف الشخصي"""
    user = await get_current_user(authorization, request)
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        return {"message": "لا يوجد تغييرات"}
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return updated


@api_router.get("/users/orders")
async def get_my_orders(authorization: Optional[str] = Header(None), request: Request = None):
    """طلبات المستخدم مع تفاصيل المنتجات"""
    user = await get_current_user(authorization, request)
    orders = await db.orders.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    # جلب كل المنتجات دفعة واحدة بدلاً من استعلام لكل صنف
    product_ids = {item["product_id"] for o in orders for item in o.get("items", [])}
    products = await db.products.find(
        {"product_id": {"$in": list(product_ids)}}, {"_id": 0}
    ).to_list(len(product_ids) + 1)
    prod_map = {p["product_id"]: p for p in products}

    for order in orders:
        enriched_items = []
        for item in order.get("items", []):
            enriched_items.append({**item, "product": prod_map.get(item["product_id"])})
        order["items"] = enriched_items

    return orders


@api_router.post("/auth/google")
async def google_auth(request: Request):
    body = await request.json()
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")
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
    # فحص موافقة التاجر — نفس فحص تسجيل الدخول العادي
    if user.get("role") == "merchant" and not user.get("is_approved"):
        raise HTTPException(status_code=403, detail="حسابك بانتظار موافقة الإدارة")
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
        logo=payload.logo,
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

    store = await db.stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="المتجر غير موجود")
    await db.stores.update_one({"store_id": store_id}, {"$set": {"status": status}})
    # إشعار للتاجر
    if status == "approved":
        await _create_notification(store["merchant_id"], "store_approved",
            "تمت الموافقة على متجرك! 🎉",
            f"متجرك '{store['name']}' موافق عليه ويمكنك الآن إضافة منتجات",
            "/merchant/dashboard")
    elif status == "rejected":
        await _create_notification(store["merchant_id"], "store_rejected",
            "تم رفض طلب المتجر",
            f"للأسف تم رفض متجرك '{store['name']}'. تواصل مع الإدارة",
            "/merchant/dashboard")
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

    merchant_price = round(payload.price, 3)
    customer_price = round(merchant_price * (1 + PLATFORM_FEE), 3)
    admin_fee      = round(merchant_price * ADMIN_FEE, 3)
    driver_fee     = round(merchant_price * DRIVER_FEE, 3)

    product_id = f"prod_{uuid.uuid4().hex[:12]}"
    product = Product(
        product_id=product_id,
        merchant_id=user["user_id"],
        store_id=approved_store["store_id"],
        name=payload.name,
        description=payload.description,
        merchant_price=merchant_price,
        price=customer_price,
        admin_fee=admin_fee,
        driver_fee=driver_fee,
        stock=payload.stock,
        category=payload.category,
        brand=payload.brand,
        sku=payload.sku,
        weight=payload.weight,
        images=payload.images,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    await db.products.insert_one(product.model_dump())
    return product


@api_router.get("/products")
async def list_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    in_stock_only: bool = True,
    sort_by: Optional[str] = None,   # price_asc | price_desc | rating | newest
    store_id: Optional[str] = None,  # تصفية حسب المتجر
):
    query: dict = {}
    if in_stock_only:
        query["stock"] = {"$gt": 0}
    if store_id:
        query["store_id"] = store_id
    if category and category != "all":
        query["category"] = category
    if search:
        query["$or"] = [
            {"name":        {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"brand":       {"$regex": search, "$options": "i"}},
        ]
    if min_price is not None or max_price is not None:
        price_q: dict = {}
        if min_price is not None: price_q["$gte"] = min_price
        if max_price is not None: price_q["$lte"] = max_price
        query["price"] = price_q
    if min_rating is not None:
        query["average_rating"] = {"$gte": min_rating}

    sort_map = {
        "price_asc":  [("price", 1)],
        "price_desc": [("price", -1)],
        "rating":     [("average_rating", -1), ("review_count", -1)],
        "newest":     [("created_at", -1)],
    }
    sort = sort_map.get(sort_by, [("created_at", -1)])

    cursor = db.products.find(query, {"_id": 0}).sort(sort).limit(200)
    return await cursor.to_list(200)


@api_router.get("/products/search/autocomplete")
async def search_autocomplete(q: str = ""):
    if not q or len(q) < 2:
        return []
    results = await db.products.find(
        {"name": {"$regex": q, "$options": "i"}, "stock": {"$gt": 0}},
        {"_id": 0, "product_id": 1, "name": 1, "price": 1, "category": 1, "images": 1}
    ).limit(8).to_list(8)
    return results


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

    # أحدث 8 منتجات متوفرة فقط
    products = await db.products.find({"stock": {"$gt": 0}}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    return products


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None   # merchant_price
    stock: Optional[int] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    weight: Optional[float] = None
    images: Optional[List[str]] = None


@api_router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    if product["merchant_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تعديل هذا المنتج")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}

    # إعادة حساب الأسعار إذا تغير السعر
    if "price" in update_data:
        merchant_price = round(update_data["price"], 3)
        update_data["merchant_price"] = merchant_price
        update_data["price"] = round(merchant_price * (1 + PLATFORM_FEE), 3)
        update_data["admin_fee"] = round(merchant_price * ADMIN_FEE, 3)
        update_data["driver_fee"] = round(merchant_price * DRIVER_FEE, 3)

    if not update_data:
        return product

    await db.products.update_one({"product_id": product_id}, {"$set": update_data})
    updated = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return updated


@api_router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    if product["merchant_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية حذف هذا المنتج")

    await db.products.delete_one({"product_id": product_id})
    return {"message": "تم حذف المنتج"}


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    return product


# ==================== REVIEWS ENDPOINTS ====================

@api_router.post("/products/{product_id}/reviews")
async def add_review(
    product_id: str,
    payload: ReviewCreate,
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    user = await get_current_user(authorization, request)
    if user["role"] not in ("shopper", "admin"):
        raise HTTPException(status_code=403, detail="فقط المشترون يمكنهم التقييم")

    if not (1 <= payload.rating <= 5):
        raise HTTPException(status_code=400, detail="التقييم يجب أن يكون بين 1 و5")

    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")

    # تحقق أن المستخدم اشترى هذا المنتج فعلاً وتم التوصيل
    delivered_order = await db.orders.find_one({
        "user_id": user["user_id"],
        "status": "delivered",
        "items.product_id": product_id,
    }, {"_id": 0})
    if not delivered_order and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="يمكنك التقييم فقط بعد استلام الطلب")

    # منع التقييم المكرر
    existing = await db.reviews.find_one({"product_id": product_id, "user_id": user["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="قيّمت هذا المنتج مسبقاً")

    review_id = f"rev_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.reviews.insert_one({
        "review_id": review_id,
        "product_id": product_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "rating": payload.rating,
        "comment": payload.comment.strip(),
        "created_at": now,
    })

    # تحديث متوسط التقييم على المنتج
    await _update_product_rating(product_id)

    return {"review_id": review_id, "created_at": now}


@api_router.get("/products/{product_id}/reviews")
async def get_reviews(product_id: str):
    reviews = await db.reviews.find(
        {"product_id": product_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return reviews


@api_router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    user = await get_current_user(authorization, request)
    review = await db.reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="التقييم غير موجود")
    if review["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح")

    product_id = review["product_id"]
    await db.reviews.delete_one({"review_id": review_id})
    await _update_product_rating(product_id)
    return {"message": "تم حذف التقييم"}


@api_router.get("/products/{product_id}/rating")
async def get_product_rating(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0, "rating": 1}).to_list(1000)
    count = len(reviews)
    avg = round(sum(r["rating"] for r in reviews) / count, 1) if count else 0
    dist = {str(i): sum(1 for r in reviews if r["rating"] == i) for i in range(1, 6)}
    return {"average": avg, "count": count, "distribution": dist}


@api_router.get("/users/my-reviews")
async def my_reviews(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    reviews = await db.reviews.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reviews


async def _update_product_rating(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0, "rating": 1}).to_list(1000)
    count = len(reviews)
    avg = round(sum(r["rating"] for r in reviews) / count, 1) if count else 0
    await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"average_rating": avg, "review_count": count}},
    )


# ==================== WISHLIST ENDPOINTS ====================

@api_router.post("/wishlist/toggle/{product_id}")
async def toggle_wishlist(
    product_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    user = await get_current_user(authorization, request)
    existing = await db.wishlists.find_one(
        {"user_id": user["user_id"], "product_id": product_id}
    )
    if existing:
        await db.wishlists.delete_one({"_id": existing["_id"]})
        return {"added": False}
    await db.wishlists.insert_one({
        "wishlist_id": f"wl_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "product_id": product_id,
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"added": True}


@api_router.get("/wishlist")
async def get_wishlist(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    items = await db.wishlists.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("added_at", -1).to_list(500)
    product_ids = [i["product_id"] for i in items]
    products = await db.products.find(
        {"product_id": {"$in": product_ids}}, {"_id": 0}
    ).to_list(500)
    prod_map = {p["product_id"]: p for p in products}
    return [
        {**prod_map[i["product_id"]], "added_at": i["added_at"]}
        for i in items if i["product_id"] in prod_map
    ]


@api_router.get("/wishlist/ids")
async def get_wishlist_ids(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    items = await db.wishlists.find(
        {"user_id": user["user_id"]}, {"_id": 0, "product_id": 1}
    ).to_list(500)
    return [i["product_id"] for i in items]


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

    # ضبط الكمية — لا سالب ولا صفر ولا أكثر من الحد الأقصى
    if quantity < 1 or quantity > MAX_CART_QUANTITY:
        raise HTTPException(status_code=400, detail="الكمية يجب أن تكون بين 1 و 99")

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

    # جلب كل المنتجات دفعة واحدة بدلاً من استعلام لكل عنصر
    product_ids = [item["product_id"] for item in cart_items]
    if product_ids:
        products = await db.products.find(
            {"product_id": {"$in": product_ids}}, {"_id": 0}
        ).to_list(len(product_ids) + 1)
        prod_map = {p["product_id"]: p for p in products}
    else:
        prod_map = {}
    for item in cart_items:
        item["product"] = prod_map.get(item["product_id"])

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

async def _release_stock(reserved: List[tuple]):
    """يُعيد المخزون المحجوز (عند فشل إنشاء الطلب/الدفع)"""
    for pid, qty in reserved:
        await db.products.update_one(
            {"product_id": pid},
            {"$inc": {"stock": qty}}
        )


async def _restore_stock_for_order(order: dict):
    """يُعيد المخزون لطلب ملغي/منتهي"""
    for item in order.get("items", []):
        qty = int(item.get("quantity", 0))
        if qty > 0:
            await db.products.update_one(
                {"product_id": item.get("product_id")},
                {"$inc": {"stock": qty}}
            )


@api_router.post("/checkout")
async def checkout(
    checkout_data: CheckoutRequest,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)

    # تحقق من الكميات (int >= 1) وارفض التكرار
    seen: set = set()
    validated_items = []
    for item in checkout_data.items:
        pid = str(item.get("product_id", "")).strip()
        try:
            qty = int(item.get("quantity", 0))
        except (TypeError, ValueError):
            qty = 0
        if not pid or pid in seen:
            raise HTTPException(status_code=400, detail="عناصر الطلب غير صالحة")
        if qty < 1 or qty > MAX_CART_QUANTITY:
            raise HTTPException(status_code=400, detail="كمية غير صالحة في الطلب")
        seen.add(pid)
        validated_items.append((pid, qty))

    # حجز المخزون بشكل ذرّي قبل إنشاء الطلب — يمنع البيع الزائد
    total = 0.0
    reserved = []
    order_items = []
    for pid, qty in validated_items:
        product = await db.products.find_one({"product_id": pid}, {"_id": 0})
        if not product:
            await _release_stock(reserved)
            raise HTTPException(status_code=404, detail=f"المنتج {pid} غير موجود")
        result = await db.products.update_one(
            {"product_id": pid, "stock": {"$gte": qty}},
            {"$inc": {"stock": -qty}}
        )
        if result.matched_count == 0:
            await _release_stock(reserved)
            raise HTTPException(status_code=400, detail=f"المخزون غير كافٍ للمنتج: {product['name']}")
        reserved.append((pid, qty))
        total += product["price"] * qty
        order_items.append({
            "product_id": pid,
            "quantity": qty,
            "price": product["price"],
            "name": product["name"],
            "category": product.get("category", ""),
        })

    # أنشئ الطلب
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    order = Order(
        order_id=order_id,
        user_id=user["user_id"],
        items=order_items,
        total_amount=round(total, 3),
        status="pending",
        payment_status="pending",
        delivery_address=checkout_data.delivery_address,
        delivery_lat=checkout_data.delivery_lat,
        delivery_lng=checkout_data.delivery_lng,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat()
    )
    await db.orders.insert_one(order.model_dump())

    # Stripe Checkout مباشر (إذا كان STRIPE_API_KEY مضبوطاً)
    if STRIPE_API_KEY:
        base = FRONTEND_URL or (str(request.base_url).rstrip('/'))
        success_url = f"{base}/order-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{base}/cart"
        try:
            async with httpx.AsyncClient() as http:
                resp = await http.post(
                    "https://api.stripe.com/v1/checkout/sessions",
                    auth=(STRIPE_API_KEY, ""),
                    data={
                        "payment_method_types[]": "card",
                        "line_items[0][price_data][currency]": os.environ.get('STRIPE_CURRENCY', 'usd'),
                        "line_items[0][price_data][unit_amount]": str(int(round(total, 2) * 100)),
                        "line_items[0][price_data][product_data][name]": "طلب سهل",
                        "line_items[0][quantity]": "1",
                        "mode": "payment",
                        "success_url": success_url,
                        "cancel_url": cancel_url,
                        "metadata[order_id]": order_id,
                        "metadata[user_id]": user["user_id"],
                    }
                )
        except Exception as e:
            logger.error(f"Stripe session error: {e}")
            await _restore_stock_for_order(order.model_dump())
            await db.orders.delete_one({"order_id": order_id})
            raise HTTPException(status_code=502, detail="فشل إنشاء جلسة الدفع")
        if resp.status_code != 200:
            await _restore_stock_for_order(order.model_dump())
            await db.orders.delete_one({"order_id": order_id})
            raise HTTPException(status_code=502, detail="فشل إنشاء جلسة الدفع")
        session = resp.json()
        await db.payment_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "order_id": order_id,
            "session_id": session["id"],
            "user_id": user["user_id"],
            "amount": total,
            "currency": os.environ.get('STRIPE_CURRENCY', 'usd'),
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.cart_items.delete_many({"user_id": user["user_id"]})
        return {"checkout_url": session["url"], "session_id": session["id"], "order_id": order_id}

    # الـ Mock للتطوير/الاختبار فقط — يُغلق تلقائياً عند تفعيل Stripe
    if not _mock_payments_allowed():
        await _restore_stock_for_order(order.model_dump())
        await db.orders.delete_one({"order_id": order_id})
        raise HTTPException(status_code=503, detail="الدفع غير مُعد بعد — راجع الإدارة")

    mock_session = f"cs_mock_{uuid.uuid4().hex[:12]}"
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "order_id": order_id,
        "session_id": mock_session,
        "user_id": user["user_id"],
        "amount": total,
        "currency": os.environ.get('STRIPE_CURRENCY', 'usd'),
        "payment_status": "paid",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "paid", "status": "confirmed"}}
    )
    await db.cart_items.delete_many({"user_id": user["user_id"]})
    await _process_referral_reward(user["user_id"], total)
    await _create_notification(user["user_id"], "order_confirmed",
        "تم تأكيد طلبك!", f"طلبك #{order_id[-8:]} تم تأكيده وسيُجهَّز قريباً",
        f"/my-orders")
    merchant_ids = set()
    for item in order_items:
        prod = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0, "merchant_id": 1})
        if prod:
            merchant_ids.add(prod.get("merchant_id"))
    for mid in merchant_ids:
        if mid:
            await _create_notification(mid, "new_order",
                "طلب جديد!", f"وصلك طلب جديد بقيمة {total:.3f} ر.ع",
                "/merchant/dashboard")
    return {"checkout_url": f"/order-success?session_id={mock_session}", "session_id": mock_session, "order_id": order_id}


@api_router.get("/payment/status/{session_id}")
async def get_payment_status(
    session_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="معاملة غير موجودة")

    # صاحب الطلب فقط (أو admin) — يمنع استفسار الآخرين عن معاملاتك
    try:
        user = await get_current_user(authorization, request)
    except HTTPException:
        user = None
    if not user or (user["user_id"] != transaction.get("user_id") and user["role"] != "admin"):
        raise HTTPException(status_code=403, detail="غير مصرح")

    if STRIPE_API_KEY and not session_id.startswith("cs_mock_"):
        # تحقق من حالة الدفع عبر Stripe API مباشرة
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"https://api.stripe.com/v1/checkout/sessions/{session_id}",
                auth=(STRIPE_API_KEY, "")
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="فشل التحقق من الدفع")
        stripe_data = resp.json()
        payment_status = stripe_data.get("payment_status", "unpaid")
        if transaction["payment_status"] != "paid" and payment_status == "paid":
            order_id = stripe_data.get("metadata", {}).get("order_id")
            user_id = stripe_data.get("metadata", {}).get("user_id")
            await db.payment_transactions.update_one(
                {"session_id": session_id}, {"$set": {"payment_status": "paid"}}
            )
            if order_id:
                await db.orders.update_one(
                    {"order_id": order_id},
                    {"$set": {"payment_status": "paid", "status": "confirmed"}}
                )
            if user_id:
                await _process_referral_reward(user_id, stripe_data.get("amount_total", 0) / 100)
        return {
            "session_id": session_id,
            "payment_status": payment_status,
            "amount_total": stripe_data.get("amount_total", 0),
            "currency": stripe_data.get("currency", "usd"),
            "metadata": stripe_data.get("metadata", {})
        }

    # Mock path — للتطوير/الاختبار فقط، يُغلق عند ربط Stripe
    if not _mock_payments_allowed():
        raise HTTPException(status_code=503, detail="الدفع غير مُعد — راجع الإدارة")

    if transaction["payment_status"] != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id}, {"$set": {"payment_status": "paid"}}
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


def _verify_stripe_signature(payload: bytes, header: str, secret: str) -> bool:
    """تحقق من توقيع Webhook بين Stripe والخادم (HMAC SHA-256)"""
    try:
        ts = None
        sigs = []
        for item in header.split(','):
            k, _, v = item.partition('=')
            if k == 't':
                ts = v
            elif k == 'v1':
                sigs.append(v)
        if not ts or not sigs:
            return False
        payload_str = payload.decode('utf-8')
        for sig in sigs:
            expected = hmac.new(secret.encode(), f"{ts}.{payload_str}".encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, sig):
                return True
        return False
    except Exception:
        return False


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Webhook من Stripe — تأكيد الدفع / فشله بشكل موثوق وضروري"""
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET not set — webhook signature NOT verified. Configure it in production!")
    elif not _verify_stripe_signature(payload, signature, STRIPE_WEBHOOK_SECRET):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        session_id = data.get("id")
        txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not txn or txn.get("payment_status") == "paid":
            return {"received": True}

        await db.payment_transactions.update_one(
            {"session_id": session_id}, {"$set": {"payment_status": "paid"}}
        )
        await db.orders.update_one(
            {"order_id": txn["order_id"]},
            {"$set": {"payment_status": "paid", "status": "confirmed"}}
        )
        await _process_referral_reward(txn["user_id"], txn["amount"])

        order = await db.orders.find_one({"order_id": txn["order_id"]}, {"_id": 0})
        if order:
            await _create_notification(txn["user_id"], "order_confirmed",
                "تم تأكيد طلبك!", f"طلبك #{order['order_id'][-8:]} تم تأكيده بعد الدفع",
                "/my-orders")
            merchant_ids = set()
            for item in order.get("items", []):
                prod = await db.products.find_one({"product_id": item.get("product_id")}, {"_id": 0, "merchant_id": 1})
                if prod:
                    merchant_ids.add(prod.get("merchant_id"))
            for mid in merchant_ids:
                if mid:
                    await _create_notification(mid, "new_order",
                        "طلب جديد!", f"وصلك طلب جديد بقيمة {order['total_amount']:.3f} ر.ع",
                        "/merchant/dashboard")

    elif event_type in ("checkout.session.expired", "payment_intent.payment_failed"):
        session_id = data.get("id") or data.get("payment_intent")
        txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if txn and txn.get("payment_status") != "paid":
            order = await db.orders.find_one({"order_id": txn["order_id"]}, {"_id": 0})
            if order:
                await _restore_stock_for_order(order)
                await db.orders.update_one(
                    {"order_id": txn["order_id"]},
                    {"$set": {"status": "cancelled", "payment_status": "failed"}}
                )
            await db.payment_transactions.update_one(
                {"session_id": session_id}, {"$set": {"payment_status": "failed"}}
            )

    return {"received": True}


async def _create_notification(user_id: str, notif_type: str, title: str, message: str, link: str = None):
    """إنشاء إشعار لمستخدم + بث WebSocket + Web Push"""
    notif_id = f"notif_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    notif_doc = {
        "notification_id": notif_id,
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "is_read": False,
        "link": link,
        "created_at": now,
    }
    await db.notifications.insert_one(notif_doc)
    # بث فوري عبر WebSocket
    await ws_manager.broadcast_notification(user_id, notif_doc)
    # Web Push للأجهزة
    await _send_push_to_user(user_id, title, message, link or "/")


async def _process_referral_reward(user_id: str, amount: float):
    """معالجة مكافأة الإحالة عند أول شراء — بمطالبة ذرّية تمنع الدفع المزدوج"""
    buyer = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not buyer or not buyer.get("referred_by"):
        return

    reward = round(amount * 0.10, 2)
    claimed = await db.referrals.find_one_and_update(
        {"referred_id": user_id, "status": "pending"},
        {"$set": {
            "status": "rewarded",
            "reward_amount": reward,
            "rewarded_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    # لم نجد إحالة بانتظار المكافأة → أُعطيت سابقاً (لا دفع مزدوج)
    if not claimed:
        return

    await db.users.update_one(
        {"user_id": buyer["referred_by"]},
        {"$inc": {"referral_earnings": reward}}
    )
    await _create_notification(
        buyer["referred_by"], "referral_reward",
        "مكافأة إحالة!",
        f"حصلت على {reward} ر.ع من إحالة صديق",
        "/referrals"
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


# ==================== ORDER CHAT ====================

async def _order_chat_access(order_id: str, user: dict) -> dict:
    """تحقق من صلاحية الوصول لمحادثة الطلب"""
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")

    if user["role"] == "admin" or order["user_id"] == user["user_id"]:
        return order

    if user["role"] == "merchant":
        for item in order.get("items", []):
            prod = await db.products.find_one(
                {"product_id": item["product_id"], "merchant_id": user["user_id"]}, {"_id": 0}
            )
            if prod:
                return order

    if user["role"] == "driver":
        drv = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if drv and order.get("driver_id") == drv.get("driver_id"):
            return order

    raise HTTPException(status_code=403, detail="غير مصرح")


@api_router.post("/orders/{order_id}/messages")
async def send_order_message(
    order_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(authorization, request)
    order = await _order_chat_access(order_id, user)

    body = await request.json()
    message_text = (body.get("message") or "").strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="الرسالة فارغة")

    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    msg_doc = {
        "message_id": message_id,
        "order_id": order_id,
        "sender_id": user["user_id"],
        "sender_name": user["name"],
        "sender_role": user["role"],
        "message": message_text,
        "created_at": now,
    }
    await db.order_messages.insert_one(msg_doc)
    # بث فوري لجميع المشتركين في محادثة الطلب
    await ws_manager.broadcast_chat(order_id, msg_doc)

    # إشعار للأطراف الأخرى
    recipients: set = set()
    if order["user_id"] != user["user_id"]:
        recipients.add(order["user_id"])
    products_in_order = []
    for item in order.get("items", []):
        prod = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if prod:
            products_in_order.append(prod)
            if prod["merchant_id"] != user["user_id"]:
                recipients.add(prod["merchant_id"])
    if order.get("driver_id"):
        drv = await db.delivery_drivers.find_one({"driver_id": order["driver_id"]}, {"_id": 0})
        if drv and drv["user_id"] != user["user_id"]:
            recipients.add(drv["user_id"])

    role_labels = {"shopper": "زبون", "merchant": "تاجر", "driver": "مندوب", "admin": "مدير"}
    sender_label = role_labels.get(user["role"], "")
    for rid in recipients:
        await _create_notification(
            rid, "new_message",
            f"رسالة جديدة من {user['name']} ({sender_label})",
            message_text[:80],
            "/my-orders"
        )

    return {"message_id": message_id, "created_at": now}


@api_router.get("/orders/{order_id}/messages")
async def get_order_messages(
    order_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    user = await get_current_user(authorization, request)
    await _order_chat_access(order_id, user)
    messages = await db.order_messages.find(
        {"order_id": order_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return messages


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

    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")

    current_status = order.get("status", "pending")
    allowed_next = ORDER_STATUS_TRANSITIONS.get(current_status, set())
    if status not in allowed_next:
        raise HTTPException(status_code=400, detail=f"لا يمكن نقل الطلب من '{current_status}' إلى '{status}'")

    # تحقق من الصلاحية حسب الدور
    if user["role"] == "merchant":
        # التاجر يخدم فقط الطلبات التي تحتوي منتجاته، ويقتصر على تأكيد أو إلغاء
        if status not in {"confirmed", "cancelled"}:
            raise HTTPException(status_code=403, detail="غير مصرح لهذه الحالة")
        my_products = await db.products.find(
            {"merchant_id": user["user_id"]}, {"_id": 0, "product_id": 1}
        ).to_list(10000)
        my_ids = {p["product_id"] for p in my_products}
        if not any(item.get("product_id") in my_ids for item in order.get("items", [])):
            raise HTTPException(status_code=403, detail="هذا الطلب لا يخصك")

    if user["role"] == "driver":
        if status != "delivered":
            raise HTTPException(status_code=403, detail="غير مصرح لهذه الحالة")
        driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if not driver or order.get("driver_id") != driver["driver_id"]:
            raise HTTPException(status_code=403, detail="هذا الطلب ليس لك")

    # لا يمكن التسليم إلا بدفع مؤكد
    if status == "delivered" and order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="لا يمكن التسليم قبل تأكيد الدفع")

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


@api_router.get("/drivers/stats")
async def get_driver_stats(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")
    driver = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="ملف السائق غير موجود")

    delivered = await db.orders.find(
        {"driver_id": driver["driver_id"], "status": "delivered", "payment_status": "paid"},
        {"_id": 0, "total_amount": 1, "created_at": 1, "updated_at": 1}
    ).to_list(2000)

    total_delivered = len(delivered)
    total_earnings  = round(sum(o.get("total_amount", 0) * 0.05 for o in delivered), 3)
    total_revenue   = round(sum(o.get("total_amount", 0) for o in delivered), 3)

    # أيام نشطة
    active_days = len({o["created_at"][:10] for o in delivered if o.get("created_at")})

    return {
        "total_delivered": total_delivered,
        "total_earnings":  total_earnings,
        "total_revenue":   total_revenue,
        "active_days":     active_days,
        "driver_id":       driver["driver_id"],
        "vehicle_type":    driver.get("vehicle_type"),
        "vehicle_number":  driver.get("vehicle_number"),
        "is_available":    driver.get("is_available", True),
    }


@api_router.get("/deliveries")
async def get_deliveries(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)

    # كل دور يرى فقط ما يخصه — لا تسريب لطلبات الآخرين
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
    elif user["role"] == "admin":
        orders = await db.orders.find(
            {"payment_status": "paid", "status": {"$in": ["confirmed", "shipped"]}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
    else:
        # التاجر: طلبات تحتوي على منتجاته فقط. المشتري: طلباته فقط.
        query: dict = {"payment_status": "paid", "status": {"$in": ["confirmed", "shipped"]}}
        if user["role"] == "merchant":
            my_products = await db.products.find(
                {"merchant_id": user["user_id"]}, {"_id": 0, "product_id": 1}
            ).to_list(10000)
            product_ids = [p["product_id"] for p in my_products]
            if not product_ids:
                return []
            query["items.product_id"] = {"$in": product_ids}
        else:
            query["user_id"] = user["user_id"]
        orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)

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

    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    driver = await db.delivery_drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="المندوب غير موجود")
    if not driver.get("is_available", False):
        raise HTTPException(status_code=400, detail="هذا المندوب غير متاح حالياً")

    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"driver_id": driver_id, "status": "shipped", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.delivery_drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"is_available": False}}
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

    now = datetime.now(timezone.utc).isoformat()
    result = await db.delivery_drivers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "current_lat": lat,
            "current_lng": lng,
            "location_updated_at": now,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="ملف السائق غير موجود")

    # بث الموقع لجميع المشتركين في تتبع الطلبات المرتبطة بهذا السائق
    driver_doc = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if driver_doc:
        active_orders = await db.orders.find(
            {"driver_id": driver_doc["driver_id"], "status": "shipped"},
            {"order_id": 1, "_id": 0}
        ).to_list(20)
        tracking_payload = {
            "lat": lat, "lng": lng,
            "updated_at": now,
            "driver_id": driver_doc["driver_id"],
        }
        for o in active_orders:
            await ws_manager.broadcast_tracking(o["order_id"], tracking_payload)

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
        "delivery_lat": order.get("delivery_lat"),
        "delivery_lng": order.get("delivery_lng"),
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
    await db.delivery_drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {"is_available": True}}
    )
    # إشعار للمتسوق
    await _create_notification(order["user_id"], "order_delivered",
        "تم توصيل طلبك! ✅",
        f"طلبك #{order_id[-8:]} وصل بنجاح. نتمنى أن تكون راضياً",
        "/my-orders")
    return {"message": "تم التوصيل بنجاح"}


# ==================== BARCODE DELIVERY CONFIRMATION ====================

@api_router.post("/deliveries/{order_id}/generate-qr")
async def generate_delivery_qr(
    order_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    """المندوب يُولّد رمز QR لتأكيد التسليم"""
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
    if order.get("status") != "shipped":
        raise HTTPException(status_code=400, detail="الطلب ليس في حالة توصيل")

    # إلغاء أي رمز قديم لنفس الطلب
    await db.delivery_confirmations.delete_many({"order_id": order_id, "status": "pending"})

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=30)

    await db.delivery_confirmations.insert_one({
        "token":      token,
        "order_id":   order_id,
        "driver_id":  driver["driver_id"],
        "user_id":    order["user_id"],
        "status":     "pending",
        "expires_at": expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    frontend_url = FRONTEND_URL
    confirm_url  = f"{frontend_url}/confirm-delivery/{token}"

    return {
        "token":       token,
        "confirm_url": confirm_url,
        "expires_at":  expires.isoformat(),
        "order_id":    order_id,
    }


@api_router.get("/deliveries/confirm/{token}")
async def get_confirmation_info(token: str):
    """معلومات الطلب بالرمز — عام (لا يحتاج تسجيل دخول)"""
    doc = await db.delivery_confirmations.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="رمز غير صالح")
    if doc["status"] == "confirmed":
        return {"status": "confirmed", "order_id": doc["order_id"]}
    if datetime.fromisoformat(doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="انتهت صلاحية الرمز")

    order = await db.orders.find_one({"order_id": doc["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")

    driver = await db.delivery_drivers.find_one({"driver_id": doc["driver_id"]}, {"_id": 0})
    driver_user = await db.users.find_one({"user_id": driver["user_id"]}, {"_id": 0}) if driver else None

    return {
        "status":           "pending",
        "order_id":         doc["order_id"],
        "total_amount":     order.get("total_amount"),
        "delivery_address": order.get("delivery_address"),
        "items":            order.get("items", []),
        "driver_name":      driver_user.get("name") if driver_user else None,
        "driver_phone":     driver_user.get("phone") if driver_user else None,
        "expires_at":       doc["expires_at"],
        "customer_user_id": doc["user_id"],
    }


@api_router.post("/deliveries/confirm/{token}")
async def confirm_delivery_by_qr(
    token: str,
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    """الزبون يؤكد الاستلام"""
    user = await get_current_user(authorization, request)

    doc = await db.delivery_confirmations.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="رمز غير صالح")
    if doc["status"] == "confirmed":
        raise HTTPException(status_code=400, detail="تم التأكيد مسبقاً")
    if datetime.fromisoformat(doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="انتهت صلاحية الرمز")

    # التحقق أن المستخدم هو صاحب الطلب
    if doc["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="هذا الطلب ليس لك")

    now = datetime.now(timezone.utc).isoformat()

    # تحديث الطلب → مُسلَّم
    await db.orders.update_one(
        {"order_id": doc["order_id"]},
        {"$set": {"status": "delivered", "updated_at": now}}
    )

    # تحديث السائق → متاح
    await db.delivery_drivers.update_one(
        {"driver_id": doc["driver_id"]},
        {"$set": {"is_available": True}}
    )

    # تحديث رمز التأكيد
    await db.delivery_confirmations.update_one(
        {"token": token},
        {"$set": {"status": "confirmed", "confirmed_at": now, "confirmed_by": user["user_id"]}}
    )

    # إشعار للزبون والمندوب
    await _create_notification(doc["user_id"], "order_delivered",
        "تم تأكيد استلامك للطلب ✅",
        f"طلبك #{doc['order_id'][-8:]} أُكِّد استلامه بتوقيعك الرقمي",
        "/my-orders")

    driver = await db.delivery_drivers.find_one({"driver_id": doc["driver_id"]}, {"_id": 0})
    if driver:
        await _create_notification(driver["user_id"], "order_delivered",
            "أكّد الزبون الاستلام! 🎉",
            f"طلب #{doc['order_id'][-8:]} تم تأكيده من الزبون",
            "/driver/dashboard")

    # بث WebSocket
    await ws_manager.broadcast_notification(doc["user_id"], {
        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
        "type": "order_delivered", "is_read": False,
        "title": "تم تأكيد الاستلام ✅",
        "message": f"طلب #{doc['order_id'][-8:]}",
        "link": "/my-orders", "created_at": now,
    })

    return {"message": "تم تأكيد الاستلام بنجاح", "order_id": doc["order_id"]}

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
    if order.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="لا يمكن قبول هذا الطلب — حالته غير مؤهلة")
    
    await db.orders.update_one(
        {"order_id": order_id, "driver_id": None, "status": "confirmed"},
        {"$set": {"driver_id": driver["driver_id"], "status": "shipped", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # تأكد ذرّياً أن التحديث نجح — مندوب آخر قد يكون سبقك بالطلبية
    updated_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "driver_id": 1})
    if not updated_order or updated_order.get("driver_id") != driver["driver_id"]:
        raise HTTPException(status_code=409, detail="تم قبول هذا الطلب من مندوب آخر للتو")

    await db.delivery_drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {"is_available": False}}
    )
    # إشعار للمتسوق
    await _create_notification(order["user_id"], "order_shipped",
        "المندوب في الطريق إليك! 🚚",
        f"طلبك #{order_id[-8:]} تم استلامه من المندوب وهو في طريقه إليك",
        f"/track/{order_id}")
    return {"message": "تم قبول الطلب بنجاح"}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/users")
async def get_all_users(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    address: Optional[str] = None
    is_approved: Optional[bool] = None


class AdminCreateUser(BaseModel):
    name: str
    email: str
    password: str
    role: str = "shopper"
    phone: Optional[str] = None


class AdminNotifyPayload(BaseModel):
    title: str
    message: str
    link: Optional[str] = None


@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    payload: AdminUserUpdate,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """تعديل بيانات أي مستخدم"""
    admin = await get_current_user(authorization, request)
    if admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "role" in update_data and update_data["role"] not in ["admin", "merchant", "shopper", "driver"]:
        raise HTTPException(status_code=400, detail="دور غير صالح")

    if update_data:
        await db.users.update_one({"user_id": user_id}, {"$set": update_data})

    updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """حذف مستخدم وبياناته"""
    admin = await get_current_user(authorization, request)
    if admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="لا يمكنك حذف حسابك الخاص")

    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    await db.users.delete_one({"user_id": user_id})
    await db.cart_items.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.push_subscriptions.delete_many({"user_id": user_id})
    return {"message": "تم حذف المستخدم"}


@api_router.post("/admin/users")
async def admin_create_user(
    payload: AdminCreateUser,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """إنشاء مستخدم جديد من قِبَل المدير"""
    admin = await get_current_user(authorization, request)
    if admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم بالفعل")
    if payload.role not in ["admin", "merchant", "shopper", "driver"]:
        raise HTTPException(status_code=400, detail="دور غير صالح")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = User(
        user_id=user_id,
        email=payload.email.lower(),
        name=payload.name,
        role=payload.role,
        password_hash=await _ahash_password(payload.password),
        phone=payload.phone,
        is_approved=True,
        referral_code=f"SAHAL{uuid.uuid4().hex[:6].upper()}",
        referral_earnings=0.0,
        created_at=datetime.now(timezone.utc).isoformat(),
        auth_provider="local"
    )
    await db.users.insert_one(new_user.model_dump())
    result = new_user.model_dump()
    result.pop("password_hash", None)
    return result


@api_router.post("/admin/users/{user_id}/notify")
async def admin_notify_user(
    user_id: str,
    payload: AdminNotifyPayload,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """إرسال إشعار/رسالة لمستخدم معين"""
    admin = await get_current_user(authorization, request)
    if admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")

    await _create_notification(user_id, "admin_message", payload.title, payload.message, payload.link or "/")
    return {"message": "تم الإرسال"}


@api_router.post("/admin/broadcast")
async def admin_broadcast(
    payload: AdminNotifyPayload,
    role: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """إرسال إشعار جماعي لكل المستخدمين أو لدور محدد"""
    admin = await get_current_user(authorization, request)
    if admin["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    query = {}
    if role and role != "all":
        query["role"] = role

    all_users = await db.users.find(query, {"_id": 0, "user_id": 1}).to_list(10000)
    for u in all_users:
        await _create_notification(u["user_id"], "admin_message", payload.title, payload.message, payload.link or "/")

    return {"message": f"تم الإرسال لـ {len(all_users)} مستخدم"}


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


def _merchant_order_share(order: dict, price_map: dict) -> float:
    """إيراد التاجر من طلب = مجموع (سعر × كمية) لمنتجات التاجر فقط داخل الطلب"""
    share = 0.0
    for item in order.get("items", []):
        pid = item.get("product_id")
        if pid not in price_map:
            continue
        qty = item.get("quantity", 1)
        price = item.get("price") or price_map.get(pid, 0)
        try:
            share += float(price) * int(qty)
        except (TypeError, ValueError):
            continue
    return round(share, 3)


@api_router.get("/admin/analytics")
async def get_analytics(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] not in ["admin", "merchant"]:
        raise HTTPException(status_code=403, detail="Access denied")

    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})

    if user["role"] == "merchant":
        products = await db.products.find(
            {"merchant_id": user["user_id"]}, {"_id": 0, "product_id": 1, "price": 1}
        ).to_list(1000)
        price_map = {p["product_id"]: p.get("price", 0) for p in products}
        paid_orders = await db.orders.find(
            {"payment_status": "paid", "items.product_id": {"$in": list(price_map.keys())}},
            {"_id": 0}
        ).to_list(1000)
        total_revenue = sum(_merchant_order_share(o, price_map) for o in paid_orders)
    else:
        paid_orders = await db.orders.find(
            {"payment_status": "paid"}, {"_id": 0, "total_amount": 1}
        ).to_list(1000)
        total_revenue = round(sum(o.get("total_amount", 0) for o in paid_orders), 3)

    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": total_revenue
    }


@api_router.get("/admin/analytics/charts")
async def get_analytics_charts(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    if user["role"] not in ["admin", "merchant"]:
        raise HTTPException(status_code=403, detail="Access denied")

    is_merchant = user["role"] == "merchant"

    # تصفية الطلبات حسب الدور
    if is_merchant:
        products = await db.products.find({"merchant_id": user["user_id"]}, {"_id": 0, "product_id": 1, "category": 1, "name": 1}).to_list(1000)
        product_ids = {p["product_id"] for p in products}
        all_paid = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(2000)
        paid_orders = [
            o for o in all_paid
            if any(i.get("product_id") in product_ids for i in o.get("items", []))
        ]
    else:
        paid_orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(2000)
        all_orders  = await db.orders.find({}, {"_id": 0, "status": 1}).to_list(2000)

    # 1. إيرادات آخر 6 أشهر
    from collections import defaultdict
    monthly: dict = defaultdict(lambda: {"revenue": 0.0, "orders": 0})
    now = datetime.now(timezone.utc)

    merchant_price_map = {}
    if is_merchant:
        merchant_price_map = {
            p["product_id"]: p.get("price", 0)
            for p in await db.products.find(
                {"merchant_id": user["user_id"]}, {"_id": 0, "product_id": 1, "price": 1}
            ).to_list(10000)
        }

    for o in paid_orders:
        try:
            dt = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
            diff = (now.year - dt.year) * 12 + (now.month - dt.month)
            if 0 <= diff < 6:
                key = dt.strftime("%Y-%m")
                if is_merchant:
                    monthly[key]["revenue"] += _merchant_order_share(o, merchant_price_map)
                else:
                    monthly[key]["revenue"] += o.get("total_amount", 0)
                monthly[key]["orders"]  += 1
        except Exception:
            pass

    # أكمل الأشهر الفارغة
    monthly_revenue = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0: m += 12; y -= 1
        key = f"{y}-{m:02d}"
        ar_months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                     "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
        monthly_revenue.append({
            "month": ar_months[m - 1],
            "revenue": round(monthly[key]["revenue"], 3),
            "orders":  monthly[key]["orders"],
        })

    # 2. توزيع الطلبات حسب الحالة (admin فقط)
    status_dist = []
    if not is_merchant:
        from collections import Counter
        counts = Counter(o["status"] for o in all_orders)
        label_map = {"pending": "قيد الانتظار", "confirmed": "مؤكد",
                     "shipped": "قيد التوصيل", "delivered": "تم التوصيل", "cancelled": "ملغى"}
        colors = {"pending": "#F59E0B", "confirmed": "#4338CA",
                  "shipped": "#7C3AED", "delivered": "#10B981", "cancelled": "#E11D48"}
        status_dist = [
            {"name": label_map.get(k, k), "value": v, "color": colors.get(k, "#94A3B8")}
            for k, v in counts.items()
        ]

    # 3. أفضل الفئات
    cat_revenue: dict = defaultdict(float)
    for o in paid_orders:
        for item in o.get("items", []):
            cat = item.get("category", "أخرى")
            cat_revenue[cat] += item.get("price", 0) * item.get("quantity", 1)
    top_categories = sorted(
        [{"category": k, "revenue": round(v, 3)} for k, v in cat_revenue.items()],
        key=lambda x: x["revenue"], reverse=True
    )[:6]

    # 4. الطلبات اليومية — آخر 14 يوم
    daily: dict = defaultdict(int)
    cutoff = now - timedelta(days=14)
    for o in paid_orders:
        try:
            dt = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
            if dt >= cutoff:
                daily[dt.strftime("%m/%d")] += 1
        except Exception:
            pass

    daily_orders = []
    for i in range(13, -1, -1):
        d = now - timedelta(days=i)
        key = d.strftime("%m/%d")
        daily_orders.append({"day": key, "orders": daily.get(key, 0)})

    return {
        "monthly_revenue": monthly_revenue,
        "status_distribution": status_dist,
        "top_categories": top_categories,
        "daily_orders": daily_orders,
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


# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications")
async def get_notifications(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    notifs = await db.notifications.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    unread = sum(1 for n in notifs if not n.get("is_read"))
    return {"notifications": notifs, "unread_count": unread}


@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "تم"}


@api_router.patch("/notifications/read-all")
async def mark_all_read(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    await db.notifications.update_many(
        {"user_id": user["user_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "تم تحديد الكل كمقروء"}


@api_router.delete("/notifications/clear")
async def clear_read_notifications(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    await db.notifications.delete_many({"user_id": user["user_id"], "is_read": True})
    return {"message": "تم حذف الإشعارات المقروءة"}


# ==================== CHAT ENDPOINTS ====================

@api_router.post("/chat")
async def send_chat_message(
    message: str,
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    user = await get_current_user(authorization, request)

    # جلب سياق المستخدم
    orders = await db.orders.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    recent_chat = await db.chat_messages.find(
        {"user_id": user["user_id"]}, {"_id": 0, "message": 1, "response": 1}
    ).sort("created_at", -1).limit(6).to_list(6)
    recent_chat.reverse()

    orders_summary = "\n".join(
        f"- طلب #{o['order_id'][-8:]}: {o['status']} — {o['total_amount']:.3f} ر.ع"
        for o in orders
    ) or "لا توجد طلبات"

    system_prompt = f"""أنت مساعد ذكاء اصطناعي متخصص لمنصة "سهل" للتجارة الإلكترونية العربية.
تحدث دائماً باللغة العربية الفصحى البسيطة، وكن مختصراً ومفيداً.

معلومات المستخدم الحالي:
- الاسم: {user['name']}
- الدور: {'مشتري' if user['role']=='shopper' else 'تاجر' if user['role']=='merchant' else 'مندوب' if user['role']=='driver' else 'مدير'}
- البريد: {user['email']}

آخر طلباته:
{orders_summary}

قواعد:
- لا تخترع معلومات غير موجودة
- إذا لم تعرف الإجابة قل ذلك بصراحة واقترح التواصل مع الدعم
- ردودك لا تزيد عن 3-4 جمل إلا إذا تطلب السياق أكثر
- يمكنك الإجابة عن: الطلبات، الدفع، التوصيل، المتاجر، المنتجات، الحساب، الإحالات"""

    # بناء تاريخ المحادثة
    history_messages = []
    for turn in recent_chat:
        history_messages.append({"role": "user", "content": turn["message"]})
        history_messages.append({"role": "assistant", "content": turn["response"]})
    history_messages.append({"role": "user", "content": message})

    response_text = ""
    if OPENROUTER_API_KEY:
        # OpenRouter — واجهة متوافقة مع OpenAI chat completions.
        # النماذج المجانية قد تُحظَر لحظياً (429/404) فنجرّب عدة نماذج بالترتيب.
        candidate_models = [OPENROUTER_MODEL] + OPENROUTER_FALLBACK_MODELS
        response_text = ""
        last_or_error = ""
        for mdl in candidate_models:
            try:
                async with httpx.AsyncClient(timeout=60) as http:
                    or_resp = await http.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": mdl,
                            "max_tokens": 512,
                            "messages": [{"role": "system", "content": system_prompt}] + history_messages,
                        },
                    )
                    or_json = or_resp.json()
                if or_resp.status_code == 200 and or_json.get("choices"):
                    response_text = or_json["choices"][0]["message"]["content"]
                    break
                last_or_error = f"{mdl}: HTTP {or_resp.status_code} {or_json.get('error', {}).get('message', '')}"
            except Exception as e:
                last_or_error = f"{mdl}: {e}"
        if not response_text:
            logger.warning(f"OpenRouter API error: {last_or_error}")
            response_text = _fallback_response(message)
    elif ANTHROPIC_API_KEY:
        try:
            import anthropic as _anthropic
            client = _anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            # العميل متزامن — يشغّله في thread حتى لا يحجب event loop
            resp = await asyncio.to_thread(
                client.messages.create,
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                system=system_prompt,
                messages=history_messages,
            )
            response_text = resp.content[0].text
        except Exception as e:
            logger.warning(f"Claude API error: {e}")
            response_text = _fallback_response(message)
    else:
        response_text = _fallback_response(message)

    await db.chat_messages.insert_one({
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "message": message,
        "response": response_text,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    return {"response": response_text}


def _fallback_response(message: str) -> str:
    keywords = {
        "السلام": "وعليكم السلام ورحمة الله! كيف يمكنني مساعدتك؟",
        "مرحبا": "مرحباً بك في سهل! كيف يمكنني مساعدتك اليوم؟",
        "طلب": "يمكنك مراجعة طلباتك من قسم 'طلباتي'. هل تحتاج مساعدة في طلب معين؟",
        "دفع": "ندعم الدفع بالبطاقة البنكية عبر Stripe. المدفوعات آمنة ومشفرة.",
        "توصيل": "يُخصَّص مندوب تلقائياً بعد تأكيد الدفع. تابع طلبك من صفحة التتبع.",
        "متجر": "سجّل كتاجر وأرسل طلب إنشاء متجر. سيراجعه الفريق خلال 24 ساعة.",
        "إحالة": "برنامج الإحالة يمنحك 10% من قيمة أول طلب لكل صديق تدعوه.",
    }
    return next((v for k, v in keywords.items() if k in message),
                "شكراً لتواصلك مع سهل! سيتواصل معك فريق الدعم قريباً. 😊")


@api_router.get("/chat/history")
async def get_chat_history(authorization: Optional[str] = Header(None), request: Request = None):
    user = await get_current_user(authorization, request)
    messages = await db.chat_messages.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return messages


# ==================== IMAGE UPLOAD ====================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

def _sniff_image_type(data: bytes) -> Optional[str]:
    """يكتشف نوع الصورة من Magic Bytes — لا يثق بـ Content-Type المُرسل من العميل"""
    if data[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    if data[:4] == b'GIF8':
        return "image/gif"
    if len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    return None


def _build_base_url(request: Request) -> str:
    """يبني الـ base URL الصحيح في الإنتاج وفي التطوير"""
    if BACKEND_URL:
        return BACKEND_URL.rstrip("/")
    # fallback: استخدم headers الـ proxy إذا كانت موجودة
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host  = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{proto}://{host}"


@api_router.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """رفع صورة — يحفظها في MongoDB ويعيد URL دائم لا يتأثر بإعادة النشر"""
    await get_current_user(authorization, request)

    # تحقق من الحجم أولاً قبل القراءة الكاملة (يمنع DoS على الذاكرة)
    if file.size and file.size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="حجم الصورة يجب ألا يتجاوز 5MB")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="حجم الصورة يجب ألا يتجاوز 5MB")

    # Sniff من Magic Bytes — لا نثق بـ Content-Type المُرسل من العميل
    sniffed = _sniff_image_type(contents)
    if sniffed not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="نوع الملف غير مدعوم أو الملف تالف. استخدم JPEG أو PNG أو WebP")

    ext = {".jpg": "jpg", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}[sniffed]

    file_id = uuid.uuid4().hex
    content_type = sniffed

    # الحفظ في MongoDB بدل filesystem (يبقى بعد كل redeploy)
    await db.uploaded_files.insert_one({
        "file_id": file_id,
        "ext": ext,
        "content_type": content_type,
        "data": contents,
        "size": len(contents),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    base = _build_base_url(request)
    return {"url": f"{base}/api/files/{file_id}"}


@api_router.get("/files/{file_id}")
async def serve_file(file_id: str):
    """يعيد بيانات الصورة المخزنة في MongoDB"""
    doc = await db.uploaded_files.find_one({"file_id": file_id}, {"_id": 0, "content_type": 1, "data": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ==================== WEB PUSH NOTIFICATIONS ====================

def _push_single_sync(subscription: dict, payload: str, vapid_private_key: str, vapid_email: str):
    """إرسال Push واحد متزامن — يُرجع http status أو None عند النجاح"""
    from pywebpush import webpush
    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=vapid_private_key,
            vapid_claims={"sub": vapid_email},
        )
        return None
    except Exception as exc:
        return getattr(getattr(exc, 'response', None), 'status_code', None)


def _push_all_sync(subs: list, payload: str, vapid_private_key: str, vapid_email: str) -> list:
    """عميل Web Push متزامن — يشتغل بمعزل خارج event loop ويُعيد الاشتراكات منتهية الصلاحية"""
    from pywebpush import webpush
    expired = []
    for sub in subs:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_email},
            )
            logger.info(f"Push sent OK to {sub['subscription'].get('endpoint','')[:60]}")
        except Exception as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status in (404, 410):
                endpoint = sub["subscription"].get("endpoint")
                if endpoint:
                    expired.append(endpoint)
            else:
                logger.warning(f"Push send error ({status}): {exc}")
    return expired


async def _send_push_to_user(user_id: str, title: str, body: str, url: str = "/"):
    """إرسال Web Push لكل اشتراكات المستخدم"""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.debug("Push skipped — VAPID keys not set")
        return
    try:
        subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
        if not subs:
            return
        payload = json.dumps({"title": title, "body": body, "url": url})
        logger.info(f"Sending push to {user_id} ({len(subs)} subscription(s)): {title}")
        expired = await asyncio.to_thread(
            _push_all_sync, subs, payload, VAPID_PRIVATE_KEY, VAPID_EMAIL
        )
        for endpoint in expired:
            try:
                await db.push_subscriptions.delete_one({"subscription.endpoint": endpoint})
            except Exception:
                pass
    except ImportError:
        logger.error("pywebpush not installed — run: pip install pywebpush")
    except Exception as e:
        logger.error(f"Push error: {e}")


@api_router.get("/push/vapid-key")
async def get_vapid_key():
    """إعادة المفتاح العام للـ VAPID"""
    if not VAPID_PUBLIC_KEY or not isinstance(VAPID_PUBLIC_KEY, str) or len(VAPID_PUBLIC_KEY) < 10:
        raise HTTPException(status_code=503, detail="Push notifications not configured — VAPID_PUBLIC_KEY missing")
    return {"public_key": VAPID_PUBLIC_KEY}


@api_router.post("/push/subscribe")
async def push_subscribe(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """حفظ اشتراك Push للمستخدم الحالي"""
    user = await get_current_user(authorization, request)
    body = await request.json()
    subscription = body.get("subscription")
    if not subscription or not subscription.get("endpoint"):
        raise HTTPException(status_code=400, detail="Invalid subscription")

    endpoint = subscription["endpoint"]
    # تحديث أو إنشاء
    await db.push_subscriptions.update_one(
        {"user_id": user["user_id"], "subscription.endpoint": endpoint},
        {"$set": {
            "sub_id": f"sub_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "subscription": subscription,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"message": "subscribed"}


@api_router.post("/push/test")
async def push_test(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """إرسال إشعار اختبار فوري — يظهر حتى عند قفل الشاشة"""
    user = await get_current_user(authorization, request)
    subs = await db.push_subscriptions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10)
    if not subs:
        raise HTTPException(status_code=404, detail="لا يوجد اشتراك Push — فعّل الإشعارات أولاً")

    payload = json.dumps({
        "title": "اختبار سهل 🔔",
        "body": f"مرحباً {user['name']}! الإشعارات تعمل ✅ — اقفل الشاشة لتراها",
        "url": "/shop"
    })
    try:
        results = []
        for sub in subs:
            endpoint = sub["subscription"].get("endpoint", "")
            platform = "Apple/iOS" if "apple.com" in endpoint else "Chrome/Android" if "google" in endpoint or "fcm" in endpoint else "Other"
            status_code = await asyncio.to_thread(
                _push_single_sync, sub["subscription"], payload, VAPID_PRIVATE_KEY, VAPID_EMAIL
            )
            if status_code is None or status_code in (404, 410):
                results.append({"platform": platform, "status": "expired", "endpoint": endpoint[:50]})
                if status_code in (404, 410):
                    await db.push_subscriptions.delete_one({"subscription.endpoint": endpoint})
            else:
                results.append({"platform": platform, "status": "sent", "endpoint": endpoint[:50]})
    except ImportError:
        raise HTTPException(status_code=503, detail="pywebpush not installed on server")

    success = any(r["status"] == "sent" for r in results)
    return {
        "success": success,
        "results": results,
        "hint": "اقفل شاشة جهازك — يجب أن يظهر الإشعار خلال ثوانٍ" if success else "فشل الإرسال — تحقق من VAPID keys في Render"
    }


@api_router.get("/push/status")
async def push_status(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """تشخيص كامل لحالة Push"""
    user = await get_current_user(authorization, request)
    subs = await db.push_subscriptions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10)

    sub_info = []
    for s in subs:
        ep = s["subscription"].get("endpoint", "")
        platform = "Apple/iOS (APNS)" if "apple.com" in ep else \
                   "Chrome/Android (FCM)" if ("google" in ep or "fcm" in ep or "googleapis" in ep) else \
                   "Firefox" if "mozilla" in ep else "Unknown"
        sub_info.append({
            "platform": platform,
            "endpoint_preview": ep[:70] + "...",
            "saved_at": s.get("updated_at"),
        })

    return {
        "vapid_ok": bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and isinstance(VAPID_PUBLIC_KEY, str) and len(VAPID_PUBLIC_KEY) > 20),
        "vapid_public_key_preview": (VAPID_PUBLIC_KEY[:20] + "...") if VAPID_PUBLIC_KEY else "NOT SET",
        "subscriptions_count": len(subs),
        "subscriptions": sub_info,
        "user": user["name"],
    }


@api_router.post("/push/refresh")
async def push_refresh(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """حذف الاشتراكات القديمة — المستخدم يُعيد الاشتراك بمفاتيح الخادم الحالية"""
    user = await get_current_user(authorization, request)
    result = await db.push_subscriptions.delete_many({"user_id": user["user_id"]})
    return {
        "deleted": result.deleted_count,
        "vapid_public_key": VAPID_PUBLIC_KEY,
        "message": "تم حذف الاشتراكات القديمة — أعد الاشتراك الآن"
    }


@api_router.delete("/push/unsubscribe")
async def push_unsubscribe(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """إلغاء اشتراك Push"""
    user = await get_current_user(authorization, request)
    body = await request.json()
    endpoint = body.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"user_id": user["user_id"], "subscription.endpoint": endpoint})
    else:
        await db.push_subscriptions.delete_many({"user_id": user["user_id"]})
    return {"message": "unsubscribed"}


# ==================== SEED ====================

@api_router.post("/seed/admin")
async def seed_admin(request: Request):
    admin = await db.users.find_one({"role": "admin"})
    if admin:
        return {"message": "Admin already exists"}

    # في الإنتاج (أو عند ضبط ADMIN_SETUP_TOKEN) يجب تمرير الرمز السري في الهيدر
    header_token = request.headers.get("X-Admin-Setup-Token", "")
    if ENV == "production" or ADMIN_SETUP_TOKEN:
        if not ADMIN_SETUP_TOKEN or not hmac.compare_digest(header_token, ADMIN_SETUP_TOKEN):
            raise HTTPException(status_code=403, detail="Forbidden: ADMIN_SETUP_TOKEN required")

    password = ADMIN_INITIAL_PASSWORD
    if not password:
        # التطوير فقط: admin123. الإنتاج: كلمة عشوائية تُطبع في log مرة واحدة.
        password = "admin123" if ENV != "production" else secrets.token_urlsafe(16)

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    admin = User(
        user_id=user_id,
        email="admin@sahal.com",
        name="مدير سهل",
        role="admin",
        password_hash=await _ahash_password(password),
        is_approved=True,
        referral_code=f"SAHAL{uuid.uuid4().hex[:6].upper()}",
        referral_earnings=0.0,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    await db.users.insert_one(admin.model_dump())

    if ENV == "production":
        logger.warning(f"Admin seeded with password from ADMIN_INITIAL_PASSWORD. Email: admin@sahal.com")
        return {
            "message": "Admin created",
            "email": "admin@sahal.com",
            "note": "Password set from ADMIN_INITIAL_PASSWORD. Change it immediately after first login."
        }
    return {
        "message": "Admin created",
        "email": "admin@sahal.com",
        "password": password
    }


@api_router.get("/health")
async def health_check():
    """نقطة فحص صحة الخادم"""
    return {"status": "ok", "service": "sahal-api"}


# ==================== WEBSOCKET ENDPOINTS ====================

async def _ws_auth(websocket: WebSocket) -> dict | None:
    """تحقق من JWT في WebSocket — الرمز يُمرَّر عبر subprotocol بدلاً من الـ query string
    (الـ query string يتسرب إلى سجلات الـ proxy والمتصفح)"""
    protocols = (websocket.headers.get("sec-websocket-protocol", "") or "").split(",")
    token = ""
    for p in protocols:
        p = p.strip()
        if p and p not in {"chat", "tracking", "notifications"}:
            token = p
            break
    if not token:
        return None
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        return user
    except Exception:
        return None


async def _has_order_access(user: dict, order: dict) -> bool:
    """تحقق من صلاحية الوصول لطلب معين (chat/tracking)"""
    if user["role"] == "admin" or order.get("user_id") == user["user_id"]:
        return True
    if user["role"] == "merchant":
        my_products = await db.products.find(
            {"merchant_id": user["user_id"]}, {"_id": 0, "product_id": 1}
        ).to_list(10000)
        my_ids = {p["product_id"] for p in my_products}
        if any(item.get("product_id") in my_ids for item in order.get("items", [])):
            return True
    if user["role"] == "driver":
        drv = await db.delivery_drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if drv and order.get("driver_id") == drv.get("driver_id"):
            return True
    return False


@app.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket):
    user = await _ws_auth(websocket)
    if not user:
        await websocket.close(code=4001)
        return
    await websocket.accept()
    ws_manager.connect_notification(user["user_id"], websocket)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect_notification(user["user_id"], websocket)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.websocket("/ws/chat/{order_id}")
async def ws_chat(websocket: WebSocket, order_id: str):
    user = await _ws_auth(websocket)
    if not user:
        await websocket.close(code=4001)
        return
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        await websocket.close(code=4004)
        return
    # فقط الأطراف المرتبطة بالطلب
    if not await _has_order_access(user, order):
        await websocket.close(code=4003)
        return
    await websocket.accept()
    ws_manager.connect_chat(order_id, websocket)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect_chat(order_id, websocket)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.websocket("/ws/tracking/{order_id}")
async def ws_tracking(websocket: WebSocket, order_id: str):
    user = await _ws_auth(websocket)
    if not user:
        await websocket.close(code=4001)
        return
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        await websocket.close(code=4004)
        return
    # المالك، أو admin، أو المندوب المكلف فقط
    if not await _has_order_access(user, order):
        await websocket.close(code=4003)
        return
    await websocket.accept()
    ws_manager.connect_tracking(order_id, websocket)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect_tracking(order_id, websocket)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


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


async def _sweep_stale_orders():
    """يلغي الطلبات المعلقة القديمة التي لم تُدفع ويُعيد المخزون المحجوز"""
    while True:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            stale = await db.orders.find(
                {"status": "pending", "payment_status": "pending", "created_at": {"$lte": cutoff}},
                {"_id": 0}
            ).to_list(200)
            for order in stale:
                await _restore_stock_for_order(order)
                await db.orders.update_one(
                    {"order_id": order["order_id"]},
                    {"$set": {"status": "cancelled", "payment_status": "failed",
                              "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
        except Exception as e:
            logger.warning(f"Sweep error: {e}")
        await asyncio.sleep(15 * 60)


@app.on_event("startup")
async def init_vapid_keys():
    """تحميل أو توليد مفاتيح VAPID — تُحفظ في MongoDB لتبقى ثابتة عبر إعادة التشغيل"""
    global VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY

    # 1) المفاتيح موجودة في env → استخدمها
    if VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY and len(VAPID_PUBLIC_KEY) > 20:
        logger.info(f"VAPID loaded from env. Public: {VAPID_PUBLIC_KEY[:20]}...")
        return

    # 2) حاول تحميلها من MongoDB
    config = await db.system_config.find_one({"key": "vapid_keys"}, {"_id": 0})
    if config and config.get("private_key") and config.get("public_key"):
        VAPID_PRIVATE_KEY = config["private_key"]
        VAPID_PUBLIC_KEY  = config["public_key"]
        logger.info(f"VAPID loaded from MongoDB. Public: {VAPID_PUBLIC_KEY[:20]}...")
        return

    # 3) أنشئها لأول مرة واحفظها في MongoDB
    try:
        import base64 as _b64
        from py_vapid import Vapid
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
        _v = Vapid()
        _v.generate_keys()
        VAPID_PRIVATE_KEY = _v.private_pem().decode()
        _pub_bytes = _v._private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        VAPID_PUBLIC_KEY  = _b64.urlsafe_b64encode(_pub_bytes).decode().rstrip('=')

        await db.system_config.update_one(
            {"key": "vapid_keys"},
            {"$set": {
                "key": "vapid_keys",
                "private_key": VAPID_PRIVATE_KEY,
                "public_key":  VAPID_PUBLIC_KEY,
                "created_at":  datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True
        )
        logger.info(f"VAPID keys generated & saved to MongoDB. Public: {VAPID_PUBLIC_KEY}")
    except Exception as e:
        logger.error(f"Failed to generate VAPID keys: {e}. Push notifications disabled.")


@app.on_event("startup")
async def init_indexes():
    """إنشاء الفهارس اللازمة (unique على الحقول الحرجة) — يمنع الازدواج والبطء"""
    index_specs = [
        {"col": db.users, "keys": "user_id", "opts": {"unique": True}},
        {"col": db.users, "keys": "email", "opts": {"unique": True}},
        {"col": db.users, "keys": "referral_code", "opts": {"sparse": True, "unique": True}},
        {"col": db.stores, "keys": "store_id", "opts": {"unique": True}},
        {"col": db.stores, "keys": "merchant_id", "opts": {}},
        {"col": db.products, "keys": "product_id", "opts": {"unique": True}},
        {"col": db.products, "keys": "merchant_id", "opts": {}},
        {"col": db.products, "keys": "category", "opts": {}},
        {"col": db.products, "keys": "store_id", "opts": {}},
        {"col": db.products, "keys": "name", "opts": {}},
        {"col": db.reviews, "keys": "review_id", "opts": {"unique": True}},
        {"col": db.reviews, "keys": [("product_id", 1), ("user_id", 1)], "opts": {}},
        {"col": db.cart_items, "keys": [("user_id", 1), ("product_id", 1)], "opts": {"unique": True}},
        {"col": db.orders, "keys": "order_id", "opts": {"unique": True}},
        {"col": db.orders, "keys": "user_id", "opts": {}},
        {"col": db.orders, "keys": "status", "opts": {}},
        {"col": db.orders, "keys": "driver_id", "opts": {}},
        {"col": db.orders, "keys": [("user_id", 1), ("status", 1)], "opts": {}},
        {"col": db.payment_transactions, "keys": "session_id", "opts": {"unique": True}},
        {"col": db.password_resets, "keys": "token_hash", "opts": {"unique": True}},
        {"col": db.delivery_confirmations, "keys": "token", "opts": {"unique": True}},
        {"col": db.delivery_confirmations, "keys": "order_id", "opts": {}},
        {"col": db.notifications, "keys": "user_id", "opts": {}},
        {"col": db.order_messages, "keys": "order_id", "opts": {}},
        {"col": db.referrals, "keys": "referred_id", "opts": {}},
        {"col": db.referrals, "keys": "referrer_id", "opts": {}},
        {"col": db.delivery_drivers, "keys": "user_id", "opts": {"unique": True}},
    ]
    for spec in index_specs:
        try:
            await spec["col"].create_index(spec["keys"], **spec["opts"])
        except Exception:
            # قد يفشل unique إن وُجدت بيانات مكررة سابقة — يُسجَّل فقط
            pass
    logger.info("Database indexes ensured")


@app.on_event("startup")
async def start_background_tasks():
    # تُعديل: لا نبدأ مهمة الفحص الدوري في بيئة الاختبار كي لا تُعيَّد الكرة على
    # event loop مغلق عبر TestClient (يتركه pytest ينظّف بنفسه)
    if DISABLE_RATE_LIMIT and os.environ.get("SAHAL_TEST_MODE", "false").lower() in ("1", "true", "yes"):
        logger.info("Skipping periodic sweep task: running under test mode.")
        app.state.sweep_task = None
        return
    existing = getattr(app.state, "sweep_task", None)
    if existing is None or existing.done():
        app.state.sweep_task = asyncio.create_task(_sweep_stale_orders())


@app.on_event("shutdown")
async def shutdown_db_client():
    task = getattr(app.state, "sweep_task", None)
    if task:
        task.cancel()
    client.close()


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.get("/")
async def root():
    return {"name": "Sahal API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}
