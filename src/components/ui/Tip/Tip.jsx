import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';

// Appear delay of Transitions.dev's Tooltip (--tt-delay). react-aria applies it to the first
// tooltip only: moving to a neighbouring trigger while one shows opens the next at once.
const DELAY = 80;

/**
 * BoardUI tooltip (react-aria) for a single focusable child that forwards its ref and DOM props,
 * like ui/Button. Hover and keyboard focus open it, Escape closes it; touch shows nothing, so
 * the child must keep its own accessible name (aria-label) — the tooltip only describes it.
 */
export function Tip({ label, placement = 'top', children }) {
  if (!label) return children;
  return (
    <TooltipTrigger delay={DELAY} closeDelay={0}>
      <Focusable>{children}</Focusable>
      <Tooltip placement={placement} size="sm">{label}</Tooltip>
    </TooltipTrigger>
  );
}
