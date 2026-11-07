export type TemperatureSource = 'chip' | 'disk' | 'nvme';

export type TemperatureTone = 'normal' | 'warning' | 'danger';

const LIMITS: Record<TemperatureSource, readonly [warning: number, danger: number]> = {
  chip: [70, 85],
  disk: [45, 55],
  nvme: [60, 70],
};

/**
 * Returns how worrying a temperature is for the kind of component that measured it.
 * @param celsius - The temperature in degrees Celsius.
 * @param source - The kind of component: a processor or graphics card, a SATA disk or an NVMe drive.
 * @returns `normal`, `warning` from the warning limit, `danger` from the danger limit.
 */
export function temperatureTone(celsius: number, source: TemperatureSource): TemperatureTone {
  const [warning, danger] = LIMITS[source];
  if (celsius >= danger) {
    return 'danger';
  }

  return celsius >= warning ? 'warning' : 'normal';
}
