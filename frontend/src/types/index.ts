// =============================================
// User & Auth Types
// =============================================
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'customer' | 'admin';
  customer_type?: 'B2B' | 'B2C';
  is_active?: boolean;
  created_at?: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  postal_code: string;
  full_address: string;
  is_default: boolean;
}

// =============================================
// Product & Category Types
// =============================================
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
}

export interface Inventory {
  id: string;
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
}

export interface Product {
  id: string;
  category_id?: string;
  category?: Category;
  name: string;
  slug: string;
  variety_name?: string;
  description?: string;
  price: number;
  weight_gram: number;
  size?: 'seedling' | 'remaja' | 'dewasa' | 'berbunga';
  condition?: 'berbunga' | 'knop' | 'vegetatif';
  unit_type: 'PER_POHON' | 'PER_BATCH' | 'PER_VARIETAS';
  batch_quantity?: number;
  care_tips?: string;
  tags?: string[];
  status: 'active' | 'inactive' | 'draft';
  images?: ProductImage[];
  inventory?: Inventory;
  created_at?: string;
  updated_at?: string;
}

// =============================================
// Cart Types
// =============================================
export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  product: Product;
  quantity: number;
  note?: string;
}

export interface Cart {
  id: string;
  user_id: string;
  items: CartItem[];
}

// =============================================
// Order Types
// =============================================
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  user?: User;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_province: string;
  shipping_postal_code: string;
  courier_code?: string;
  courier_service?: string;
  shipping_cost: number;
  tracking_number?: string;
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  note?: string;
  admin_note?: string;
  items?: OrderItem[];
  payment?: Payment;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: string;
  provider?: string;
  external_id?: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';
  payment_url?: string;
  proof_image_url?: string;
  paid_at?: string;
  expired_at?: string;
}

// =============================================
// Stock Movement Types
// =============================================
export interface StockMovement {
  id: string;
  product_id: string;
  product?: Product;
  movement_type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  note?: string;
  performed_by?: string;
  created_at?: string;
}

// =============================================
// API Response Types
// =============================================
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// =============================================
// Dashboard / Analytics Types
// =============================================
export interface KPISummary {
  revenue: number;
  orders: number;
  customers: number;
  low_stock: number;
  aov?: number;
  conversion_rate?: number;
}
