"""
سهل (Sahal) - منصة التجارة الإلكترونية
Backend API - FastAPI + MongoDB
"""
import os
import uuid
import logging
import secrets
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

load_dotenv()

# ==================== CONFIG ====================
ROOT_DIR = Path(__file__).parent
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sahal_db')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production-' + secrets.token_hex(16))
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_HOURS = 24 * 7  # أسبوع

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
BACKEND_URL    = os.environ.get('BACKEND_URL', '')  # e.g. https://sahal-backend.onrender.com
FRONTEND_URL   = os.environ.get('FRONTEND_URL', 'https://sahal-frontend.onrender.com')
SMTP_HOST      = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT      = int(os.environ.get('SMTP_PORT', '587'))
SMTP_EMAIL     = os.environ.get('SMTP_EMAIL', '')
SMTP_PASSWORD  = os.environ.get('SMTP_PASSWORD', '')

# VAPID keys for Web Push Notifications
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY  = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL       = os.environ.get('VAPID_EMAIL', 'mailto:admin@sahal.com')

PLATFORM_FEE = 0.07   # 7% إجمالي
ADMIN_FEE    = 0.02   # 2% للمدير
DRIVER_FEE   = 0.05   # 5% للمندوب


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
    session_id = request.headers.get("X-Session-ID") or request.cookies.get("session_id")
    if session_id:
        await db.user_sessions.delete_one({"session_id": session_id})
    return {"message": "تم تسجيل الخروج"}


# ==================== PASSWORD RESET ====================

async def _send_email(to: str, subject: str, html_body: str) -> bool:
    """يرسل إيميل عبر SMTP — يرجع True عند النجاح"""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False
    try:
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
    except Exception as e:
        logger.error(f"Email error: {e}")
        return False


