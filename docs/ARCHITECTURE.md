# 🏗️ البنية المعمارية - سهل

## نظرة عامة

سهل تطبيق ويب من 3 طبقات:
1. **Frontend** - React SPA يخدم 4 لوحات تحكم (حسب الدور)
2. **Backend** - FastAPI REST API
3. **Database** - MongoDB لكل البيانات

```
┌─────────────────┐     HTTPS      ┌──────────────┐
│  React Frontend │ ───────────────▶│  FastAPI     │
│   (Port 3000)   │ ◀─────────────── │  (Port 8000) │
└─────────────────┘                 └──────┬───────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │   MongoDB    │
                                    │  (Port 27017)│
                                    └──────────────┘
```

## 📁 بنية المجلدات

```
sahal/
├── backend/
│   ├── server.py              # كل الـ endpoints في ملف واحد
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/
│       └── test_backend.py    # اختبارات pytest
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js             # Router الرئيسي
│   │   ├── index.js
│   │   ├── App.css
│   │   ├── index.css          # Tailwind base + fonts
│   │   ├── contexts/
│   │   │   └── AuthContext.js # إدارة الـ auth state
│   │   ├── components/
│   │   │   ├── SupportChat.js
│   │   │   └── ui/            # shadcn components
│   │   ├── pages/             # كل الصفحات
│   │   ├── utils/
│   │   │   └── api.js         # axios instance
│   │   └── lib/
│   │       └── utils.js       # cn() helper
│   ├── package.json
│   ├── tailwind.config.js
│   ├── craco.config.js
│   └── components.json        # shadcn config
│
└── docs/
    ├── ARCHITECTURE.md
    ├── SECURITY.md
    └── PRD.md
```

## 👥 الأدوار والصلاحيات

| الدور | الموافقة المسبقة | الصلاحيات |
|-------|------------------|----------|
| **admin** | ✅ تلقائية | كل شي - إدارة المستخدمين، الموافقة على المتاجر، التحليلات |
| **merchant** | ❌ يحتاج موافقة Admin | إنشاء متاجر، إضافة منتجات (بعد اعتماد المتجر)، عرض طلباته |
| **shopper** | ✅ تلقائية | تصفح، شراء، تتبع طلبات، إحالات |
| **driver** | ✅ تلقائية | إكمال ملف السائق، استلام توصيلات، مشاركة الموقع |

## 🔄 تدفقات المستخدم الرئيسية

### تدفق التاجر
```
تسجيل → بانتظار موافقة Admin → موافقة → تسجيل دخول
   → إنشاء متجر → بانتظار اعتماد المتجر → اعتماد
   → إضافة منتجات → استقبال الطلبات
```

### تدفق المتسوق
```
تسجيل → تسجيل دخول → تصفح → إضافة للسلة
   → checkout (Stripe) → دفع → تأكيد → تتبع
```

### تدفق السائق
```
تسجيل → تسجيل دخول → إكمال ملف السائق
   → ظهور في قائمة السائقين → Admin يخصص توصيلة
   → استلام الطلب → مشاركة الموقع المباشر → تسليم
```

### تدفق Admin
```
تسجيل دخول → لوحة التحكم
   → موافقة على التجار الجدد
   → اعتماد المتاجر الجديدة
   → تخصيص السائقين للطلبات
   → عرض التحليلات والإحصائيات
```

## 🗄️ مخطط قاعدة البيانات

### Collections

#### `users`
```js
{
  user_id: "user_xxx",         // primary key
  email: "...",                // unique
  name: "...",
  role: "admin|merchant|shopper|driver",
  password_hash: "...",        // bcrypt
  phone: "...",
  address: "...",
  is_approved: bool,           // للتجار
  referral_code: "SAHALxxx",
  referred_by: "user_xxx",
  referral_earnings: 0.0,
  auth_provider: "local|google",
  created_at: "ISO"
}
```

#### `stores`
```js
{
  store_id: "store_xxx",
  merchant_id: "user_xxx",     // FK → users
  name: "...",
  description: "...",
  status: "pending|approved|rejected",
  created_at: "ISO"
}
```

#### `products`
```js
{
  product_id: "prod_xxx",
  merchant_id: "user_xxx",
  store_id: "store_xxx",
  name: "...",
  description: "...",
  price: 0.0,
  stock: 0,
  category: "...",
  images: ["url1", "url2"],
  created_at: "ISO"
}
```

#### `cart_items`
```js
{
  cart_item_id: "cart_xxx",
  user_id: "user_xxx",
  product_id: "prod_xxx",
  quantity: 1,
  added_at: "ISO"
}
```

#### `orders`
```js
{
  order_id: "order_xxx",
  user_id: "user_xxx",
  items: [{ product_id, quantity }],
  total_amount: 0.0,
  status: "pending|confirmed|shipped|delivered|cancelled",
  payment_status: "pending|paid|failed",
  delivery_address: "...",
  driver_id: "driver_xxx",     // optional
  created_at: "ISO",
  updated_at: "ISO"
}
```

#### `delivery_drivers`
```js
{
  driver_id: "driver_xxx",
  user_id: "user_xxx",
  vehicle_type: "...",
  vehicle_number: "...",
  license_number: "...",
  is_available: bool,
  current_lat: 0.0,
  current_lng: 0.0,
  location_updated_at: "ISO",
  created_at: "ISO"
}
```

#### `referrals`
```js
{
  referral_id: "ref_xxx",
  referrer_id: "user_xxx",
  referred_id: "user_xxx",
  status: "pending|rewarded",
  reward_amount: 0.0,
  created_at: "ISO"
}
```

#### `payment_transactions`, `chat_messages`, `user_sessions`
موجودة لتفاصيل الدفع، سجل الشات، وجلسات OAuth.

## 🔌 الـ API Endpoints

### المصادقة
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/session` (OAuth)

### المتاجر والمنتجات
- `GET /api/stores` (عام)
- `POST /api/stores` (تاجر)
- `PATCH /api/stores/{id}/status` (Admin)
- `GET /api/products` (عام)
- `POST /api/products` (تاجر مع متجر معتمد)

### السلة والشراء
- `POST /api/cart`
- `GET /api/cart`
- `DELETE /api/cart/{id}`
- `POST /api/checkout`
- `GET /api/payment/status/{session_id}`

### الطلبات والتوصيل
- `GET /api/orders`
- `PATCH /api/orders/{id}/status`
- `GET /api/orders/{id}/tracking`
- `POST /api/drivers`
- `POST /api/drivers/location`
- `POST /api/deliveries/{id}/assign` (Admin)

### Admin
- `GET /api/admin/users`
- `PATCH /api/admin/users/{id}/approve`
- `GET /api/admin/analytics`
- `GET /api/admin/stores`
- `GET /api/admin/drivers`
- `GET /api/admin/deliveries`

### الإحالات والشات
- `GET /api/referrals/my`
- `GET /api/referrals/leaderboard`
- `POST /api/chat`
- `GET /api/chat/history`

## 🎯 قرارات تقنية

### لماذا MongoDB؟
- مرونة المخطط مفيدة لتطور سريع
- Documents تناسب الـ orders nested
- `motor` async يتكامل بسلاسة مع FastAPI

### لماذا FastAPI؟
- async/await أصلي
- Pydantic للتحقق التلقائي
- توثيق تفاعلي تلقائي (`/docs`)

### لماذا React 19؟
- أحدث ميزات React
- Concurrent rendering
- Hooks محسّنة

### لماذا shadcn/ui؟
- ليست مكتبة - components تُنسخ للمشروع
- مرونة كاملة للتخصيص
- مبنية على Radix UI الموثوقة
