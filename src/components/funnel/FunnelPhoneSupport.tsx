/**
 * Fixed vertical phone support element for funnel pages.
 * Displays on the right edge of the viewport, rotated 90 degrees.
 */
export function FunnelPhoneSupport() {
  return (
    <a
      href="tel:+16027589600"
      className="fixed right-0 top-1/2 -translate-y-1/2 bg-gray-200 text-gray-700 px-3 py-4 text-sm font-medium leading-tight hover:bg-gray-300 transition-colors z-50"
      style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
    >
      <span className="block">Questions?</span>
      <span className="block">(602) 758-9600</span>
    </a>
  );
}
