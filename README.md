# 🎭 Fun Zone - Lợn Tùng & Friends

Dự án website giải trí với tính năng đăng nhập và các trò chơi vui nhộn!

## ✨ Tính năng

### 🔐 Hệ thống đăng nhập
- **Đăng nhập**: Sử dụng API backend có sẵn
- **Lưu trữ token**: Access token và refresh token được lưu trong localStorage
- **Dashboard**: Trang cá nhân hiển thị thông tin user
- **Chế độ ẩn danh**: Vẫn có thể sử dụng mà không cần đăng nhập

### 🎮 Trò chơi
- **Tic Tac Toe**: Chơi với AI
- **Kéo Búa Bao**: Game cổ điển
- **Vòng Quay May Mắn**: Tùy chỉnh các lựa chọn

### 🎲 Công cụ cược
- **Máy tính tỉ lệ nâng cấp**: Tính toán cho FC Online
- **Máy tính tiền cược**: Hỗ trợ cả cược có nhà cái và không nhà cái

### 👥 Tương tác
- **Tặng nước hoa**: Tặng nước hoa Minh béo cho các thành viên
- **Đếm số lượng**: Sử dụng API counter để theo dõi

## 🚀 Cách sử dụng

### Truy cập website
1. Mở `index.html` trong trình duyệt
2. Hoặc truy cập qua GitHub Pages: `https://homata123.github.io`

### Đăng nhập (tùy chọn)
1. Click nút "🔐 Đăng Nhập" ở góc phải
2. Sử dụng thông tin demo:
   - **Username**: `superadmin`
   - **Password**: `superadminpw`
3. Sau khi đăng nhập, bạn sẽ được chuyển đến dashboard

### Sử dụng các tính năng
- **Chơi game**: Click vào các game trong phần "🎮 Khu Vực Giải Trí"
- **Tính cược**: Sử dụng các công cụ trong phần "🎲 Cược Vui"
- **Tặng nước hoa**: Click vào ảnh hoặc nút tặng nước hoa

## 📁 Cấu trúc dự án

```
homata123.github.io/
├── index.html          # Trang chủ
├── login.html          # Trang đăng nhập
├── dashboard.html      # Trang dashboard cho user đã đăng nhập
├── auth.js            # Xử lý authentication
├── common.js          # Các function chung
├── styles.css         # CSS chung cho tất cả trang
└── README.md          # Hướng dẫn này
```

## 🔧 Công nghệ sử dụng

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Authentication**: JWT tokens
- **API**: Tích hợp với backend API có sẵn
- **Storage**: localStorage cho session management
- **Responsive**: Thiết kế responsive cho mobile

## 🎯 API Endpoints

- **Đăng nhập**: In page
- **Counter API**: `https://api.counterapi.dev/v2/vmb-cg/{slug}/up`

## 📱 Responsive Design

Website được thiết kế responsive và hoạt động tốt trên:
- Desktop
- Tablet
- Mobile

## 🎨 UI/UX Features

- **Gradient background**: Nền gradient động
- **Animations**: Hiệu ứng hover và click
- **Notifications**: Thông báo toast
- **Smooth scrolling**: Cuộn mượt giữa các section
- **Loading states**: Trạng thái loading khi đăng nhập

## 🔒 Bảo mật

- Token được lưu trong localStorage
- Tự động kiểm tra token hết hạn
- Redirect về login khi token không hợp lệ
- Xử lý lỗi API một cách graceful

## 🚧 Phát triển trong tương lai

- [ ] Refresh token mechanism
- [ ] Đăng ký tài khoản mới
- [ ] Quản lý profile user
- [ ] Lưu trữ dữ liệu game
- [ ] Multi-language support

## 📞 Liên hệ

Dự án được phát triển bởi homata123 cho mục đích giải trí và học tập.

---

**Lưu ý**: Đây là dự án demo sử dụng API backend có sẵn. Thông tin đăng nhập demo chỉ để test tính năng.
