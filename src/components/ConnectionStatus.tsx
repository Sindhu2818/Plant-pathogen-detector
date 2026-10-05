import { AlertCircle, CheckCircle, WifiOff } from 'lucide-react';
import type { ConnectionState } from '../types';

interface ConnectionStatusProps {
  error: string | null;
  connectionState: ConnectionState;
}

export function ConnectionStatus({ error, connectionState }: ConnectionStatusProps) {
  // Show a fatal error banner (for critical errors only)
  if (error) {
    return (
      <div className="bg-red-50/80 border border-red-200/50 rounded-xl px-5 py-3.5 mb-6 flex items-center gap-3 animate-in">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" strokeWidth={1.8} />
        <p className="text-sm text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  // Non-alarming offline message
  if (connectionState === 'offline') {
    return (
      <div className="bg-amber-50/60 border border-amber-200/40 rounded-xl px-5 py-3 mb-6 flex items-center gap-3 animate-in">
        <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0" strokeWidth={1.8} />
        <p className="text-sm text-amber-600 font-medium">
          ThingsBoard offline — showing locally stored data.
        </p>
      </div>
    );
  }

  // Small green indicator when live (non-intrusive)
  if (connectionState === 'live') {
    return (
      <div className="bg-green-50/60 border border-green-200/40 rounded-xl px-5 py-3 mb-6 flex items-center gap-3 animate-in">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" strokeWidth={1.8} />
        <p className="text-sm text-green-600 font-medium">
          ThingsBoard connected — receiving live data.
        </p>
      </div>
    );
  }

  // no-data state is already shown in the error case via useSensorData
  return null;
}
