import { CalendarDays, Laptop, Briefcase, ShoppingCart } from 'lucide-react-native';

/** Icon for each request type (asuntos propios, remoto, externo, compra). */
export function requestIcon(type) {
  if (type === 'remoto') return Laptop;
  if (type === 'external') return Briefcase;
  if (type === 'purchase') return ShoppingCart;
  return CalendarDays;
}
