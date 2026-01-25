/* eslint-disable */
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export function Toast({ message, type = 'success', isVisible, onClose, duration = 3000 }: ToastProps) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                setTimeout(onClose, 300); // Wait for exit animation
            }, duration);
            return () => clearTimeout(timer);
        } else {
            setShow(false);
        }
    }, [isVisible, duration, onClose]);

    if (!isVisible && !show) return null;

    const styles = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const icons = {
        success: <CheckCircle className="text-green-500" size={20} />,
        error: <XCircle className="text-red-500" size={20} />,
        info: <CheckCircle className="text-blue-500" size={20} />
    };

    return (
        <div className="fixed top-0 left-0 w-full z-[9999] flex justify-center pt-4 pointer-events-none">
            <div className={`pointer-events-auto transition-all duration-300 transform ${show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles[type]} min-w-[300px]`}>
                    <div className="flex-shrink-0">
                        {icons[type]}
                    </div>
                    <p className="flex-1 font-medium text-sm">{message}</p>
                    <button onClick={() => setShow(false)} className="opacity-50 hover:opacity-100 transition-opacity">
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Simple helper hook to manage toast state
export function useToast() {
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '',
        type: 'success',
        isVisible: false
    });

    const showToast = (message: string, type: ToastType = 'success') => {
        setToast({ message, type, isVisible: true });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, isVisible: false }));
    };

    return { toast, showToast, hideToast };
}
