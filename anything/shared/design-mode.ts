export type ResolvedElement = {
  element: Element;
};

export type GetStyleInfo = (resolved: ResolvedElement) => {
  className: string;
  styles: Record<string, string> | null;
};

export function initDesignMode(_getStyleInfo: GetStyleInfo) {
  return function reselect() {
    // The exported project does not include Anythings's design-mode runtime.
    // This no-op keeps the app runnable outside that environment.
  };
}