@api_router.post("/auth/forgot-password")
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
    token = uuid.uuid4().hex
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await db.password_resets.delete_many({"email": email})
    await db.password_resets.insert_one({
        "token": token, "user_id": user["user_id"],
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
        # وضع التطوير — أرجع الرابط مباشرة إذا SMTP غير مضبوط
        result["reset_url"] = reset_url
        result["dev_note"] = "SMTP not configured — use reset_url directly"
    return result


@api_router.post("/auth/reset-password")
async def reset_password(request: Request):
    body = await request.json()
    token       = (body.get("token") or "").strip()
    new_password = (body.get("password") or "").strip()

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="البيانات غير مكتملة")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 8 أحرف على الأقل")

    doc = await db.password_resets.find_one({"token": token, "used": False})
    if not doc:
        raise HTTPException(status_code=400, detail="الرابط غير صالح أو تم استخدامه مسبقاً")

    if datetime.now(timezone.utc) > datetime.fromisoformat(doc["expires_at"]):
        raise HTTPException(status_code=400, detail="انتهت صلاحية الرابط — اطلب رابطاً جديداً")

    await db.users.update_one(
        {"user_id": doc["user_id"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    await db.password_resets.update_one({"token": token}, {"$set": {"used": True}})

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

    for order in orders:
        enriched_items = []
        for item in order.get("items", []):
            product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
            enriched_items.append({**item, "product": product})
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
async def list_products(category: Optional[str] = None, search: Optional[str] = None):
    """قائمة المنتجات العامة — يُخفي المنتجات المنفدة تلقائياً"""
    query = {"stock": {"$gt": 0}}
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

    # احسب المجموع وتحقق من المخزون
    total = 0.0
    for item in checkout_data.items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"المنتج {item['product_id']} غير موجود")
        if product["stock"] < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"المخزون غير كافٍ للمنتج: {product['name']}")
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
        delivery_lat=checkout_data.delivery_lat,
        delivery_lng=checkout_data.delivery_lng,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat()
    )
    await db.orders.insert_one(order.model_dump())

    # Stripe Checkout مباشر (إذا كان STRIPE_API_KEY مضبوطاً)
    if STRIPE_API_KEY:
        origin = request.headers.get('origin', str(request.base_url).rstrip('/'))
        success_url = f"{origin}/order-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/cart"
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                "https://api.stripe.com/v1/checkout/sessions",
                auth=(STRIPE_API_KEY, ""),
                data={
                    "payment_method_types[]": "card",
                    "line_items[0][price_data][currency]": "usd",
                    "line_items[0][price_data][unit_amount]": str(int(total * 100)),
                    "line_items[0][price_data][product_data][name]": "طلب سهل",
                    "line_items[0][quantity]": "1",
                    "mode": "payment",
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                    "metadata[order_id]": order_id,
                    "metadata[user_id]": user["user_id"],
                }
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="فشل إنشاء جلسة الدفع")
        session = resp.json()
        await db.payment_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "order_id": order_id,
            "session_id": session["id"],
            "user_id": user["user_id"],
            "amount": total,
            "currency": "usd",
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        for item in checkout_data.items:
            await db.products.update_one(
                {"product_id": item["product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )
        await db.cart_items.delete_many({"user_id": user["user_id"]})
        return {"checkout_url": session["url"], "session_id": session["id"], "order_id": order_id}
    else:
        # Mock للتطوير — يؤكد الطلب فوراً
        mock_session = f"cs_mock_{uuid.uuid4().hex[:12]}"
        await db.payment_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "order_id": order_id,
            "session_id": mock_session,
            "user_id": user["user_id"],
            "amount": total,
            "currency": "usd",
            "payment_status": "paid",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"payment_status": "paid", "status": "confirmed"}}
        )
        # تخفيض المخزون
        for item in checkout_data.items:
            await db.products.update_one(
                {"product_id": item["product_id"]},
                {"$inc": {"stock": -item["quantity"]}}
            )
        await db.cart_items.delete_many({"user_id": user["user_id"]})
        await _process_referral_reward(user["user_id"], total)
        # إشعار للمتسوق
        await _create_notification(user["user_id"], "order_confirmed",
            "تم تأكيد طلبك!", f"طلبك #{order_id[-8:]} تم تأكيده وسيُجهَّز قريباً",
            f"/my-orders")
        # إشعار للتجار المعنيين
        merchant_ids = set()
        for item in checkout_data.items:
            prod = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
            if prod:
                merchant_ids.add(prod["merchant_id"])
        for mid in merchant_ids:
            await _create_notification(mid, "new_order",
                "طلب جديد!", f"وصلك طلب جديد بقيمة {total:.3f} ر.ع",
                "/merchant/dashboard")
        return {"checkout_url": f"/order-success?session_id={mock_session}", "session_id": mock_session, "order_id": order_id}


@api_router.get("/payment/status/{session_id}")
async def get_payment_status(session_id: str):
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="معاملة غير موجودة")

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
    else:
        # Mock
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
            # إشعار لصاحب الإحالة
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
        {"order_id": order_id},
        {"$set": {"driver_id": driver["driver_id"], "status": "shipped", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
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
        password_hash=hash_password(payload.password),
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

    # ردود ذكية بسيطة — يمكن استبدالها بـ OpenAI API مباشرة لاحقاً
    keywords = {
        "السلام": "وعليكم السلام ورحمة الله! كيف يمكنني مساعدتك في سهل؟",
        "مرحبا": "مرحباً بك في سهل! كيف يمكنني مساعدتك اليوم؟",
        "طلب": "يمكنك مراجعة طلباتك من لوحة التحكم. هل تحتاج مساعدة في طلب معين؟",
        "دفع": "ندعم الدفع بالبطاقة البنكية عبر Stripe. المدفوعات آمنة ومشفرة بالكامل.",
        "توصيل": "يتم تخصيص مندوب توصيل تلقائياً بعد تأكيد الدفع. يمكنك تتبع طلبك من صفحة التتبع.",
        "متجر": "لإنشاء متجر، سجّل كتاجر وأرسل طلب إنشاء متجر. سيراجعه الفريق خلال 24 ساعة.",
        "كلمة المرور": "لاسترجاع كلمة المرور، تواصل مع الدعم عبر البريد الإلكتروني.",
        "إحالة": "برنامج الإحالة يمنحك 10% من قيمة أول طلب لكل صديق تدعوه.",
    }
    response = next((v for k, v in keywords.items() if k in message),
                    "شكراً لتواصلك مع سهل! سيتواصل معك فريق الدعم في أقرب وقت. 😊")

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


# ==================== IMAGE UPLOAD ====================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

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

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="نوع الملف غير مدعوم. استخدم JPEG أو PNG أو WebP")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="حجم الصورة يجب ألا يتجاوز 5MB")

    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"

    file_id = uuid.uuid4().hex
    content_type = file.content_type or "image/jpeg"

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
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ==================== WEB PUSH NOTIFICATIONS ====================

