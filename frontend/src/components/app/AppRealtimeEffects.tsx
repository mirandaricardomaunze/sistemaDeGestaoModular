import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

export default function AppRealtimeEffects() {
    useNotifications();
    useRealtimeSync();

    return null;
}
