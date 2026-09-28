import { createJSONStorage, type StateStorage } from "zustand/middleware";

// Kiểm thử không có DOM nên localStorage vắng mặt; dùng storage rỗng để persist trong bộ nhớ.
// Renderer thật dùng window.localStorage. Mỗi thao tác lại lấy storage hiện tại vì
// createJSONStorage chỉ gọi getStorage một lần lúc tạo; nếu lúc đó chưa có localStorage,
// việc giữ bản rỗng mãi sẽ làm DOM tới muộn hoặc stub kiểm thử không có tác dụng.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const lazyStorage: StateStorage = {
  getItem: (name) =>
    typeof localStorage !== "undefined" ? localStorage.getItem(name) : noopStorage.getItem(name),
  setItem: (name, value) =>
    typeof localStorage !== "undefined"
      ? localStorage.setItem(name, value)
      : noopStorage.setItem(name, value),
  removeItem: (name) =>
    typeof localStorage !== "undefined"
      ? localStorage.removeItem(name)
      : noopStorage.removeItem(name),
};

/** Lớp bọc localStorage lấy trễ cho zustand persist, an toàn khi không có DOM. */
export const safeStorage = createJSONStorage(() => lazyStorage);
