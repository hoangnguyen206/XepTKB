/**
 * Copy for "Giới thiệu, quyền riêng tư & báo lỗi" (M5-C, SPEC-M5-001 §3; PRD §8 compatibility tiers).
 * Draft wording (OD-M5-3): legal review of the disclaimer/privacy text is pending before G4a.
 * Neutral, no school logo or brand; never claims to be an official tool.
 */
import { INDEPENDENCE_NOTE, VERIFY_NOTE } from "./labels.js";

export type AboutBlock = { kind: "p"; text: string } | { kind: "list"; items: readonly string[] };
export type AboutSection = { id: string; heading: string; blocks: readonly AboutBlock[] };

export const ABOUT_TITLE = "Giới thiệu, quyền riêng tư & báo lỗi";

export const ABOUT_SECTIONS: readonly AboutSection[] = [
  {
    id: "independent",
    heading: "Công cụ độc lập",
    blocks: [
      { kind: "p", text: `${INDEPENDENCE_NOTE} Ứng dụng không liên kết, không được nhà trường bảo trợ và không thay thế cổng đăng ký môn học.` },
      { kind: "p", text: "Ứng dụng chỉ giúp bạn xem, so sánh và xếp thử thời khóa biểu. Ứng dụng không đăng ký môn học thay bạn, không hỏi mật khẩu cổng sinh viên và không đọc dữ liệu sau khi đăng nhập." },
    ],
  },
  {
    id: "data",
    heading: "Nguồn và cách cập nhật dữ liệu",
    blocks: [
      { kind: "p", text: "Dữ liệu thời khóa biểu được chuyển đổi từ văn bản do nhà trường phát hành công khai. Mỗi bộ dữ liệu ghi rõ văn bản nguồn, mã kiểm tra (SHA-256), phiên bản bộ đọc, thời điểm nhập/duyệt/công bố và trạng thái dự kiến hay chính thức." },
      { kind: "p", text: "Mỗi lần nhà trường phát hành bản mới, dữ liệu được nhập lại, kiểm tra và duyệt thủ công trước khi công bố. Dữ liệu đáng ngờ không được công bố. Khi có bản mới, ứng dụng báo để bạn cập nhật phương án." },
      { kind: "p", text: `${VERIFY_NOTE} Bấm vào nhãn dữ liệu ở đầu trang để xem nguồn và phiên bản đang dùng.` },
    ],
  },
  {
    id: "privacy",
    heading: "Quyền riêng tư",
    blocks: [
      { kind: "p", text: "Mọi xử lý diễn ra trên thiết bị của bạn. File kết quả đăng ký môn học (ĐKMH) được đọc ngay trong trình duyệt và không được tải lên đâu cả; họ tên, mã sinh viên, ngày sinh và học phí trong file không được lưu." },
      { kind: "p", text: "Trình duyệt lưu trên thiết bị này (IndexedDB):" },
      {
        kind: "list",
        items: [
          "Phương án nháp và phương án chính thức: các lớp đã chọn, tuần 1 / khóa, và thay đổi phòng/tiết lấy từ file ĐKMH.",
          "Bản sao bộ dữ liệu thời khóa biểu đã tải, để mở được khi mất mạng.",
          "Cài đặt: học kỳ đang xem, phương án đang chọn và danh sách lớp trong file ĐKMH chưa khớp dữ liệu (chỉ mã lớp, mã môn và lịch học).",
          "Cài đặt giao diện: sáng/tối, màu bạn chọn cho từng mã môn và các gợi ý đã xem.",
          "Bản sao lưu của phương án không đọc được (nếu có), để bạn tải về hoặc xóa.",
        ],
      },
      { kind: "p", text: "Bộ nhớ đệm của ứng dụng (service worker) chỉ chứa các file của chính ứng dụng để chạy được khi ngoại tuyến." },
      {
        kind: "list",
        items: [
          "Không có công cụ theo dõi, thống kê hay quảng cáo; không gửi báo cáo lỗi tự động.",
          "Không dùng cookie; không tải script hay phông chữ của bên thứ ba.",
          "Ứng dụng chỉ tải dữ liệu thời khóa biểu công khai từ chính trang này.",
          "Nút “Mở trang báo lỗi” (nếu có) chỉ mở một biểu mẫu Google Forms bên ngoài; ứng dụng không gắn thêm dữ liệu nào vào liên kết. Những gì bạn tự dán và bấm gửi ở biểu mẫu được Google lưu theo chính sách của Google.",
        ],
      },
      { kind: "p", text: "Cách xóa: mở “Dữ liệu trên máy” ở cuối trang và chọn “Xóa dữ liệu trên máy”. Thao tác này xóa phương án, dữ liệu đã lưu và bộ nhớ đệm của ứng dụng trên thiết bị này. Bạn cũng có thể xóa dữ liệu trang web trong cài đặt trình duyệt." },
    ],
  },
  {
    id: "browsers",
    heading: "Trình duyệt hỗ trợ",
    blocks: [
      {
        kind: "list",
        items: [
          "Hỗ trợ đầy đủ: Chrome trên Android, Safari trên iOS (2 phiên bản gần nhất), Chrome và Edge trên máy tính.",
          "Kiểm tra cơ bản: Firefox trên máy tính, Samsung Internet, trình duyệt trong ứng dụng Facebook/Messenger/Zalo.",
          "Trong trình duyệt của ứng dụng chat, việc chọn file và tải file thường không hoạt động — hãy chọn “Mở bằng trình duyệt”.",
        ],
      },
      { kind: "p", text: "Các trình duyệt khác chưa được kiểm tra." },
    ],
  },
  {
    id: "limitations",
    heading: "Giới hạn đã biết",
    blocks: [
      {
        kind: "list",
        items: [
          "Dữ liệu chỉ để tham khảo; lịch có thể thay đổi sau khi trường cập nhật. Luôn đối chiếu với cổng đăng ký.",
          "Nhập kết quả ĐKMH chỉ đọc file .doc/.htm/.html tải từ cổng đào tạo, tối đa 2 MB; không đọc file .docx hay .pdf.",
          "Phương án chỉ nằm trên thiết bị và trình duyệt đang dùng; không đồng bộ giữa các máy. Hãy xuất file nếu muốn giữ lại.",
          "Lần đầu sử dụng cần có mạng để tải ứng dụng và dữ liệu; sau đó ứng dụng mở được khi ngoại tuyến.",
          "Bộ dữ liệu có ngày hết hiệu lực; khi quá hạn, ứng dụng hiện cảnh báo.",
        ],
      },
    ],
  },
];

export const REPORT_HELP = "Nếu thấy giờ học, phòng, tuần hay giảng viên khác với văn bản của trường, hãy báo để dữ liệu được kiểm tra lại. Nội dung báo cáo chỉ gồm phiên bản ứng dụng, phiên bản dữ liệu, mã lớp (nếu có) và mô tả bạn tự viết.";
