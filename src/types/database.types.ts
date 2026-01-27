export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type UserRole = 'administrador' | 'cajero' | 'garzon' | 'cocina' | 'bar';
export type OrderStatus = 'pendiente' | 'en_proceso' | 'servido' | 'pagado' | 'cancelado';
export type ItemStatus = 'pendiente' | 'en_preparacion' | 'listo_para_servir' | 'entregado' | 'cancelado';
export type TableStatus = 'libre' | 'ocupada' | 'pidio_cuenta';
export type ProductionArea = 'cocina' | 'bar' | 'otro';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'qr' | 'transferencia';

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    carnet_identidad: string
                    nombre_completo: string
                    email: string | null
                    rol: UserRole
                    activo: boolean
                    created_at: string
                }
                Insert: {
                    id: string
                    carnet_identidad: string
                    nombre_completo: string
                    email?: string | null
                    rol?: UserRole
                    activo?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    carnet_identidad?: string
                    nombre_completo?: string
                    email?: string | null
                    rol?: UserRole
                    activo?: boolean
                    created_at?: string
                }
            }
            products: {
                Row: {
                    id: number
                    nombre: string
                    descripcion: string | null
                    precio: number
                    area: ProductionArea
                    foto_url: string | null
                    controla_stock: boolean
                    stock_actual: number
                    stock_diario_base: number | null
                    prioridad: boolean | null
                    disponible: boolean
                    created_at: string
                }
                Insert: {
                    id?: number
                    nombre: string
                    descripcion?: string | null
                    precio: number
                    area: ProductionArea
                    foto_url?: string | null
                    controla_stock?: boolean
                    stock_actual?: number
                    stock_diario_base?: number | null
                    prioridad?: boolean | null
                    disponible?: boolean
                    created_at?: string
                }
                Update: {
                    id?: number
                    nombre?: string
                    descripcion?: string | null
                    precio?: number
                    area?: ProductionArea
                    foto_url?: string | null
                    controla_stock?: boolean
                    stock_actual?: number
                    stock_diario_base?: number | null
                    prioridad?: boolean | null
                    disponible?: boolean
                    created_at?: string
                }
            }
            mesas: {
                Row: {
                    id: number
                    numero_mesa: number
                    capacidad: number
                    estado: TableStatus
                    orden_actual_id: number | null
                }
                Insert: {
                    id?: number
                    numero_mesa: number
                    capacidad?: number
                    estado?: TableStatus
                    orden_actual_id?: number | null
                }
                Update: {
                    id?: number
                    numero_mesa?: number
                    capacidad?: number
                    estado?: TableStatus
                    orden_actual_id?: number | null
                }
            }
            orders: {
                Row: {
                    id: number
                    daily_order_number: number | null;
                    numero_mesa: number
                    garzon_id: string | null
                    cajero_id: string | null
                    estado: OrderStatus
                    total: number
                    metodo_pago: PaymentMethod | null
                    cancelado_por: string | null
                    motivo_cancelacion: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    numero_mesa: number
                    garzon_id?: string | null
                    cajero_id?: string | null
                    estado?: OrderStatus
                    total?: number
                    metodo_pago?: PaymentMethod | null
                    cancelado_por?: string | null
                    motivo_cancelacion?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    numero_mesa?: number
                    garzon_id?: string | null
                    cajero_id?: string | null
                    estado?: OrderStatus
                    total?: number
                    metodo_pago?: PaymentMethod | null
                    cancelado_por?: string | null
                    motivo_cancelacion?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            order_items: {
                Row: {
                    id: number
                    order_id: number
                    product_id: number
                    cantidad: number
                    nota_especial: string | null
                    estado: ItemStatus
                    precio_unitario: number
                    subtotal: number | null // Generated column
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    order_id: number
                    product_id: number
                    cantidad?: number
                    nota_especial?: string | null
                    estado?: ItemStatus
                    precio_unitario: number
                    // subtotal is generated
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    order_id?: number
                    product_id?: number
                    cantidad?: number
                    nota_especial?: string | null
                    estado?: ItemStatus
                    precio_unitario?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            cash_sessions: {
                Row: {
                    id: number
                    cajero_id: string
                    monto_apertura: number
                    monto_cierre: number | null
                    monto_sistema: number | null
                    diferencia: number | null // Generated
                    estado: 'abierta' | 'cerrada'
                    observaciones: string | null
                    opened_at: string
                    closed_at: string | null
                }
                Insert: {
                    id?: number
                    cajero_id: string
                    monto_apertura?: number
                    monto_cierre?: number | null
                    monto_sistema?: number | null
                    estado?: 'abierta' | 'cerrada'
                    observaciones?: string | null
                    opened_at?: string
                    closed_at?: string | null
                }
                Update: {
                    id?: number
                    cajero_id?: string
                    monto_apertura?: number
                    monto_cierre?: number | null
                    monto_sistema?: number | null
                    estado?: 'abierta' | 'cerrada'
                    observaciones?: string | null
                    opened_at?: string
                    closed_at?: string | null
                }
            }
        }
        Views: {
            reporte_cierre_diario: {
                Row: {
                    producto: string
                    area: string
                    cantidad_vendida: number
                    total_dinero: number
                    stock_actual: number
                }
            }
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
