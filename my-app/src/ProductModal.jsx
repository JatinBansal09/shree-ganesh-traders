import { X } from "lucide-react";
import getProductImage from "./productImages";
import brands from "./brands";
import categories from "./Categories";
import subCategories from "./subCategories";

const ProductModal = ({ product, onClose }) => {
  if (!product) return null;

  const brand = brands.find(b => b.id === product.Brand_Id);
  const category = categories.find(c => c.id === product.Category_Id);
  const subCategory = subCategories.find(sc => sc.id === product.Sub_Category);

  const imageKey =
    (brand?.name || "") + "_" + product.product_name.replaceAll(" ", "_");

  const imageSrc = getProductImage(imageKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* MODAL: Added 'flex-col sm:flex-row' and 'max-h-[90vh] overflow-y-auto' */}
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl relative flex flex-col sm:flex-row overflow-hidden max-h-[90vh] overflow-y-auto sm:overflow-visible">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-black z-10 bg-white/80 rounded-full p-1 sm:bg-transparent"
        >
          <X size={20} />
        </button>

        {/* IMAGE SECTION: Changed 'w-1/2' to 'w-full sm:w-1/2' */}
        <div className="w-full sm:w-1/2 bg-gray-50 p-6 flex items-center justify-center">
          <img
            src={imageSrc}
            alt={product.product_name}
            className="object-contain max-h-[250px] sm:max-h-[350px] w-auto"
          />
        </div>

        {/* INFO SECTION: Changed 'w-1/2' to 'w-full sm:w-1/2' */}
        <div className="w-full sm:w-1/2 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">
            {product.product_name}
          </h2>

          <p className="text-sm text-gray-500">
            {category?.name} • {subCategory?.name}
          </p>

          <div className="flex items-center gap-2">
            <div className="text-yellow-400 text-sm">★★★★★</div>
            <span className="text-gray-400 text-sm">(156 reviews)</span>
          </div>

          <p className="text-3xl font-semibold text-gray-900">
            ₹{product.price.toLocaleString("en-IN")}
          </p>

          <p className="text-gray-600 text-sm leading-relaxed">
            {product.product_description || "No description available for this product."}
          </p>

          <button className="w-full bg-[#F7941D] text-white py-4 rounded-xl font-bold hover:bg-[#e6861b] transition-colors shadow-lg active:scale-95">
            Add to Cart
          </button>

          <p className="text-xs text-gray-400 flex items-center gap-1">
            <span>✓</span> Wholesale pricing available for bulk orders
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
