// Import ALL images (jpg + png)
// ✅ Capital 'Products' matches actual folder name
const images = import.meta.glob(
  "/src/assets/images/Products/*.{jpg,png,jpeg}",
  { eager: true }
);

const getProductImage = (imageName) => {
  if (!imageName) return "";

  const allImagePaths = Object.keys(images);

  // ✅ Find image whose filename includes imageName (case-insensitive)
  const matchedPath = allImagePaths.find((path) =>
    path.toLowerCase().includes(imageName.toLowerCase())
  );

  if (!matchedPath) {
    // ✅ Return placeholder if exists, else empty string
    const placeholderPath = allImagePaths.find((path) =>
      path.toLowerCase().includes("placeholder")
    );
    if (placeholderPath) {
      const mod = images[placeholderPath];
      // ✅ Handle both Vite module formats
      return typeof mod === "string" ? mod : mod?.default ?? "";
    }
    return "";
  }

  const mod = images[matchedPath];
  // ✅ Vite 4+ eager imports return the URL directly as string
  // but some setups still wrap in { default: url } — handle both
  return typeof mod === "string" ? mod : mod?.default ?? "";
};

export default getProductImage;