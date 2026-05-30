import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { ArrowRight, ShoppingCart } from 'lucide-react';

const PLACEHOLDER_IMAGE = 'https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => { fetchProduct(); }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      setProduct(response.data);
    } catch (error) {
      toast.error('المنتج غير موجود');
      navigate('/shop');
    } finally { setLoading(false); }
  };

  const addToCart = async () => {
    if (!user) { toast.error('سجل دخول أولاً'); navigate('/login'); return; }
    try {
      await api.post('/cart', null, { params: { product_id: product.product_id, quantity: 1 } });
      toast.success('تمت إضافته للسلة!');
    } catch { toast.error('فشلت الإضافة'); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4">
        <div className="container mx-auto px-4">
          <Button variant="ghost" onClick={() => navigate('/shop')}>
            <ArrowRight className="h-4 w-4 ml-2" />العودة للمتجر
          </Button>
        </div>
      </header>
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <div className="aspect-square overflow-hidden rounded-lg bg-white mb-4">
              <img src={product.images[selectedImage] || PLACEHOLDER_IMAGE} alt={product.name}
                className="w-full h-full object-cover" onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }} />
            </div>
          </div>
          <div>
            <div className="bg-white rounded-lg p-8">
              <span className="text-xs uppercase tracking-wider text-[#475569] font-semibold">{product.category}</span>
              <h1 className="text-4xl font-bold tracking-tight mb-4 mt-2">{product.name}</h1>
              <p className="text-[#475569] text-lg mb-6">{product.description}</p>
              <div className="mb-6">
                <div className="text-4xl font-bold text-[#4338CA] mb-2">ر.ع {product.price.toFixed(2)}</div>
                <div className="text-sm text-[#475569]">
                  {product.stock > 0 ? `${product.stock} متوفر في المخزون` : 'نفذ من المخزون'}
                </div>
              </div>
              <Button className="w-full bg-[#F97316] hover:bg-[#EA580C] text-lg py-6"
                onClick={addToCart} disabled={product.stock === 0}>
                <ShoppingCart className="h-5 w-5 ml-2" />
                {product.stock === 0 ? 'نفذ من المخزون' : 'أضف إلى السلة'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
