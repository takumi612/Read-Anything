/** Kết quả đặt ảnh đại diện: thành công có blobId, trường hợp khác có lý do cho toast. */
export type AvatarPickResult =
  | { status: "set"; blobId: string }
  | { status: "too-large" }
  | { status: "unsupported" };
