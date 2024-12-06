# Sử dụng Node.js phiên bản 18.17.0
FROM node:18.17.0

# Cài đặt công cụ cần thiết
RUN apt-get update && apt-get install -y jq make

# Cài đặt pnpm
RUN npm install -g pnpm

# Tạo thư mục làm việc
WORKDIR /app

# Copy toàn bộ mã nguồn vào container
COPY . .

# Cài đặt dependencies
RUN make deps

# Build ứng dụng
RUN make build

# Expose port (nếu cần thiết)
EXPOSE 2583 2584 2587 60636

# Lệnh chạy ứng dụng ở chế độ dev-env
CMD ["make", "run-dev-env"]
