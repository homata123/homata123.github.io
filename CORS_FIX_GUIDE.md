# 🔧 Hướng dẫn sửa lỗi CORS 405 Method Not Allowed

## Vấn đề
Khi đăng nhập, browser gửi OPTIONS request (preflight request) trước khi gửi POST request thực tế. Server trả về lỗi 405 Method Not Allowed cho OPTIONS request.

## Nguyên nhân
- Browser tự động gửi OPTIONS request khi:
  - Method không phải GET, HEAD, POST đơn giản
  - Có custom headers (như Content-Type: application/json)
  - Có credentials
- Server chưa được cấu hình để xử lý OPTIONS request

## Giải pháp

### 1. Cấu hình CORS trên Backend (FastAPI/Python)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hoặc chỉ định domain cụ thể: ["http://localhost:3000", "http://127.0.0.1:5500"]
    allow_credentials=True,
    allow_methods=["*"],  # Hoặc ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers=["*"],  # Hoặc ["Content-Type", "Authorization", "Accept"]
)

# Routes của bạn
@app.post("/auth/login")
async def login(request: LoginRequest):
    # Logic đăng nhập
    pass
```

### 2. Cấu hình CORS trên Backend (Express.js/Node.js)

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// Cấu hình CORS
app.use(cors({
    origin: '*', // Hoặc chỉ định domain cụ thể
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Routes của bạn
app.post('/auth/login', (req, res) => {
    // Logic đăng nhập
});
```

### 3. Cấu hình CORS trên Backend (Django/Python)

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
```

### 4. Kiểm tra Server có hỗ trợ OPTIONS không

Test bằng curl:
```bash
# Test OPTIONS request
curl -X OPTIONS \
  'https://homatabe-qx4o.onrender.com/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000'

# Nếu thành công, sẽ trả về:
# HTTP/1.1 200 OK
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization, Accept
```

### 5. Debug trong Browser

Mở Developer Tools (F12) và kiểm tra:
1. **Network tab**: Xem có OPTIONS request không
2. **Console tab**: Xem error messages
3. **Response headers**: Kiểm tra CORS headers

### 6. Temporary Fix (Chỉ để test)

Nếu không thể sửa server ngay, có thể dùng proxy hoặc disable CORS trong browser:

**Chrome (Chỉ để development):**
```bash
chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security --disable-features=VizDisplayCompositor
```

**⚠️ Cảnh báo: Chỉ dùng cho development, không dùng cho production!**

## Kiểm tra sau khi fix

1. Mở Developer Tools (F12)
2. Vào Network tab
3. Thử đăng nhập
4. Kiểm tra:
   - OPTIONS request trả về 200 OK
   - POST request thành công
   - Response có CORS headers

## Các lỗi thường gặp

### 1. "Access to fetch at '...' from origin '...' has been blocked by CORS policy"
- **Nguyên nhân**: Server không cho phép origin này
- **Giải pháp**: Thêm origin vào allow_origins

### 2. "Method OPTIONS is not allowed"
- **Nguyên nhân**: Server không hỗ trợ OPTIONS method
- **Giải pháp**: Thêm OPTIONS vào allow_methods

### 3. "Request header field content-type is not allowed"
- **Nguyên nhân**: Server không cho phép Content-Type header
- **Giải pháp**: Thêm Content-Type vào allow_headers

## Test API trực tiếp

```bash
# Test login API
curl -X 'POST' \
  'https://homatabe-qx4o.onrender.com/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "lontung@gmail.com",
  "password": "kqmk1111"
}'
```

Nếu API hoạt động với curl nhưng không hoạt động với browser, vấn đề chắc chắn là CORS.
