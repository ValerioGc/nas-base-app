export interface NasCategory<T extends string = string> {
  value: T;
  label: string;
  /** URL of an icon. Custom Vue icons can be supplied through the icon slot. */
  icon?: string;
  disabled?: boolean;
  /** `data-testid` of the button, for the browser tests of the application. */
  testid?: string;
}
