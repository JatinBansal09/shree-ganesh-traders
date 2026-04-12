// Import ALL images (jpg + png)
const images = import.meta.glob(
  "/src/assets/images/products/*.{jpg,png}",
  { eager: true }
);

const getProductImage = (imageName) => {
  const allImagePaths = Object.keys(images);

  // Find image whose filename includes imageName (case-insensitive)
  const matchedPath = allImagePaths.find((path) =>
    path.toLowerCase().includes(imageName.toLowerCase())
  );

  // If no match, return placeholder safely
  if (!matchedPath) {
    const placeholderPath = allImagePaths.find((path) =>
      path.includes("placeholder")
    );

    return placeholderPath
      ? images[placeholderPath].default
      : "";
  }

  // Vite returns: { default: "url" }
  return images[matchedPath].default;
};

export default getProductImage;