async def _send_push_to_user(user_id: str, title: str, body: str, url: str = "/"):
    """إرسال Web Push لكل اشتراكات المستخدم"""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.debug("Push skipped — VAPID keys not set")
        return
    try:
        from pywebpush import webpush, WebPushException
        import json as _json
        subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(20)
        if not subs:
            return
        payload = _json.dumps({"title": title, "body": body, "url": url})
        logger.info(f"Sending push to {user_id} ({len(subs)} subscription(s)): {title}")
        for sub in subs:
            try:
                webpush(
                    subscription_info=sub["subscription"],
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_EMAIL},
                )
                logger.info(f"Push sent OK to {sub['subscription'].get('endpoint','')[:60]}")
            except Exception as exc:
                status = getattr(getattr(exc, 'response', None), 'status_code', None)
                if status in (404, 410):
                    logger.info(f"Push subscription expired — deleting")
                    await db.push_subscriptions.delete_one({"subscription.endpoint": sub["subscription"].get("endpoint")})
                else:
                    logger.warning(f"Push send error ({status}): {exc}")
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
        raise HTTPException(status_code=404, detail=f"لا يوجد اشتراك Push — فعّل الإشعارات أولاً")

    results = []
    try:
        from pywebpush import webpush, WebPushException
        import json as _json
        payload = _json.dumps({
            "title": "اختبار سهل 🔔",
            "body": f"مرحباً {user['name']}! الإشعارات تعمل ✅ — اقفل الشاشة لتراها",
            "url": "/shop"
        })
        for sub in subs:
            endpoint = sub["subscription"].get("endpoint", "")
            platform = "Apple/iOS" if "apple.com" in endpoint else "Chrome/Android" if "google" in endpoint or "fcm" in endpoint else "Other"
            try:
                webpush(
                    subscription_info=sub["subscription"],
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_EMAIL},
                )
                results.append({"platform": platform, "status": "sent", "endpoint": endpoint[:50]})
            except Exception as exc:
                status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
                results.append({"platform": platform, "status": "failed", "error": str(exc)[:100], "http_status": status_code})
                if status_code in (404, 410):
                    await db.push_subscriptions.delete_one({"subscription.endpoint": endpoint})
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


# ==================== WEBSOCKET ENDPOINTS ====================

async def _ws_auth(token: str) -> dict | None:
    """تحقق من JWT في WebSocket"""
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        return user
    except Exception:
        return None


@app.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket, token: str = ""):
    user = await _ws_auth(token)
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


@app.websocket("/ws/chat/{order_id}")
async def ws_chat(websocket: WebSocket, order_id: str, token: str = ""):
    user = await _ws_auth(token)
    if not user:
        await websocket.close(code=4001)
        return
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        await websocket.close(code=4004)
        return
    await websocket.accept()
    ws_manager.connect_chat(order_id, websocket)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect_chat(order_id, websocket)


@app.websocket("/ws/tracking/{order_id}")
async def ws_tracking(websocket: WebSocket, order_id: str, token: str = ""):
    user = await _ws_auth(token)
    if not user:
        await websocket.close(code=4001)
        return
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        await websocket.close(code=4004)
        return
    await websocket.accept()
    ws_manager.connect_tracking(order_id, websocket)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect_tracking(order_id, websocket)


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

@app.get("/")
async def root():
    return {"name": "Sahal API", "version": "1.0.0", "docs": "/docs"}
