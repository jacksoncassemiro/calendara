const INTERACTIVE_CONTROL_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
].join(', ');

/** Controls rendered inside an event own their activation and pointer gestures. */
export function isNestedInteractiveTarget(
  target: EventTarget | null,
  currentTarget: Element,
): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;

  const control = target.closest(INTERACTIVE_CONTROL_SELECTOR);
  return control !== null && control !== currentTarget && currentTarget.contains(control);
}
