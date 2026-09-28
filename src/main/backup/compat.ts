/** Kiểm tra phiên bản sao lưu: schemaHead phải nằm trong các migration của ứng dụng.
 * Nếu có, bản sao lưu cùng hoặc cũ hơn và sẽ được migration khi khởi động lại;
 * nếu không, có thể thuộc bản mới hơn nên không thể khôi phục an toàn. */
export function checkRestoreCompatibility(
  bundleSchemaHead: string,
  knownMigrationDirs: string[],
): { compatible: boolean; reason?: string } {
  if (!bundleSchemaHead) {
    return { compatible: false, reason: "backup manifest has no schema head" };
  }
  if (knownMigrationDirs.includes(bundleSchemaHead)) return { compatible: true };
  return {
    compatible: false,
    reason: `backup is from a newer app version (unknown migration ${bundleSchemaHead}); cannot downgrade`,
  };
}
