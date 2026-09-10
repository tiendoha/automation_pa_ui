# Pilot Automation UI Risk Monitoring — Hosting và Cloud Server

Ngày cập nhật: 10/09/2026. Trạng thái: `PARTIAL`; không trang nào được kết luận `FULL` trước khi Reference capture và hai target scan hoàn chỉnh.

## Kiến trúc đã áp dụng

- Template có role `reference`: chỉ capture URL cuối, screenshot, section, bounding box, CSS allowlist và viewport. Không collect console, `pageerror`, resource hay link probe; không có PASS/FAIL rule.
- Production và OTE có role `target`: context mới, không cookie, `serviceWorkers: 'block'`, route guard trước navigation, chỉ GET/HEAD. Non-read bị abort với `BLOCKED_BY_CLIENT`; completed non-read là invariant fail.
- Production và OTE so structure/layout/CSS với Template; OTE so text/internal-link và Mega Menu/Footer với Production.
- Evidence có dạng `evidence/<run>/<page>/<environment>/<reference|target>/<rule>/...`.

## Quality gate

Node thực tế: `v24.21.0` (`npm 11.19.0`, tại `/tmp/node-v24.21.0-linux-x64/bin`). Pass: format check, lint, typecheck, Playwright Test (14 specs), build. Build chỉ tạo `dist/<module>.js`; không có `dist/src` hoặc `dist/tests`.

## Live evidence

Run `e558efc9-e6a0-4e7d-ac0b-f8ab27ebd8c4` capture đủ Hosting Template (`template/reference`), Production và OTE (`target`). Template result có `role: reference`, network/console/pageerror/linkChecks rỗng đúng scope. Production guard block 15 non-read request và completed bằng 0; OTE completed cũng bằng 0.

Hosting target verdict hiện là `FAILED`: Production có 14 link probe FAIL và 29 console error; OTE có 18 link probe FAIL, 18 console error và 2 pageerror. Đây là evidence target thật, không phải lỗi Template. Cloud Server chưa có live verdict. Vì vậy cả hai page vẫn `PARTIAL`.

## Remaining completion items

- Rerun Cloud Server đầy đủ Template → Production → OTE ở worker không giới hạn thời gian, sau đó chạy batch `workers: 1`.
- Lưu report per-rule (C05/page-type/comparison) sau khi target scan hoàn chỉnh.
- Hoàn tất C01–C15 và chỉ kết luận `FULL` khi cả Production lẫn OTE PASS.
