# Ada's Feed — Site tin tức

Bảng tin tĩnh (GitHub Pages) do Ada tự động cập nhật từ hai luồng tin: internet và Facebook.

- `index.html` — giao diện bảng feed (thuần HTML/CSS/JS, không thư viện ngoài)
- `feed.json` — dữ liệu tin: mảng các mục {ts, flow, category, title, summary, url, image, source}, mới nhất xếp trước, giữ tối đa 300 mục

Mỗi lượt chạy của các job tin sẽ thêm mục mới vào `feed.json`, commit và push lên repo này.
