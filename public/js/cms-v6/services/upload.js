const CLOUD_NAME = "rpwcnrfg";
const UPLOAD_PRESET = "mina-upload";
const ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export async function uploadImage(file, folder = "cms-v6/media") {
  if (!file?.type?.startsWith("image/")) throw new Error("Tệp được chọn không phải hình ảnh.");
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} vượt quá 12MB.`);
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);
  const response = await fetch(ENDPOINT, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || !result.secure_url) throw new Error(result?.error?.message || "Không upload được ảnh lên Cloudinary.");
  return result.secure_url;
}
