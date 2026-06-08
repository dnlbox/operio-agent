/**
 * Selects a single DOM element matching a selector. Throws if not found to ensure type safety.
 * 
 * @param selector The CSS selector.
 * @param parent Optional parent element.
 * @returns The resolved HTMLElement.
 */
export function qs<T extends HTMLElement>(selector: string, parent: HTMLElement | Document = document): T {
  const element = parent.querySelector(selector);
  if (!element) {
    throw new Error(`Element matching selector "${selector}" not found.`);
  }
  return element as T;
}

/**
 * Selects a list of DOM elements matching a selector.
 * 
 * @param selector The CSS selector.
 * @param parent Optional parent element.
 * @returns An array of HTMLElements.
 */
export function qsa<T extends HTMLElement>(selector: string, parent: HTMLElement | Document = document): T[] {
  return Array.from(parent.querySelectorAll(selector)) as T[];
}

/**
 * Binds an event listener to a target element.
 * 
 * @param element The target element.
 * @param event The event type name.
 * @param handler The callback event handler.
 * @returns A cleanup function to remove the listener.
 */
export function on<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (ev: HTMLElementEventMap[K]) => void
): () => void {
  element.addEventListener(event, handler);
  return () => {
    element.removeEventListener(event, handler);
  };
}

/**
 * Renders a temporary toast notification message on the screen.
 * 
 * @param message The text message content to display.
 */
export function showSystemNotice(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'system-notice';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
