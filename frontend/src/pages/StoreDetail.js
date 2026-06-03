import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { toast } from "sonner";
import { ArrowRight, ShoppingCart, Store, MapPin } from "lucide-react";
import SupportChat from "../components/SupportChat";

const PLACEHOLDER = "https://images.pexels.com/photos/17938771/pexels-photo-17938771.jpeg";

const StoreDetail = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStore();
  }, [storeId]);

  const fetchStore = async () => {
    try {
      const [storesRes, productsRes] = await Promise.all([
        api.get("/stores"),
        api.get("/products")
      ]);
      const found = storesRes.data.find(s => s.store_id === storeId);
      if (!found) { navigate("/shop"); return; }
      setStore(found);
      const storeProducts = productsRes.data.filter(p => p.store_id === storeId);
      setProducts(storeProducts);
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  };

  const addToCart = async (productId) => {
    if (!user) { navigate("/login"); return; }
    try {
      await api.post("/cart", null, { params: { product_id: productId, quantity: 1 } });
      toast.success("تمت الإضافة للسلة!");
    } catch { toast.error("فشلت الإضافة"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4338CA]"></div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-[#E2E8F0] py-4 sticky top-0 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate("/shop")}>
            <ArrowRight className="h-4 w-4 ml-2" />العودة للمتجر
          </Button>
          {user && (
            <Button variant="outline" size="sm" onClick={() => navigate("/cart")}>
              <ShoppingCart className="h-4 w-4 ml-2" />السلة
            </Button>
          )}
        </div>
      </header>

      {/* بانر المتجر */}
      <div style={{background:"linear-gradient(135deg,#4338CA,#7C3AED)", padding:"40px 0"}}>
        <div className="container mx-auto px-4 text-center text-white">
          {store?.logo ? (
            <div style={{width:"96px",height:"96px",borderRadius:"20px",overflow:"hidden",margin:"0 auto 16px",border:"3px solid rgba(255,255,255,0.35)",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
              <img src={store.logo} alt={store.name} style={{width:"100%",height:"100%",objectFit:"cover"}}
                onError={e=>{e.target.style.display="none"; e.target.parentNode.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'><path d=\'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\'/></svg></div>';}} />
            </div>
          ) : (
            <div style={{width:"96px",height:"96px",background:"rgba(255,255,255,0.18)",borderRadius:"20px",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:"2px solid rgba(255,255,255,0.3)"}}>
              <Store style={{width:"44px",height:"44px"}} />
            </div>
          )}
          <h1 style={{fontFamily:"Cairo,sans-serif",fontSize:"28px",fontWeight:700,marginBottom:"8px"}}>{store?.name}</h1>
          {store?.description && <p style={{opacity:0.85,fontSize:"15px",maxWidth:"480px",margin:"0 auto"}}>{store.description}</p>}
          <div style={{marginTop:"12px",fontSize:"13px",opacity:0.75}}>
            {products.length} منتج متوفر
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <Store className="h-16 w-16 text-[#CBD5E1] mx-auto mb-4" />
            <p className="text-[#475569] text-lg">لا توجد منتجات في هذا المتجر بعد</p>
          </div>
        ) : (
          <>
            <h2 style={{fontFamily:"Cairo,sans-serif",fontSize:"20px",fontWeight:700,marginBottom:"24px",color:"#0F172A"}}>منتجات المتجر</h2>
            <div className="bento-grid">
              {products.map(product => (
                <Card key={product.product_id} className="product-card overflow-hidden border border-[#E2E8F0]">
                  <div className="cursor-pointer" onClick={() => navigate(`/product/${product.product_id}`)}>
                    <div className="aspect-square overflow-hidden bg-[#F8F9FA]">
                      <img src={product.images?.[0] || PLACEHOLDER} alt={product.name}
                        className="w-full h-full object-cover"
                        onError={e => { e.target.src = PLACEHOLDER; }} />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-lg mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-sm text-[#475569] mb-2 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-[#4338CA]">{product.price.toFixed(3)} ر.ع</span>
                        <span className="text-sm text-[#475569]">{product.stock} متوفر</span>
                      </div>
                    </CardContent>
                  </div>
                  <div className="px-4 pb-4">
                    <Button className="w-full bg-[#F97316] hover:bg-[#EA580C]"
                      onClick={() => addToCart(product.product_id)}
                      disabled={product.stock === 0}>
                      {product.stock === 0 ? "نفذ من المخزون" : "أضف للسلة"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
      <SupportChat />
    </div>
  );
};

export default StoreDetail;