import { SensorCard } from './SensorCard';
import { SENSOR_CONFIGS } from '../types';
import type { SensorReading } from '../types';

interface SensorGridProps {
  reading: SensorReading | null;
}

export function SensorGrid({ reading }: SensorGridProps) {
  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {SENSOR_CONFIGS.map((config) => (
          <SensorCard key={config.key} config={config} reading={reading} />
        ))}
      </div>
    </section>
  );
}
