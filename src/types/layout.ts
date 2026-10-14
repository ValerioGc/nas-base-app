export interface NasCategory<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
  testid?: string;
}
