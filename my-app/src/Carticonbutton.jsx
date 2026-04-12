// src/components/CartIconButton.jsx
// Drop this wherever your navbar/header lives
import { useDispatch, useSelector } from "react-redux";
import { ShoppingCart } from "lucide-react";
import { toggleCart } from "../store/cartSlice";
import { selectCartCount } from "../store/cartSlice";

const CartIconButton = () => {
  const dispatch = useDispatch();
  const count = useSelector(selectCartCount);

  return (
    <button
      onClick={() => dispatch(toggleCart())}
      className="relative p-2 text-gray-700 hover:text-[#F7941D] transition"
      aria-label="Open cart"
    >
      <ShoppingCart size={24} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#F7941D] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
};

export default CartIconButton;